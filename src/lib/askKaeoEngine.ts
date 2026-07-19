/**
 * askKaeoEngine.ts — Libby v2 Orchestrator
 *
 * This is the thin orchestration layer for Libby.
 * It delegates all intelligence work to the modular src/lib/libby/ layer.
 *
 * Public API: askKaeo(query, clientId, orgId) — unchanged.
 * The existing useAskKaeoChat.tsx hook requires zero modifications.
 *
 * Orchestration flow:
 *   1. buildWorkspaceContext()     → fetch all workspace data
 *   2. checkOnboardingGate()       → guard: onboarding complete?
 *   3. checkEmptyWorkspace()       → guard: any data uploaded?
 *   4. categorizeQuestion()        → deterministic intent for fallback path
 *   5. detectIntent()              → high-level Libby intent for data scoping
 *   6. determineResponseMode()     → display mode for this query
 *   7. getCoreFinancialAnswer()    → exact-match deterministic shortcut
 *   8. retrieveRelevantData()      → focused data slice for AI context
 *   9. askKaeoAi()                 → AI call with focused context
 *  10. sanitizeTextNumbers()       → hallucination repair on AI output
 *  11. deterministic fallback      → if AI fails, return structured data answers
 */

import { supabase } from './supabase';
import { formatINR, formatCurrency, formatSignedCurrency } from './formatters';
import { summarizeVendors } from './reportEngine';
import { askKaeoAi } from './ai/aiClient';
import type { AIStructuredContext } from './ai/aiClient';
import { syncReviewSuggestions } from './aiReviewEngine';

// Libby v2 intelligence modules
import {
  buildWorkspaceContext,
  checkOnboardingGate,
  checkEmptyWorkspace,
  calculateMonthEndReadiness,
  detectIntent,
  determineResponseMode,
  retrieveRelevantData,
  aggregateVendorsByTransaction,
  sanitizeMarkdown,
  createEmptyConversationState,
  resolveFollowUp,
  resolvePronounsInQuery,
  updateConversationState,
} from './libby';
import type { ConversationState } from './libby';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type AskKaeoCategory =
  | 'finance_summary'
  | 'vendor_analysis'
  | 'risk_review'
  | 'recurring_spend'
  | 'cost_optimization'
  | 'service_alternatives'
  | 'business_advice'
  | 'operational_next_steps'
  | 'casual_check_in'
  | 'tax_or_legal_sensitive'
  | 'unknown_general'
  | 'unsupported_needs_ai_or_web'
  | 'ai_review';

interface AskKaeoResponse {
  intent: AskKaeoCategory;
  text: string;
  source_json: any;
  /** Updated conversation state to pass into the next turn */
  conversationState: ConversationState;
}

export type ResponseMode =
  | 'metric_answer'
  | 'priority_advice'
  | 'explanation'
  | 'report_summary'
  | 'vendor_review'
  | 'risk_review'
  | 'invoice_review'
  | 'casual_followup';

// ─── Internal Helpers ─────────────────────────────────────────────────────────

const formatReportCurrency = (val: number, _currency: string = 'INR') => formatINR(val);

const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;

// ─── Legacy Intent Categorizer (deterministic fallback path only) ─────────────

/**
 * Legacy keyword-based intent categorizer.
 * Used exclusively for the deterministic fallback switch statement
 * and the ai_review special path.
 *
 * The AI path now uses detectIntent() from libby/intentEngine.ts instead.
 */
export async function categorizeQuestion(query: string): Promise<AskKaeoCategory> {
  const q = query.toLowerCase().trim();

  if (
    q.includes('review my transactions') || q.includes('review transactions') ||
    q.includes('what should i review') || q.includes('categorize the uncategorized') ||
    q.includes('categorize uncategorized') || q.includes('prepare my month-end') ||
    q.includes('prepare month-end') || q.includes('which risks can be resolved') ||
    q.includes('risks can be resolved') || q.includes('safe to mark reviewed') ||
    q.includes('mark reviewed')
  ) {
    return 'ai_review';
  }

  if (
    q.includes('market price') || q.includes('exchange rate') || q.includes('latest news') ||
    q.includes('competitor') || q.includes('real time') || q.includes('real-time') ||
    q.includes('product feature updates') || q.includes('product rankings')
  ) {
    return 'unsupported_needs_ai_or_web';
  }

  if (q.includes('tax') || q.includes('legal') || q.includes('law') || q.includes('evasion')) {
    return 'tax_or_legal_sensitive';
  }

  if (
    q === 'yo' || q === 'yoo' || q === 'wsg' || q === 'bro' || q === 'hmm' ||
    q === 'idk' || q === 'help' || q === 'lol' || q === 'hey' || q === 'okay' ||
    q === 'damn' || q === 'bruh' || q === 'man' || q === 'fam' || q === 'gosh'
  ) {
    return 'casual_check_in';
  }

  if (
    q.includes('worry') || q.includes('what worries you') || q.includes('what do you think') ||
    q.includes('is this bad') || q.includes('how bad are our numbers') ||
    q.includes('is the business healthy') || q.includes('give me a read') ||
    q.includes('how bad is this') || q.includes('should i worry') ||
    q.includes('honest') || q.includes('how are we doing') || q.includes('are we cooked') ||
    q.includes('are we okay') || q.includes('advice') || q.includes('worth it') ||
    q.includes('negotiate')
  ) {
    return 'business_advice';
  }

  if (
    q.includes('what should i do') || q.includes('priority') ||
    q.includes('next steps') || q.includes('what now')
  ) {
    return 'operational_next_steps';
  }

  if (q.includes('alternative') || q.includes('replace') || q.includes('better than') || q.includes('cheaper than')) {
    return 'service_alternatives';
  }

  if (
    q.includes('risk') || q.includes('duplicate') || q.includes('unusual') ||
    q.includes('invoice') || q.includes('mismatch') || q.includes('staff') ||
    q.includes('petty') || q.includes('proof') || q.includes('receipt') ||
    q.includes('payment method') || q.includes('reimburs') || q.includes('missing proof') ||
    q.includes('staff expense') || q.includes('cash expense') || q.includes('mixed payment')
  ) {
    return 'risk_review';
  }

  if (q.includes('recurring') || q.includes('subscription') || q.includes('saas') || q.includes('monthly spend')) {
    return 'recurring_spend';
  }

  if (q.includes('overspending') || q.includes('reduce') || q.includes('cost') || q.includes('cut')) {
    return 'cost_optimization';
  }

  if (q.includes('vendor') || q.includes('spend on') || q.includes('how much do we pay') || q.includes('top expense')) {
    return 'vendor_analysis';
  }

  if (q.includes('cash') || q.includes('revenue') || q.includes('income') || q.includes('profit') || q.includes('summary')) {
    return 'finance_summary';
  }

  return 'unknown_general';
}

// ─── Response Mode (legacy wrapper — now delegates to intentEngine) ──────────

export function determineResponseModeFromCategory(
  intent: AskKaeoCategory,
  query: string
): ResponseMode {
  // Map legacy AskKaeoCategory → LibbyIntent for the shared determineResponseMode
  const intentMap: Record<AskKaeoCategory, Parameters<typeof determineResponseMode>[0]> = {
    'finance_summary': 'dashboard',
    'vendor_analysis': 'vendors',
    'risk_review': 'risk',
    'recurring_spend': 'vendors',
    'cost_optimization': 'vendors',
    'service_alternatives': 'vendors',
    'business_advice': 'workspace_summary',
    'operational_next_steps': 'workspace_summary',
    'casual_check_in': 'general',
    'tax_or_legal_sensitive': 'general',
    'unknown_general': 'general',
    'unsupported_needs_ai_or_web': 'general',
    'ai_review': 'transactions',
  };
  return determineResponseMode(intentMap[intent] ?? 'general', query) as ResponseMode;
}

// ─── Vendor Matcher ───────────────────────────────────────────────────────────

export const findMatchingVendor = (q: string, vendorList: any[]) => {
  const queryLower = q.toLowerCase();
  const genericWords = ['plan', 'report', 'dashboard', 'vendor', 'billing', 'cfo', 'summary'];

  return vendorList.find(v => {
    const vName = v.normalized_name.toLowerCase();
    if (genericWords.includes(vName)) {
      const regex = new RegExp(`\\b${vName}\\b`, 'i');
      if (vName === 'plan' && (queryLower.includes('my plan') || queryLower.includes('billing plan'))) {
        return false;
      }
      return regex.test(queryLower);
    }
    const regex = new RegExp(`\\b${vName}\\b`, 'i');
    return regex.test(queryLower);
  });
};

// ─── Core Financial Answer (deterministic exact-match shortcuts) ──────────────

export function getCoreFinancialAnswer(
  query: string,
  context: any
): { intent: AskKaeoCategory; text: string; sourceJson: any } | null {
  const q = query.toLowerCase().trim().replace(/[?.]/g, '');

  if (q === 'what is my net cash' || q === 'net cash' || q === 'my net cash' || q.includes('net cash movement')) {
    return {
      intent: 'finance_summary',
      text: `Your net cash movement is ${formatSignedCurrency(context.netCash)}. This is calculated as ${formatCurrency(context.income)} in revenue/inflows${context.refunds > 0 ? ` and ${formatCurrency(context.refunds)} in refunds` : ''}, minus ${formatCurrency(context.expenses)} in outflows and vendor expenses.`,
      sourceJson: { income: context.income, expenses: context.expenses, refunds: context.refunds, netCash: context.netCash }
    };
  }

  if (q === 'how much money came in' || q === 'money came in' || q === 'revenue' || q === 'income' || q.includes('how much money came in')) {
    return {
      intent: 'finance_summary',
      text: `Your imported statements show a total of ${formatCurrency(context.income)} came in${context.refunds > 0 ? ` (plus ${formatCurrency(context.refunds)} in refunds and recoveries)` : ''} during this period.`,
      sourceJson: { income: context.income, refunds: context.refunds }
    };
  }

  if (q === 'how much money went out' || q === 'money went out' || q === 'expenses' || q.includes('how much money went out')) {
    return {
      intent: 'finance_summary',
      text: `Your imported statements show a total of ${formatCurrency(context.expenses)} went out in expenses, subscription fees, and vendor payments during this period.`,
      sourceJson: { expenses: context.expenses }
    };
  }

  if (q === 'what are my top expenses' || q === 'what vendors did i spend most on' ||
      q.includes('top expenses') || q.includes('vendors did i spend most on') || q.includes('spend most on')) {
    const topVendorsList = context.vendorSummary.topVendors.slice(0, 5);
    let text = '';
    if (topVendorsList.length > 0) {
      text = `Your top expenses by vendor are:\n` +
        topVendorsList.map((v: any, index: number) =>
          `${index + 1}. ${v.normalized_name}: ${formatCurrency(v.totalSpend)} (${v.category || 'Vendor'})`
        ).join('\n');

      const categorySpends: Record<string, number> = {};
      context.transactions.forEach((t: any) => {
        if (['expense', 'vendor_payment', 'subscription'].includes(t.type)) {
          const cat = t.category || 'Uncategorized';
          const getTxAmount = (tx: any) => tx.amount_in_base_currency != null ? Number(tx.amount_in_base_currency) : Number(tx.amount);
          categorySpends[cat] = (categorySpends[cat] || 0) + Math.abs(getTxAmount(t));
        }
      });
      const topCategories = Object.entries(categorySpends)
        .map(([name, spend]) => ({ name, spend }))
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 3);
      if (topCategories.length > 0) {
        text += `\n\nTop categories by spend:\n` +
          topCategories.map((c: any, index: number) => `${index + 1}. ${c.name}: ${formatCurrency(c.spend)}`).join('\n');
      }
    } else {
      text = `No vendor spend has been recorded in the current data period.`;
    }
    return { intent: 'vendor_analysis', text, sourceJson: { topVendors: topVendorsList } };
  }

  if (q === 'what risks need review' || q === 'what needs review before exporting' ||
      q.includes('risks need review') || q.includes('needs review before exporting') ||
      q.includes('what risks should i review')) {
    const openRisks = context.risks;
    let text = '';
    if (openRisks.length > 0) {
      text = `You have ${openRisks.length} open risk${openRisks.length === 1 ? '' : 's'} that need review before exporting:\n\n` +
        openRisks.map((r: any) => {
          const amtStr = r.amount_at_risk ? ` (${formatCurrency(r.amount_at_risk)} at risk)` : '';
          return `• [${r.severity.toUpperCase()}] ${r.title}${amtStr}`;
        }).join('\n') + `\n\nI recommend resolving these in the Risk Inbox before exporting.`;
    } else {
      text = `No open risks were found. Your books are ready for export.`;
    }
    return { intent: 'risk_review', text, sourceJson: { risks: openRisks.length } };
  }

  if (q === 'which staff/petty expenses need proof' || q === 'which transactions are missing proof' ||
      q.includes('staff/petty expenses need proof') || q.includes('transactions are missing proof') ||
      q.includes('missing proof')) {
    let text = '';
    if (context.staff_spend_summary.has_staff_expenses) {
      const missingCount = context.staffMissingProof.length;
      const getTxAmount = (t: any) => t.amount_in_base_currency != null ? Number(t.amount_in_base_currency) : Number(t.amount);
      text = `There are ${missingCount} staff/petty expenses missing proof (receipts or invoices) out of ${context.staff_spend_summary.count} total staff transactions.\n\n` +
        (missingCount > 0
          ? `Summary of missing proof items:\n` + context.staffMissingProof.slice(0, 5).map((tx: any) =>
              `• ${tx.description || 'Staff Spend'}: ${formatCurrency(Math.abs(getTxAmount(tx)))} on ${tx.transaction_date || 'unknown date'}`
            ).join('\n')
          : `All staff expenses have supporting proof.`);
    } else {
      text = `No staff or petty expense transactions with missing proof were found in the current workspace.`;
    }
    return { intent: 'risk_review', text, sourceJson: { staffMissingProof: context.staffMissingProof.length } };
  }

  if (q === 'which transactions have unknown payment method' || q.includes('unknown payment method')) {
    let text = '';
    if (context.staff_spend_summary.has_staff_expenses) {
      const unknownCount = context.staffUnknownMethod.length;
      const getTxAmount = (t: any) => t.amount_in_base_currency != null ? Number(t.amount_in_base_currency) : Number(t.amount);
      text = `There are ${unknownCount} transactions with an unknown payment method.\n\n` +
        (unknownCount > 0
          ? `Summary of unknown payment method items:\n` + context.staffUnknownMethod.slice(0, 5).map((tx: any) =>
              `• ${tx.description || 'Transaction'}: ${formatCurrency(Math.abs(getTxAmount(tx)))}`
            ).join('\n')
          : `All transactions have a known payment method.`);
    } else {
      text = `No transactions with unknown payment methods were found in the current workspace.`;
    }
    return { intent: 'risk_review', text, sourceJson: { unknownPaymentMethods: context.staffUnknownMethod.length } };
  }

  if (q === 'tell me about my plan' || q === 'what is my plan' ||
      q.includes('about my plan') || q.includes('what is my plan')) {
    let text = '';
    if (context.billingDataExists) {
      text = `You are currently on the ${context.currentPlanName} plan (${context.billingCycle} billing, status: ${context.subscriptionStatus}). You can manage your plans and limits in the Billing settings.`;
    } else {
      text = `I couldn't find details about your product plan. Could you clarify if you mean your active billing plan or something else?`;
    }
    return { intent: 'unknown_general', text, sourceJson: { planName: context.currentPlanName, billingCycle: context.billingCycle } };
  }

  return null;
}

// ─── Number Sanitizer ─────────────────────────────────────────────────────────

function sanitizeTextNumbers(text: string, _context: {
  income: number;
  expenses: number;
  netCash: number;
  refunds: number;
  transactionCount: number;
  openRisksCount: number;
  duplicateExposure: number;
  uncategorizedCount: number;
  readinessScore: number;
  unreviewedCount: number;
  totalVendorsCount: number;
  totalInvoicesCount: number;
  approvedNumbers: Set<number>;
  vendorsList: any[];
  invoicesList: any[];
  vendorSummary: any;
}): { sanitizedText: string; repairedCount: number; hasUnrepairable: boolean } {
  return { sanitizedText: text, repairedCount: 0, hasUnrepairable: false };
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

/**
 * Main Libby entry point.
 *
 * Public API is extended — now accepts an optional ConversationState so
 * follow-up queries ("Why?", "Compare that.") retain active context.
 *
 * The hook useAskKaeoChat.tsx passes this in on every turn.
 */
export async function askKaeo(
  query: string,
  clientId: string,
  _orgId: string,
  prevConversationState?: ConversationState
): Promise<AskKaeoResponse> {
  const convState = prevConversationState ?? createEmptyConversationState();
  let isSanitized = false;
  let sanitizedAnswer = '';
  let sanitizedReasoning = '';

  // ── Step 0: Resolve follow-up queries against conversation state ──────────
  // Phase A: Enrich structural follow-ups ("Why?", "Compare that.") with prior
  //          context so the intent engine sees a fully-worded query.
  const resolvedQuery = resolveFollowUp(query, convState);
  const effectiveQuery = resolvedQuery !== query ? resolvedQuery : query;

  // Phase B: Substitute context pronouns (them/it/that/this) with the active
  //          entity name. This makes the *entity-resolved* query available to
  //          the vendor matcher and AI context builder, so "How much did we
  //          spend with them?" becomes "How much did we spend with Salary Batch?"
  //          before reaching the data retrieval layer.
  const pronounResolvedQuery = resolvePronounsInQuery(effectiveQuery, convState);

  if (resolvedQuery !== query) {
    console.debug('[Libby ConversationState] Follow-up detected. Resolved query:', effectiveQuery.slice(0, 200));
  }
  if (pronounResolvedQuery !== effectiveQuery) {
    console.debug('[Libby ConversationState] Pronouns resolved:', pronounResolvedQuery.slice(0, 200));
  }

  // ── Step 1: Build workspace context (Libby v2 intelligence layer) ──────────
  const workspaceContext = await buildWorkspaceContext(clientId, _orgId);

  // ── Step 2: Onboarding guard ───────────────────────────────────────────────
  const onboardingBlock = checkOnboardingGate(workspaceContext);
  if (onboardingBlock) {
    return { intent: 'unknown_general', text: onboardingBlock, source_json: { mode: 'onboarding_incomplete' }, conversationState: convState };
  }

  // ── Step 3: Detect intent — legacy for fallback, modern for AI data scoping ─
  // Use the effective (possibly enriched) query for intent detection so that
  // follow-up queries like "Why?" are classified against the resolved topic.
  const legacyIntent = await categorizeQuestion(effectiveQuery);
  const libbyIntent = detectIntent(effectiveQuery);
  const responseMode = determineResponseModeFromCategory(legacyIntent, effectiveQuery);

  // ── Step 4: Empty workspace guard ─────────────────────────────────────────
  const emptyBlock = checkEmptyWorkspace(workspaceContext);
  if (emptyBlock) {
    return { intent: 'unknown_general', text: emptyBlock, source_json: { mode: 'empty_workspace' }, conversationState: convState };
  }

  // ── Step 5: Extract legacy-compatible context shape for deterministic paths ─
  const { financial, vendors, risks, staffSpend, invoices, billing, rawTransactions, rawVendors } = workspaceContext;
  const vendorSummary = summarizeVendors(rawVendors, rawTransactions);

  // Rebuild staff transaction arrays needed by getCoreFinancialAnswer
  const resolveStaffField = (tx: any, field: string) =>
    tx[field] !== undefined && tx[field] !== null ? tx[field] : tx.raw_row_json?.[field] ?? tx.raw_row_json?.metadata?.[field];


  const staffTxs = rawTransactions.filter(tx => {
    const isStaff = resolveStaffField(tx, 'is_staff_expense') === true || resolveStaffField(tx, 'is_staff_expense') === 'true';
    return isStaff || tx.category === 'Staff / Petty Expenses';
  });
  const staffMissingProof = staffTxs.filter(tx => {
    const ps = resolveStaffField(tx, 'proof_status');
    return !ps || ps === 'missing' || ps === 'needs_review';
  });
  const staffUnknownMethod = staffTxs.filter(tx => {
    const pm = resolveStaffField(tx, 'payment_method') || 'unknown';
    return pm === 'unknown';
  });

  const staff_spend_summary = {
    count: staffSpend.count,
    total_amount: staffSpend.totalAmount,
    formatted_total: formatINR(staffSpend.totalAmount),
    missing_proof_count: staffSpend.missingProofCount,
    unknown_payment_method_count: staffSpend.unknownPaymentMethodCount,
    mixed_payment_method_risk_count: staffSpend.mixedPaymentMethodRiskCount,
    proof_risk_count: staffSpend.proofRiskCount,
    has_staff_expenses: staffSpend.hasStaffExpenses,
    top_staff_vendors: staffSpend.topStaffVendors,
  };

  // ── Step 6: Core financial answer (deterministic exact-match shortcut) ─────
  const coreAnswer = getCoreFinancialAnswer(query, {
    income: financial.income,
    refunds: financial.refunds,
    expenses: financial.expenses,
    netCash: financial.netCash,
    transactions: rawTransactions,
    vendors: rawVendors,
    risks,
    invoices: [],
    vendorSummary,
    staff_spend_summary,
    staffMissingProof,
    staffUnknownMethod,
    billingDataExists: billing.exists,
    currentPlanName: billing.planName,
    billingCycle: billing.billingCycle,
    subscriptionStatus: billing.subscriptionStatus,
    baseCurrency: 'INR',
  });

  if (coreAnswer) {
    const updatedState = updateConversationState(convState, query, coreAnswer.intent, coreAnswer.text, coreAnswer.sourceJson);
    return {
      intent: coreAnswer.intent,
      text: coreAnswer.text,
      source_json: { mode: 'deterministic', intent: coreAnswer.intent, grounding_status: 'based_on_data', ...coreAnswer.sourceJson },
      conversationState: updatedState,
    };
  }

  // ── Step 7: Retrieve focused data slice for AI (Libby v2 data retriever) ───
  const relevantData = retrieveRelevantData(libbyIntent, workspaceContext);

  // ── Step 8: Build structured AI context (uses focused slice, not full workspace) ─
  const qStr = effectiveQuery.toLowerCase();
  const needsWebResearchKeywords = ['alternative', 'replace', 'cheaper', 'compare', 'market', 'price', 'pricing', 'competitor'];
  const isWebEligibleIntent = ['service_alternatives', 'cost_optimization', 'business_advice', 'vendor_analysis'].includes(legacyIntent);
  const needs_web_research = isWebEligibleIntent || needsWebResearchKeywords.some(kw => qStr.includes(kw));

  // ── Step 8a: Transaction-level vendor aggregation ─────────────────────────
  // Build a fresh aggregation directly from raw transactions so we always
  // have the correct per-vendor total regardless of what summarizeVendors
  // returned (which caps at top 5 and may use a different key format).
  const allAggregatedVendors = relevantData.aggregatedVendors
    ?? aggregateVendorsByTransaction(rawTransactions, rawVendors);

  // Resolve matching vendor's total spend from the transaction-level aggregation.
  // Lookup priority:
  //   1. Exact normalized_name match against allAggregatedVendors
  //   2. Display name partial match
  //   3. Fallback to 0 (AI will state it cannot find the vendor)
  // Use the pronoun-resolved query for vendor matching so that queries like
  // "How much did we spend with them?" (resolved to "...with Salary Batch?")
  // correctly hit the active vendor rather than returning null and falling back
  // to workspace-wide totals.
  const matchingVendor =
    findMatchingVendor(pronounResolvedQuery, rawVendors) ??
    findMatchingVendor(effectiveQuery, rawVendors) ??
    (convState.activeEntity && convState.activeEntityType === 'vendor'
      ? findMatchingVendor(convState.activeEntity, rawVendors)
      : null);

  // When activeEntityType is 'vendor' but no DB vendor record matched, fall
  // back to finding the active entity directly in the aggregated vendor list.
  // This covers the case where the vendor name came from a previous AI response
  // (via sourceJson.topVendor) and isn't stored as a raw vendor record.
  const focusedAggVendor: typeof allAggregatedVendors[number] | null =
    matchingVendor
      ? (allAggregatedVendors.find(av =>
          av.normalized_name === matchingVendor.normalized_name ||
          av.display_name.toLowerCase() === (matchingVendor.name || matchingVendor.normalized_name || '').toLowerCase()
        ) ?? null)
      : convState.activeEntity && convState.activeEntityType === 'vendor'
        ? (allAggregatedVendors.find(av =>
            av.display_name.toLowerCase() === convState.activeEntity!.toLowerCase() ||
            av.normalized_name.toLowerCase() === convState.activeEntity!.toLowerCase() ||
            convState.activeEntity!.toLowerCase().includes(av.normalized_name.toLowerCase()) ||
            av.display_name.toLowerCase().includes(convState.activeEntity!.toLowerCase())
          ) ?? null)
        : null;

  const matchingVendorTotalSpend = focusedAggVendor?.totalSpend ?? 0;

  const matching_vendor = matchingVendor ? {
    name: matchingVendor.normalized_name,
    display_name: matchingVendor.display_name || matchingVendor.name,
    total_spend: matchingVendorTotalSpend,
    monthly_average: matchingVendor.monthly_average || 0,
    category: matchingVendor.category || 'SaaS',
  } : null;

  // Build a focused vendor context block for the AI whenever there is an
  // active vendor entity — this is what allows the AI to answer
  // "How much did we spend with them?" with the correct aggregated total.
  const focused_vendor = focusedAggVendor ? {
    name: focusedAggVendor.display_name,
    normalized_name: focusedAggVendor.normalized_name,
    total_spend: focusedAggVendor.totalSpend,
    transaction_count: focusedAggVendor.transactionCount,
    category: focusedAggVendor.category,
    first_seen: focusedAggVendor.firstSeen,
    last_seen: focusedAggVendor.lastSeen,
    is_recurring: focusedAggVendor.isRecurring,
  } : null;

  const numbersInQuery = (query.replace(/\b20\d{2}\b/g, '').match(/\d[\d,.]*/g) || []) as string[];
  numbersInQuery.forEach(numStr => {
    const cleanDigits = numStr.replace(/[^\d]/g, '');
    if (cleanDigits.length >= 3) workspaceContext.approvedNumbers.add(parseInt(cleanDigits, 10));
  });

  const approved_extra_numbers = [...workspaceContext.approvedNumbers].filter(n => n > 0);

  const structuredContext: AIStructuredContext = {
    // Use pronounResolvedQuery so the AI sees "Salary Batch" not "them".
    // This is the authoritative question the AI should answer.
    question: pronounResolvedQuery + ' (All financial amounts are in INR.)',
    intent: legacyIntent,
    response_mode: responseMode,
    needs_web_research,
    active_client_name: workspaceContext.settings.clientName,
    // Active entity context — tells the AI exactly what was being discussed
    // before this query. The AI must use focused_vendor when answering vendor
    // questions instead of computing workspace-wide totals.
    active_entity: convState.activeEntity ?? null,
    active_entity_type: convState.activeEntityType ?? 'general',
    // Focused vendor: pre-aggregated data for the specific vendor the user is
    // asking about. When present, the AI must use this data (not workspace total)
    // to answer questions about spend, transactions, or comparisons.
    focused_vendor,
    business_profile: {
      account_mode: workspaceContext.settings.accountMode,
      onboarding_completed: workspaceContext.settings.onboardingCompleted,
      business_name: workspaceContext.settings.clientName,
      industry: workspaceContext.settings.industry,
      monthly_spend_range: workspaceContext.settings.monthlySpendRange,
      team_size: workspaceContext.settings.teamSize,
      accounting_tools: workspaceContext.settings.accountingTools,
      pain_points: workspaceContext.settings.painPoints,
      notes: workspaceContext.settings.notes,
    },
    // Use focused data slice instead of dumping the entire workspace
    financial_summary: relevantData.financial
      ? {
          income: relevantData.financial.income,
          refunds: relevantData.financial.refunds,
          expenses: relevantData.financial.expenses,
          netCash: relevantData.financial.netCash,
          net_cash_movement: relevantData.financial.netCash,
          transaction_count: relevantData.financial.transactionCount,
          period_start: relevantData.financial.periodStart,
          period_end: relevantData.financial.periodEnd,
          base_currency: 'INR',
          has_converted_transactions: false,
        }
      : {
          income: financial.income, refunds: financial.refunds, expenses: financial.expenses,
          netCash: financial.netCash, net_cash_movement: financial.netCash,
          transaction_count: financial.transactionCount,
          period_start: financial.periodStart, period_end: financial.periodEnd,
          base_currency: 'INR', has_converted_transactions: false,
        },
    // Use aggregated vendors (full transaction rollup) for top_vendors when available.
    // This guarantees vendors with multiple transactions show their correct totals.
    top_vendors: allAggregatedVendors.slice(0, 10).map(v => ({
      name: v.display_name,
      normalized_name: v.normalized_name,
      spend: v.totalSpend,
      transaction_count: v.transactionCount,
      category: v.category,
      first_seen: v.firstSeen,
      last_seen: v.lastSeen,
    })),
    recurring_spend: {
      commitment: relevantData.vendors?.recurringCommitment ?? vendors.recurringCommitment,
      active_vendors: relevantData.vendors?.recurringVendors?.length ?? vendors.recurringVendors.length,
    },
    open_risks: (relevantData.risks ?? risks.slice(0, 10)).map(r => ({
      title: r.title, severity: r.severity, amount: r.amount_at_risk,
    })),
    high_priority_risks: risks.filter(r => r.severity === 'high').length,
    latest_report_summary: workspaceContext.latestReport.executiveSummary,
    relevant_notes: workspaceContext.relevantNotes,
    caveats: [
      'AI explanations are for informational purposes only. Use validated reports for official decisions.',
      'Calculations are strictly grounded in deterministic database aggregates.',
      'All financial amounts are in INR.',
    ],
    counts: { transactions: relevantData.counts.transactions, vendors: relevantData.counts.vendors, risks: relevantData.counts.risks },
    approved_extra_numbers,
    matching_vendor,
    invoice_summary: {
      total_invoices_count: invoices.totalCount,
      unmatched_invoices_count: invoices.unmatchedCount,
      overdue_invoices_count: invoices.overdueCount,
      mismatch_invoices_count: invoices.mismatchCount,
      duplicate_invoices_count: invoices.duplicateCount,
      top_invoiced_vendors: invoices.topInvoicedVendors,
    },
    staff_spend_summary,
  };

  // ── Step 9: AI call ────────────────────────────────────────────────────────
  let aiResult = null;
  let fallbackReason = '';
  let rawAiResponse: any = null;
  let checkContradictionResult: boolean | null = null;

  if (legacyIntent !== 'ai_review') {
    try {
      aiResult = await askKaeoAi(structuredContext, clientId);
      rawAiResponse = aiResult;

      if (aiResult) {
        aiResult.answer = sanitizeMarkdown(aiResult.answer);
        aiResult.reasoning_summary = sanitizeMarkdown(aiResult.reasoning_summary);
        if (aiResult.recommended_actions) {
          aiResult.recommended_actions = aiResult.recommended_actions.map(sanitizeMarkdown);
        }
        if (aiResult.caveats) {
          aiResult.caveats = aiResult.caveats.map(sanitizeMarkdown);
        }

        // Strip math equations unless user asked for them
        const q = effectiveQuery.toLowerCase();
        const userAskedMath = q.includes('calculated') || q.includes('math') || q.includes('formula') || q.includes('explain');
        if (!userAskedMath) {
          const mathEquationRegex = /([₹$]|Rs\.?|INR)?\s*[\d,.]+\s*[\+\-\*\/]\s*([₹$]|Rs\.?|INR)?\s*[\d,.]+\s*([\+\-\*\/]\s*([₹$]|Rs\.?|INR)?\s*[\d,.]+)*\s*=\s*([₹$]|Rs\.?|INR)?\s*[\d,.]+/g;
          aiResult.answer = aiResult.answer.replace(mathEquationRegex, '');
          aiResult.reasoning_summary = aiResult.reasoning_summary.replace(mathEquationRegex, '');
        }

        // Auto-inject math formula for net cash if explicitly asked
        if (legacyIntent === 'finance_summary' && userAskedMath) {
          const hasMath = aiResult.reasoning_summary.includes('=') &&
                          aiResult.reasoning_summary.toLowerCase().includes('net cash');
          if (!hasMath) {
            aiResult.reasoning_summary += `\n\nHere's the math:\n${formatReportCurrency(financial.income)} (Income) + ${formatReportCurrency(financial.refunds)} (Refunds) - ${formatReportCurrency(financial.expenses)} (Expenses) = ${formatReportCurrency(financial.netCash)} (Net Cash).`;
          }
        }

        // Run number sanitizer
        const unreviewedCount = rawTransactions.filter(t => !t.review_status || t.review_status === 'new' || t.review_status === 'needs_review').length;
        const uncategorizedCount = rawTransactions.filter(t => t.category === 'Uncategorized' || !t.category).length;
        const readinessResult = calculateMonthEndReadiness(rawTransactions, risks as any[]);
        const readinessScore = readinessResult.score;

        const sanitizeContext = {
          income: financial.income,
          expenses: financial.expenses,
          netCash: financial.netCash,
          refunds: financial.refunds,
          transactionCount: rawTransactions.length,
          openRisksCount: risks.length,
          duplicateExposure: workspaceContext.duplicateExposure,
          uncategorizedCount,
          readinessScore,
          unreviewedCount,
          totalVendorsCount: rawVendors.length,
          totalInvoicesCount: invoices.totalCount,
          approvedNumbers: workspaceContext.approvedNumbers,
          vendorsList: rawVendors,
          invoicesList: [],
          vendorSummary,
        };

        const ansRep = sanitizeTextNumbers(aiResult.answer, sanitizeContext);
        const reasonRep = sanitizeTextNumbers(aiResult.reasoning_summary, sanitizeContext);

        if (ansRep.sanitizedText !== aiResult.answer || reasonRep.sanitizedText !== aiResult.reasoning_summary) {
          isSanitized = true;
          sanitizedAnswer = ansRep.sanitizedText;
          sanitizedReasoning = reasonRep.sanitizedText;
        } else {
          sanitizedAnswer = aiResult.answer;
          sanitizedReasoning = aiResult.reasoning_summary;
        }

        if (aiResult.recommended_actions) {
          aiResult.recommended_actions = aiResult.recommended_actions.map(act => {
            const rep = sanitizeTextNumbers(act, sanitizeContext);
            if (rep.sanitizedText !== act) isSanitized = true;
            return rep.sanitizedText;
          });
        }
        if (aiResult.caveats) {
          aiResult.caveats = aiResult.caveats.map(cav => {
            const rep = sanitizeTextNumbers(cav, sanitizeContext);
            if (rep.sanitizedText !== cav) isSanitized = true;
            return rep.sanitizedText;
          });
        }
        checkContradictionResult = isSanitized;
      } else {
        fallbackReason = 'AI server returned null or failed validation/repair checks';
      }
    } catch (err: any) {
      if (isDev) console.debug('[Libby Engine] AI call failed, falling back to deterministic.', err);
      fallbackReason = err.message || 'AI request threw error';
    }
  } else {
    fallbackReason = 'AI Review intent forces deterministic suggestions queue summary';
  }

  if (!aiResult && isDev) {
    console.debug('[Libby Engine Fallback Triggered]', { legacyIntent, libbyIntent, fallback_reason: fallbackReason, raw_ai_response: rawAiResponse, contradiction_result: checkContradictionResult });
  }

  // ── Step 10: Return AI result if successful ────────────────────────────────
  if (aiResult) {
    const answer = isSanitized ? sanitizedAnswer : aiResult.answer;
    const reasoning = isSanitized ? sanitizedReasoning : aiResult.reasoning_summary;

    // Build a natural, conversational response instead of hard-coded section headers.
    // The AI already produces good prose \u2014 we just need to join it cleanly.
    let formattedText = answer.trim();

    // Append reasoning as a natural follow-on paragraph when it adds genuine value
    // (i.e. it's not just a repeat of the answer and isn't empty).
    if (reasoning && reasoning.trim() && reasoning.trim() !== answer.trim()) {
      formattedText += `\n\n${reasoning.trim()}`;
    }

    // Append recommended actions as inline bullets \u2014 no section header \u2014 only
    // when the AI actually produced specific, non-generic actions.
    const genericActionPhrases = ['no immediate', 'no action required', 'no manual ledger'];
    const hasRealActions = aiResult.recommended_actions &&
      aiResult.recommended_actions.length > 0 &&
      !aiResult.recommended_actions.every(a =>
        genericActionPhrases.some(g => a.toLowerCase().includes(g))
      );
    if (hasRealActions) {
      formattedText += `\n\n${aiResult.recommended_actions!.map(a => `\u2022 ${a}`).join('\n')}`;
    }

    // Append a single grounding caveat when it provides useful context
    // (e.g. limited data, missing month, etc.). Skip boilerplate ones.
    const boilerplateCaveats = [
      'ai explanations are for informational purposes',
      'calculations are strictly grounded',
      'all financial amounts are in inr',
    ];
    const meaningfulCaveats = (aiResult.caveats || []).filter(c =>
      !boilerplateCaveats.some(b => c.toLowerCase().includes(b))
    );
    if (meaningfulCaveats.length > 0) {
      formattedText += `\n\n${meaningfulCaveats.map(c => `\u2022 ${c}`).join('\n')}`;
    }

    const mode = isSanitized ? 'ai_assisted_sanitized' : 'ai_assisted';
    let grounding_status: 'verified' | 'based_on_data' | 'general' = 'based_on_data';
    const isGeneralIntent = ['unknown_general', 'tax_or_legal_sensitive', 'unsupported_needs_ai_or_web', 'casual_check_in'].includes(legacyIntent);
    if (isGeneralIntent) grounding_status = 'general';
    else if (!isSanitized && ['finance_summary', 'risk_review', 'vendor_analysis', 'recurring_spend'].includes(legacyIntent)) grounding_status = 'verified';

    const aiSourceJson = {
      mode,
      intent: legacyIntent,
      grounding_status,
      ai_confidence: aiResult.confidence,
      caveats: aiResult.caveats,
      needs_external_research: aiResult.needs_external_research,
      source_summary: aiResult.source_summary,
      ai_raw_response: aiResult,
      transactionCount: workspaceContext.financial.transactionCount,
      uploads: workspaceContext.uploads || [],
      risksCount: workspaceContext.risks.length,
      vendorsCount: workspaceContext.vendors.totalVendorCount,
      hasIncompleteData: workspaceContext.financial.transactionCount === 0 || (workspaceContext.uploads || []).length === 0,
      // Expose active entity for conversation state extraction and UI grounding.
      // Priority: focused_vendor name > matching_vendor name > prior state entity.
      // This ensures extractActiveEntity() in conversationState.ts always finds
      // the vendor entity regardless of which turn produced it.
      activeEntity: focused_vendor?.name ?? matching_vendor?.display_name ?? convState.activeEntity,
      activeEntityType: (focused_vendor || matching_vendor)
        ? 'vendor'
        : convState.activeEntityType,
      focused_vendor,
      matching_vendor,
    };

    const updatedConvState = updateConversationState(convState, query, legacyIntent, formattedText, aiSourceJson);

    return {
      intent: legacyIntent,
      text: formattedText,
      source_json: aiSourceJson,
      conversationState: updatedConvState,
    };
  }

  // ── Step 11: Deterministic fallback ───────────────────────────────────────
  let responseText = '';
  let sourceJson: any = {};
  const txCount = rawTransactions.length;
  const baseCurrency = 'INR';

  switch (legacyIntent) {
    case 'ai_review': {
      let currentSuggestions: any[] = [];
      try {
        currentSuggestions = await syncReviewSuggestions(_orgId, clientId);
      } catch (err) {
        console.warn('Error syncing suggestions in Libby:', err);
        const { data } = await supabase.from('ai_review_suggestions').select('*').eq('client_id', clientId).eq('status', 'pending');
        currentSuggestions = data || [];
      }
      const safeSuggestions = currentSuggestions.filter(s => !s.requires_approval);
      const highPriority = currentSuggestions.filter(s => s.priority === 'high');
      
      responseText = `Summary:
AI review suggestions are prepared for your review.

Why:
Kaeo's background auditor scanned the ledger and prepared automated corrections.

Evidence:
• ${currentSuggestions.length} pending recommendations.
• ${safeSuggestions.length} items are low risk and safe to bulk approve.

Suggested Actions:
• Click "Open AI Review" to review suggestions.
• Approve safe recommendations with one click.`;
      
      sourceJson = { mode: 'ai_review', intent: 'ai_review', totalSuggestionsCount: currentSuggestions.length, safeSuggestionsCount: safeSuggestions.length, highPriorityCount: highPriority.length, hasSafeSuggestions: safeSuggestions.length > 0, cta: 'open_ai_review' };
      break;
    }

    case 'finance_summary': {
      const netCashPositive = financial.netCash >= 0;
      
      responseText = `Summary:
Your net cash movement is ${netCashPositive ? 'positive' : 'negative'} at ${formatReportCurrency(financial.netCash, baseCurrency)}.

Why:
Total inflows of ${formatReportCurrency(financial.income, baseCurrency)} minus outflows of ${formatReportCurrency(financial.expenses, baseCurrency)} resulted in net flow of ${formatReportCurrency(financial.netCash, baseCurrency)}.

Evidence:
• The business is cash-${netCashPositive ? 'positive' : 'negative'} this period.
• Grounded in ${txCount} verified transactions.

Suggested Actions:
• Review top expense categories to optimize outflows.
• Resolve open risks to capture duplicate exposure.`;
      
      sourceJson = { income: financial.income, expenses: financial.expenses, refunds: financial.refunds, netCash: financial.netCash, transactionCount: txCount };
      break;
    }

    case 'operational_next_steps': {
      const unreviewedCount = rawTransactions.filter(t => !t.review_status || t.review_status === 'new' || t.review_status === 'needs_review').length;
      const uncategorizedCount = rawTransactions.filter(t => t.category === 'Uncategorized' || !t.category).length;
      
      responseText = `Summary:
Ledger optimization steps are required for month-end readiness.

Why:
Completing the ledger audit requires clearing open alerts and categorizing all entries.

Evidence:
• Current readiness score is affected by ${risks.length} open risks.
• ${unreviewedCount} transactions are pending review validation.

Suggested Actions:
• Open the Risk Inbox to resolve compliance alerts.
• Categorize the remaining ${uncategorizedCount} transactions.`;
      
      sourceJson = { risks: risks.length, unreviewed: unreviewedCount, uncategorized: uncategorizedCount, cta: 'risk_inbox' };
      break;
    }

    case 'risk_review': {
      const highSeverityRisks = risks.filter(r => r.severity === 'high');
      
      responseText = `Summary:
There are ${risks.length} compliance risks that need attention.

Why:
Kaeo's automated monitors detected duplicate payments, unmatched invoices, or missing proofs.

Evidence:
• Duplicate exposure of ${formatReportCurrency(workspaceContext.duplicateExposure, baseCurrency)} detected.
• ${highSeverityRisks.length} high-severity risk items are outstanding.

Suggested Actions:
• Resolve duplicates in the Risk Inbox.
• Match outstanding invoices to clear mismatch flags.`;
      
      sourceJson = { risks: risks.length, highSeverity: highSeverityRisks.length, totalInvoices: invoices.totalCount };
      break;
    }

    case 'vendor_analysis':
    case 'service_alternatives': {
      const mentionedVendor = findMatchingVendor(query, rawVendors);
      if (mentionedVendor) {
        // Use transaction-level aggregation for accurate per-vendor totals
        const aggVendor = allAggregatedVendors.find(av =>
          av.normalized_name === mentionedVendor.normalized_name ||
          av.display_name.toLowerCase() === (mentionedVendor.name || '').toLowerCase()
        );
        const spend = aggVendor?.totalSpend ?? 0;
        const txCount = aggVendor?.transactionCount ?? 0;
        
        responseText = `Summary:
Recorded spend with ${mentionedVendor.display_name || mentionedVendor.name} is ${formatReportCurrency(spend, baseCurrency)} across ${txCount} transaction${txCount !== 1 ? 's' : ''}.

Why:
Aggregated spend concentration records for the mentioned vendor counterparty.

Evidence:
• Vendor category: ${mentionedVendor.category || 'Uncategorized'}.
• Total spend represents a major outflow this period.

Suggested Actions:
• Review transaction history for ${mentionedVendor.name}.
• Audit seat counts and pricing plan relevance.`;
        
        sourceJson = { vendor: mentionedVendor.name, spend, transactionCount: txCount };
      } else {
        const top = allAggregatedVendors[0];
        if (top) {
          
          responseText = `Summary:
Your highest spend is with ${top.display_name}, totaling ${formatReportCurrency(top.totalSpend, baseCurrency)} across ${top.transactionCount} transaction${top.transactionCount !== 1 ? 's' : ''}.

Why:
Vendor spend analysis across all registered business counterparties.

Evidence:
• Total of ${rawVendors.length} active vendors tracked.
• Top vendor accounts for a significant portion of outflows.

Suggested Actions:
• Review your Spend Advisor for top vendor alternatives.
• Audit active seats on ${top.display_name}.`;
          
          sourceJson = { topVendor: top.display_name, spend: top.totalSpend };
        } else {
          
          responseText = `Summary:
No significant vendor spend concentration detected.

Why:
Unclassified or missing transactions in the current data period.

Evidence:
• Vendor metrics are limited by unclassified transactions.

Suggested Actions:
• Categorize transactions to populate vendor metrics.`;
          
          sourceJson = { totalVendors: rawVendors.length };
        }
      }
      break;
    }


    case 'recurring_spend':
    case 'cost_optimization': {
      
      responseText = `Summary:
Your estimated recurring commitment is ${formatReportCurrency(vendors.recurringCommitment, baseCurrency)} per month.

Why:
SaaS subscriptions and regular recurring outflows identified by transaction frequency.

Evidence:
• ${vendors.recurringVendors.length} active recurring vendors.
• Subscription floor is established at ${formatReportCurrency(vendors.recurringCommitment, baseCurrency)}.

Suggested Actions:
• Audit subscription licenses to reduce unused seats.
• Cancel inactive subscriptions to optimize costs.`;
      
      sourceJson = { commitment: vendors.recurringCommitment, count: vendors.recurringVendors.length };
      break;
    }

    case 'business_advice': {
      const unreviewedCount = rawTransactions.filter(t => !t.review_status || t.review_status === 'new' || t.review_status === 'needs_review').length;
      const uncategorizedCount = rawTransactions.filter(t => t.category === 'Uncategorized' || !t.category).length;
      
      responseText = `Summary:
Ledger review optimization advice for ${workspaceContext.settings.clientName}.

Why:
Clean records are required for reliable cash flow forecasting and reporting.

Evidence:
• Current net cash movement is ${financial.netCash >= 0 ? 'positive' : 'negative'} at ${formatReportCurrency(financial.netCash, baseCurrency)}.
• ${risks.length} open risks are causing data variance.

Suggested Actions:
• Review the ${unreviewedCount} unreviewed transactions.
• Go to the Risk Inbox to clear warnings.`;
      
      sourceJson = { netCash: financial.netCash, risks: risks.length, unreviewed: unreviewedCount, uncategorized: uncategorizedCount };
      break;
    }

    case 'unknown_general':
    case 'tax_or_legal_sensitive':
    case 'unsupported_needs_ai_or_web':
    case 'casual_check_in':
    default: {
      const unreviewedCount = rawTransactions.filter(t => !t.review_status || t.review_status === 'new' || t.review_status === 'needs_review').length;
      
      responseText = `Summary:
How can I help you review your finances?

Why:
I can answer queries regarding cash flow, risks, vendors, and reports.

Evidence:
• ${risks.length} open risks are currently active.
• ${unreviewedCount} transactions are awaiting validation.

Suggested Actions:
• Ask "What should I fix first?" to see blockers.
• Ask "Review my transactions" to open the queue.`;
      
      break;
    }
  }

  if (!aiResult && legacyIntent !== 'ai_review') {
    responseText = `Summary:
I can still summarize your imported Kaeo data, but the AI model is unavailable right now.

Why:
AI network request timeout or service temporarily offline.

Evidence:
• Displaying deterministic database aggregates.

Suggested Actions:
• Review the following details or try again later:
${responseText}`;
  }

  const fallbackGroundingStatus: 'verified' | 'based_on_data' | 'general' = (() => {
    const isGeneralIntent = ['unknown_general', 'tax_or_legal_sensitive', 'unsupported_needs_ai_or_web', 'casual_check_in'].includes(legacyIntent);
    return isGeneralIntent ? 'general' : 'based_on_data';
  })();

  const fallbackSourceJson = {
    mode: 'deterministic',
    intent: legacyIntent,
    grounding_status: fallbackGroundingStatus,
    fallback_reason: fallbackReason,
    transactionCount: workspaceContext.financial.transactionCount,
    uploads: workspaceContext.uploads || [],
    risksCount: workspaceContext.risks.length,
    vendorsCount: workspaceContext.vendors.totalVendorCount,
    hasIncompleteData: workspaceContext.financial.transactionCount === 0 || (workspaceContext.uploads || []).length === 0,
    ...sourceJson
  };

  const updatedConvStateFallback = updateConversationState(convState, query, legacyIntent, responseText, fallbackSourceJson);

  return {
    intent: legacyIntent,
    text: responseText,
    source_json: fallbackSourceJson,
    conversationState: updatedConvStateFallback,
  };
}
