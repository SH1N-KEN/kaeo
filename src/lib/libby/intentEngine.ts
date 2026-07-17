/**
 * Libby v2 — Intent Engine
 *
 * Detects the high-level intent of a user message and maps it to a
 * LibbyIntent category. Also determines the appropriate response mode.
 *
 * No Supabase calls. No side effects. Pure classification logic.
 */

import type { LibbyIntent, LibbyResponseMode } from './types';

/**
 * Detects the high-level Libby intent from a user message.
 *
 * Returns one of 9 structured intent categories used to scope
 * data retrieval and AI context assembly.
 *
 * @param message - The raw user message string
 * @returns LibbyIntent
 */
export function detectIntent(message: string): LibbyIntent {
  const q = message.toLowerCase().trim();

  // ── Workspace Summary ──────────────────────────────────────────────────────
  if (
    q.includes('summarise this month') ||
    q.includes('summarize this month') ||
    q.includes('monthly summary') ||
    q.includes('month-end') ||
    q.includes('month end') ||
    q.includes('overview') ||
    q.includes('how are things looking') ||
    q.includes('give me a summary') ||
    q.includes('how are we doing overall') ||
    q.includes('workspace summary') ||
    q.includes('full summary')
  ) {
    return 'workspace_summary';
  }

  // ── Billing ────────────────────────────────────────────────────────────────
  if (
    q.includes('my plan') ||
    q.includes('billing plan') ||
    q.includes('subscription') ||
    q.includes('my tier') ||
    q.includes('plan limit') ||
    q.includes('upgrade') ||
    q.includes('what plan am i on')
  ) {
    return 'billing';
  }

  // ── Staff Spend ────────────────────────────────────────────────────────────
  if (
    q.includes('staff') ||
    q.includes('petty') ||
    q.includes('proof') ||
    q.includes('receipt') ||
    q.includes('missing proof') ||
    q.includes('staff expense') ||
    q.includes('cash expense') ||
    q.includes('mixed payment') ||
    q.includes('reimburs') ||
    q.includes('show missing proof') ||
    q.includes('payment method') ||
    q.includes('unknown payment')
  ) {
    return 'staff_spend';
  }

  // ── Risk ───────────────────────────────────────────────────────────────────
  if (
    q.includes('risk') ||
    q.includes('duplicate') ||
    q.includes('unusual') ||
    q.includes('flagged') ||
    q.includes('mismatch') ||
    q.includes('invoice') ||
    q.includes('exposure') ||
    q.includes('open risk') ||
    q.includes('needs review before') ||
    q.includes('risks need')
  ) {
    return 'risk';
  }

  // ── Vendors ────────────────────────────────────────────────────────────────
  if (
    q.includes('vendor') ||
    q.includes('which vendors increased') ||
    q.includes('spend on') ||
    q.includes('spending on') ||
    q.includes('how much do we pay') ||
    q.includes('top expense') ||
    q.includes('top vendor') ||
    q.includes('subscription') ||
    q.includes('saas') ||
    q.includes('recurring') ||
    q.includes('alternative') ||
    q.includes('replace') ||
    q.includes('cheaper than')
  ) {
    return 'vendors';
  }

  // ── Transactions ───────────────────────────────────────────────────────────
  if (
    q.includes('transaction') ||
    q.includes('categorize') ||
    q.includes('categorise') ||
    q.includes('uncategorized') ||
    q.includes('unclassified') ||
    q.includes('mark reviewed') ||
    q.includes('review queue') ||
    q.includes('pending review') ||
    q.includes('ledger')
  ) {
    return 'transactions';
  }

  // ── Reports ────────────────────────────────────────────────────────────────
  if (
    q.includes('report') ||
    q.includes('readiness') ||
    q.includes('export') ||
    q.includes('accountant') ||
    q.includes('ca pack') ||
    q.includes('report ready') ||
    q.includes('generate report')
  ) {
    return 'reports';
  }

  // ── Dashboard (Financial KPIs) ─────────────────────────────────────────────
  if (
    q.includes('cash flow') ||
    q.includes('net cash') ||
    q.includes('revenue') ||
    q.includes('income') ||
    q.includes('expense') ||
    q.includes('profit') ||
    q.includes('money came in') ||
    q.includes('money went out') ||
    q.includes('how much') ||
    q.includes('cash position') ||
    q.includes('financial summary') ||
    q.includes('why is cash')
  ) {
    return 'dashboard';
  }

  return 'general';
}

/**
 * Determines the appropriate response display mode based on intent and query.
 *
 * Controls how the Libby response is formatted and what level of
 * detail is appropriate.
 *
 * @param intent - Detected LibbyIntent
 * @param query  - The raw user query string
 * @returns LibbyResponseMode
 */
export function determineResponseMode(intent: LibbyIntent, query: string): LibbyResponseMode {
  const q = query.toLowerCase();

  // Casual / greeting queries → short follow-up
  if (intent === 'general' && (
    q === 'yo' || q === 'hey' || q === 'hi' || q === 'okay' ||
    q === 'bruh' || q === 'lol' || q === 'hmm' || q === 'help' ||
    q.length < 6
  )) {
    return 'casual_followup';
  }

  // Action-first priority guidance
  if (
    q.includes('what should i do') ||
    q.includes('where do i start') ||
    q.includes('what to do') ||
    q.includes('what now') ||
    q.includes('next steps') ||
    q.includes('priority') ||
    q.includes('are we okay') ||
    q.includes('what do i fix') ||
    intent === 'workspace_summary'
  ) {
    return 'priority_advice';
  }

  // Exact metric queries
  if (
    q.includes('how much') ||
    q.includes('what is the total') ||
    q.includes('total') ||
    q.includes('net cash') ||
    q.includes('revenue') ||
    q.includes('income') ||
    q.includes('show me the numbers')
  ) {
    return 'metric_answer';
  }

  // Intent-based mode selection
  switch (intent) {
    case 'dashboard':
      return 'report_summary';
    case 'vendors':
      return 'vendor_review';
    case 'risk':
      return 'risk_review';
    case 'reports':
      return query.toLowerCase().includes('invoice') ? 'invoice_review' : 'report_summary';
    case 'staff_spend':
      return 'risk_review';
    default:
      return 'explanation';
  }
}
