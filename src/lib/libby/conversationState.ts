/**
 * Libby v2 — Conversation State
 *
 * Tracks structured context across multi-turn conversations so that
 * short follow-up queries ("Why?", "Compare that.") can be resolved
 * against the active topic rather than losing prior context.
 *
 * Design principles:
 *   - Pure functions only (resolveFollowUp, updateConversationState)
 *   - No global state — callers own the ConversationState object
 *   - No hardcoded entity names or vendor names
 *   - Works generically for vendors, risks, cash flow, staff spend, reports
 *
 * Usage:
 *   const state = createEmptyConversationState();
 *   const resolved = resolveFollowUp(rawQuery, state);
 *   const updatedState = updateConversationState(state, rawQuery, intent, entityName, entityType, answer);
 */

// ─── Types ─────────────────────────────────────────────────────────────────────

/**
 * The high-level topic domain of the active conversation turn.
 * Maps loosely to LibbyIntent but is stable across follow-ups.
 */
export type ConversationEntityType =
  | 'vendor'
  | 'risk'
  | 'transaction'
  | 'report'
  | 'cash_flow'
  | 'staff_spend'
  | 'billing'
  | 'general';

/**
 * Structured conversation state maintained across turns.
 *
 * Callers (e.g. useAskKaeoChat) hold this as a ref and pass it into
 * askKaeo() on every message. The engine returns the updated state
 * after each turn.
 */
export interface ConversationState {
  /** The specific entity being discussed (e.g. "Salary Batch", "High-risk duplicate") */
  activeEntity: string | null;
  /** The type of entity (vendor, risk, cash_flow, etc.) */
  activeEntityType: ConversationEntityType;
  /** The LibbyIntent / AskKaeoCategory detected in the last turn */
  activeIntent: string | null;
  /** The primary period discussed (e.g. "June 2026") */
  activePeriod: string | null;
  /** A secondary period for comparison questions (e.g. "May 2026") */
  comparisonPeriod: string | null;
  /** The raw user query from the last turn */
  lastUserQuery: string | null;
  /** The text of the last assistant answer */
  lastAssistantAnswer: string | null;
  /** source_json from the last turn (contains vendor spend, risk amounts, etc.) */
  lastSourceJson: any;
  /** Turn counter — resets on clear */
  turnCount: number;
}

/** Creates a blank conversation state (used at session start). */
export function createEmptyConversationState(): ConversationState {
  return {
    activeEntity: null,
    activeEntityType: 'general',
    activeIntent: null,
    activePeriod: null,
    comparisonPeriod: null,
    lastUserQuery: null,
    lastAssistantAnswer: null,
    lastSourceJson: null,
    turnCount: 0,
  };
}

// ─── Follow-up Detection ───────────────────────────────────────────────────────

/**
 * Patterns that indicate the user is continuing a prior topic
 * rather than starting a new question.
 */
const FOLLOW_UP_PATTERNS: Array<RegExp> = [
  /^why[?!.]?$/i,
  /^why (did|does|is|was|were|do) (that|this|it)[?!.]?$/i,
  /^why (did|does|is|was|were|do) (that|this|it) happen[?!.]?$/i,
  /^why (is|was) (that|this)[?!.]?$/i,
  /^how[?!.]?$/i,
  /^how (did|does) (that|this) happen[?!.]?$/i,
  /^how (serious|bad|good|significant|big|much|important) (is|was) (that|this|it)[?!.]?$/i,
  /^(tell me more|more details|explain (that|this|more|further))[?!.]?$/i,
  /^(go on|continue|and\??)[?!.,]?$/i,
  /^(compare (that|this)( with)?|compare with) (last month|this month|previous month|prior month|the previous period)[?!.,]?$/i,
  /^compare (that|this)[?!.]?$/i,
  /^(what about|how about) (last|previous|prior) month[?!.]?$/i,
  /^(vs|versus) (last|previous|prior) (month|period)[?!.]?$/i,
  /^(is that|is this) (good|bad|normal|expected|concerning|high|low)[?!.]?$/i,
  /^(what caused|what's causing|what is causing) (that|this|it)[?!.]?$/i,
  /^(drill down|break (that|it) down|break down (that|this))[?!.]?$/i,
  /^(what does that mean|what does this mean)[?!.]?$/i,
  /^(give me more|show me more|any more details)[?!.]?$/i,
  /^(and|so|but|then)[?!.,]?$/i,
  /^(elaborate|can you elaborate)[?!.]?$/i,
];

/**
 * Regex that detects context-dependent pronouns in a query.
 * When present in a query, these indicate the user is referring
 * to whatever entity is currently active in the conversation.
 *
 * Examples:
 *   "How much did we spend with them in total?"  → 'them' present
 *   "What should I do about it?"                 → 'it' present
 *   "Why is that one serious?"                   → 'that' present
 */
const CONTEXT_PRONOUN_REGEX = /\b(them|they|their|it|that|this|those|these)\b/i;

/**
 * Returns true if the query contains a context-dependent pronoun
 * that requires the active conversation entity to be substituted.
 *
 * Only considers queries under 150 characters (long queries likely
 * introduce a genuinely new topic even when they contain pronouns).
 *
 * @param query - The raw user message
 * @returns true if the query contains a resolvable context pronoun
 */
export function containsContextualPronoun(query: string): boolean {
  const q = query.trim();
  if (q.length > 150) return false;
  return CONTEXT_PRONOUN_REGEX.test(q);
}

/**
 * Substitutes context-dependent pronouns in a query with the name of
 * the currently active entity from conversation state.
 *
 * This produces an entity-anchored query that the data retrieval layer
 * can use to filter/aggregate data for the correct vendor, risk, etc.
 *
 * Examples (activeEntity = "Salary Batch"):
 *   "How much did we spend with them in total?"
 *   → "How much did we spend with Salary Batch in total?"
 *
 *   "What should I do about it?"
 *   → "What should I do about Salary Batch?"
 *
 * Pronouns are only replaced when an activeEntity is known.
 * If state.activeEntity is null, returns the original query unchanged.
 *
 * @param query - The raw user message (possibly already enriched by resolveFollowUp)
 * @param state - Current conversation state
 * @returns Query with pronouns replaced by the active entity name
 */
export function resolvePronounsInQuery(query: string, state: ConversationState): string {
  if (!state.activeEntity) return query;
  if (!containsContextualPronoun(query)) return query;

  const entity = state.activeEntity;

  // Replace plural/group pronouns first (them, they, their, those, these)
  // then singular pronouns (it, that, this)
  return query
    .replace(/\b(them|they|their|those|these)\b/gi, entity)
    .replace(/\b(it|that|this)\b/gi, entity);
}

/**
 * Detects whether a user message is a follow-up to a prior topic.
 *
 * A message is considered a follow-up if:
 *   a) It matches one of the structured FOLLOW_UP_PATTERNS (short/exact), OR
 *   b) It contains a context-dependent pronoun (them/it/that/this/etc.)
 *      and is under 120 characters — indicating the user is referring
 *      to the active entity rather than asking a new question.
 *
 * @param query - The raw user message
 * @returns true if the query is a follow-up
 */
export function isFollowUpQuery(query: string): boolean {
  const q = query.trim();
  // Structured exact-match patterns (short queries)
  if (FOLLOW_UP_PATTERNS.some(p => p.test(q))) return true;
  // Pronoun-bearing queries that reference the active entity
  if (q.length <= 120 && containsContextualPronoun(q)) return true;
  return false;
}

// ─── Follow-up Resolution ─────────────────────────────────────────────────────

/**
 * Detects the comparison intent from a follow-up query.
 * Returns 'last_month', 'this_month', or null.
 */
function detectComparisonPeriod(query: string): string | null {
  const q = query.toLowerCase();
  if (q.includes('last month') || q.includes('previous month') || q.includes('prior month')) return 'last_month';
  if (q.includes('this month') || q.includes('current month')) return 'this_month';
  if (q.includes('last year') || q.includes('previous year')) return 'last_year';
  if (q.includes('next month') || q.includes('next quarter')) return 'next_period';
  return null;
}

/**
 * Detects the follow-up intent type from the raw query string.
 * Used to build the enriched query prefix.
 */
function detectFollowUpIntent(query: string): 'why' | 'compare' | 'how' | 'detail' | 'meaning' | 'good_bad' {
  const q = query.toLowerCase().trim();
  if (/^why|what caused|what's causing|what is causing/.test(q)) return 'why';
  if (/compare|vs|versus|last month|previous month|prior month/.test(q)) return 'compare';
  if (/^how/.test(q)) return 'how';
  if (/^(is that|is this) (good|bad|normal|expected|concerning|high|low)/.test(q)) return 'good_bad';
  if (/what does (that|this) mean|what does it mean/.test(q)) return 'meaning';
  return 'detail';
}

/**
 * Builds an enriched query by injecting prior conversation context
 * into a short follow-up question.
 *
 * Example:
 *   query: "Why?"
 *   state: { activeEntity: "Salary Batch", activeEntityType: "vendor", activeIntent: "vendors" }
 *   → "Why did Salary Batch's spending increase? Context from previous answer: Salary Batch is the top vendor..."
 *
 * @param query - The raw follow-up query
 * @param state - Current conversation state
 * @returns Enriched query string to send to the AI
 */
export function resolveFollowUp(query: string, state: ConversationState): string {
  if (!isFollowUpQuery(query)) return query;
  if (!state.activeEntity && !state.activeIntent && !state.lastUserQuery) return query;

  const followUpIntent = detectFollowUpIntent(query);
  const comparisonPeriod = detectComparisonPeriod(query);
  const entityLabel = state.activeEntity || 'the item we just discussed';
  const entityTypeLabel = state.activeEntityType;

  let prefix = '';

  // Build context-aware prefix based on follow-up intent + entity type
  switch (followUpIntent) {
    case 'why': {
      switch (entityTypeLabel) {
        case 'vendor':
          prefix = `Why did ${entityLabel}'s spending increase or change? What caused this?`;
          break;
        case 'risk':
          prefix = `Why is ${entityLabel} flagged as a risk? What triggered this risk event?`;
          break;
        case 'cash_flow':
          prefix = `Why did cash flow change? What caused the movement in income or expenses?`;
          break;
        case 'staff_spend':
          prefix = `Why is there a concern with ${entityLabel || 'staff spending'}? What is the underlying issue?`;
          break;
        case 'report':
          prefix = `Why is the report in its current state? What is blocking readiness?`;
          break;
        default:
          prefix = `Why did this happen? Explain the underlying reason.`;
      }
      break;
    }
    case 'compare': {
      const period = comparisonPeriod === 'last_month' ? 'last month' : comparisonPeriod === 'last_year' ? 'last year' : 'the previous period';
      switch (entityTypeLabel) {
        case 'vendor':
          prefix = `Compare ${entityLabel}'s spending this period with ${period}. How has spend changed?`;
          break;
        case 'cash_flow':
          prefix = `Compare this period's cash flow with ${period}. How have income and expenses changed?`;
          break;
        case 'risk':
          prefix = `Compare the risk exposure this period with ${period}. Are risks increasing or decreasing?`;
          break;
        default:
          prefix = `Compare this period with ${period}.`;
      }
      break;
    }
    case 'how': {
      switch (entityTypeLabel) {
        case 'vendor':
          prefix = `How is ${entityLabel} being tracked and what are the individual transactions contributing to the total spend?`;
          break;
        case 'risk':
          prefix = `How was ${entityLabel || 'this risk'} detected and what evidence supports it?`;
          break;
        default:
          prefix = `How does this work? Explain the mechanism.`;
      }
      break;
    }
    case 'good_bad': {
      switch (entityTypeLabel) {
        case 'vendor':
          prefix = `Is the spending on ${entityLabel} at a healthy or concerning level? How does it compare to typical spend?`;
          break;
        case 'cash_flow':
          prefix = `Is the current cash flow position healthy or concerning for this business?`;
          break;
        case 'risk':
          prefix = `How serious is ${entityLabel || 'this risk'}? Is it a critical issue or manageable?`;
          break;
        default:
          prefix = `Is this good or bad? Evaluate whether this is at a healthy level.`;
      }
      break;
    }
    case 'meaning': {
      prefix = `What does the previous answer mean in practical terms for the business?`;
      break;
    }
    case 'detail':
    default: {
      switch (entityTypeLabel) {
        case 'vendor':
          prefix = `Tell me more details about ${entityLabel}'s spending, including individual transactions and trend.`;
          break;
        case 'risk':
          prefix = `Give me more details about ${entityLabel || 'this risk'}, including the transactions and amounts involved.`;
          break;
        case 'cash_flow':
          prefix = `Give me a more detailed breakdown of the cash flow movement.`;
          break;
        default:
          prefix = `Tell me more about what was just discussed.`;
      }
    }
  }

  // Append prior context summary so AI has grounding
  const contextLines: string[] = [];
  if (state.lastUserQuery) contextLines.push(`Previous question: "${state.lastUserQuery}"`);
  if (state.activeEntity) contextLines.push(`Active topic: ${entityLabel} (${entityTypeLabel})`);
  if (state.activePeriod) contextLines.push(`Period: ${state.activePeriod}`);
  if (state.lastAssistantAnswer) {
    // Trim to first 500 chars so we don't bloat the prompt
    const snippet = state.lastAssistantAnswer.slice(0, 500);
    contextLines.push(`Summary of prior answer: ${snippet}${state.lastAssistantAnswer.length > 500 ? '...' : ''}`);
  }

  const contextBlock = contextLines.length > 0
    ? `\n\n[Conversation context: ${contextLines.join('. ')}]`
    : '';

  return `${prefix}${contextBlock}`;
}

// ─── State Updater ────────────────────────────────────────────────────────────

/**
 * Extracts the active entity from a query + source_json from the engine response.
 *
 * Looks for vendor names, risk titles, or other entities in the response
 * source_json to populate activeEntity for the next turn.
 */
function extractActiveEntity(
  _query: string,
  sourceJson: any
): { entity: string | null; entityType: ConversationEntityType } {
  if (!sourceJson) return { entity: null, entityType: 'general' };

  // ── Priority 1: Explicit entity fields from the updated aiSourceJson ──────
  // The orchestrator now writes activeEntity + activeEntityType directly into
  // the source_json returned from each turn. Use these as the most reliable
  // signal — they are set from the pre-aggregated focused_vendor data and the
  // active conversation state, so they are always correct.
  if (sourceJson.activeEntity && sourceJson.activeEntityType) {
    return {
      entity: sourceJson.activeEntity,
      entityType: sourceJson.activeEntityType as ConversationEntityType,
    };
  }

  // ── Priority 2: focused_vendor from the orchestrator ─────────────────────
  // When a focused_vendor was found during retrieval, use its name as the
  // active vendor entity for the next turn.
  if (sourceJson.focused_vendor?.name) {
    return { entity: sourceJson.focused_vendor.name, entityType: 'vendor' };
  }

  // ── Priority 3: matching_vendor (set by findMatchingVendor in orchestrator) ─
  if (sourceJson.matching_vendor?.display_name) {
    return { entity: sourceJson.matching_vendor.display_name, entityType: 'vendor' };
  }

  // ── Priority 4: Legacy fields (deterministic path, pre-v2 source_json) ───
  if (sourceJson.vendor) return { entity: sourceJson.vendor, entityType: 'vendor' };
  if (sourceJson.topVendor) return { entity: sourceJson.topVendor, entityType: 'vendor' };

  // Risk entity
  if (sourceJson.risk_type || sourceJson.risk) {
    const riskName = sourceJson.title || sourceJson.risk || sourceJson.risk_type;
    return { entity: typeof riskName === 'string' ? riskName : null, entityType: 'risk' };
  }

  // Cash flow / finance entity
  if (
    sourceJson.income !== undefined ||
    sourceJson.netCash !== undefined ||
    sourceJson.expenses !== undefined
  ) {
    return { entity: 'cash flow', entityType: 'cash_flow' };
  }

  // Staff spend entity
  if (sourceJson.staff_count !== undefined || sourceJson.missingProof !== undefined) {
    return { entity: 'staff spend', entityType: 'staff_spend' };
  }

  // Report entity
  if (sourceJson.report_exists !== undefined || sourceJson.readiness !== undefined) {
    return { entity: 'report', entityType: 'report' };
  }

  return { entity: null, entityType: 'general' };
}


/**
 * Extracts the active period from source_json or from the query text.
 */
function extractPeriod(query: string, sourceJson: any): string | null {
  // Try to pull from source_json first
  if (sourceJson?.period_start || sourceJson?.periodStart) {
    const start = sourceJson.period_start || sourceJson.periodStart;
    if (typeof start === 'string' && start.length >= 7) {
      const date = new Date(start);
      if (!isNaN(date.getTime())) {
        return date.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      }
    }
  }

  // Try to extract month name from query
  const monthMatch = query.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i);
  if (monthMatch) return monthMatch[1];

  return null;
}

/**
 * Updates the conversation state after a turn completes.
 *
 * Called by the engine orchestrator after the AI response is generated.
 *
 * @param prev       - The previous conversation state
 * @param userQuery  - The raw user query for this turn
 * @param intent     - The detected intent for this turn
 * @param answer     - The assistant's answer text
 * @param sourceJson - The source_json from the engine response
 * @returns Updated ConversationState
 */
export function updateConversationState(
  prev: ConversationState,
  userQuery: string,
  intent: string,
  answer: string,
  sourceJson: any
): ConversationState {
  // If this was a follow-up, preserve the active entity unless a new one is found
  const wasFollowUp = isFollowUpQuery(userQuery);
  const { entity, entityType } = extractActiveEntity(userQuery, sourceJson);
  const period = extractPeriod(userQuery, sourceJson);

  return {
    activeEntity: entity ?? (wasFollowUp ? prev.activeEntity : null),
    activeEntityType: entity ? entityType : (wasFollowUp ? prev.activeEntityType : 'general'),
    activeIntent: intent,
    activePeriod: period ?? (wasFollowUp ? prev.activePeriod : null),
    comparisonPeriod: wasFollowUp && detectComparisonPeriod(userQuery) ? detectComparisonPeriod(userQuery) : null,
    lastUserQuery: userQuery,
    lastAssistantAnswer: answer,
    lastSourceJson: sourceJson,
    turnCount: prev.turnCount + 1,
  };
}
