/**
 * Libby v2 — Workspace Brief Engine
 *
 * Pure function that builds a WorkspaceBriefData shape from a WorkspaceContext.
 * No Supabase calls. No side effects. Uses Phase 1 data directly.
 */

import type { WorkspaceContext } from './types';
import { formatINR } from '../formatters';

export interface WorkspaceBriefData {
  clientName: string;
  greeting: string;
  openRisksCount: number;
  highRisksCount: number;
  missingProofCount: number;
  readinessScore: number;
  readinessLabel: string;
  topVendorName: string;
  topVendorSpend: number;
  topVendorFormatted: string;
  netCash: number;
  netCashFormatted: string;
  income: number;
  incomeFormatted: string;
  expenses: number;
  expensesFormatted: string;
  isPositive: boolean;
  transactionCount: number;
  periodStart: string | null;
  periodEnd: string | null;
  recurringCommitment: number;
  recurringCommitmentFormatted: string;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getReadinessLabel(score: number): string {
  if (score >= 90) return 'Report Ready';
  if (score >= 70) return 'Almost Ready';
  if (score >= 50) return 'In Progress';
  return 'Needs Work';
}

/**
 * Builds a WorkspaceBriefData from a full WorkspaceContext.
 * Called once per workspace load, lazily.
 *
 * @param context - Full WorkspaceContext from buildWorkspaceContext()
 * @returns WorkspaceBriefData ready for the WorkspaceBrief component
 */
export function buildWorkspaceBrief(context: WorkspaceContext): WorkspaceBriefData {
  const { settings, financial, risks, staffSpend, vendors } = context;

  const highRisks = risks.filter(r => r.severity === 'high');
  const topVendor = vendors.topVendors[0] ?? null;

  // Estimate readiness score based on available context
  // (uses same logic as calculateMonthEndReadiness but from context)
  const openCount = risks.length;
  const uncategorizedCount = context.rawTransactions.filter(
    t => t.category === 'Uncategorized' || !t.category
  ).length;
  const unreviewedCount = context.rawTransactions.filter(
    t => !t.review_status || t.review_status === 'new' || t.review_status === 'needs_review'
  ).length;
  const total = context.rawTransactions.length;
  
  let score = 100;
  if (total > 0) {
    const riskPenalty = Math.min(40, openCount * 5);
    const uncatPenalty = Math.min(30, Math.round((uncategorizedCount / total) * 30));
    const reviewPenalty = Math.min(30, Math.round((unreviewedCount / total) * 30));
    score = Math.max(0, 100 - riskPenalty - uncatPenalty - reviewPenalty);
  }

  return {
    clientName: settings.clientName,
    greeting: getTimeGreeting(),
    openRisksCount: risks.length,
    highRisksCount: highRisks.length,
    missingProofCount: staffSpend.missingProofCount,
    readinessScore: score,
    readinessLabel: getReadinessLabel(score),
    topVendorName: topVendor?.normalized_name ?? '',
    topVendorSpend: topVendor?.totalSpend ?? 0,
    topVendorFormatted: topVendor ? formatINR(topVendor.totalSpend) : '—',
    netCash: financial.netCash,
    netCashFormatted: formatINR(Math.abs(financial.netCash)),
    income: financial.income,
    incomeFormatted: formatINR(financial.income),
    expenses: financial.expenses,
    expensesFormatted: formatINR(financial.expenses),
    isPositive: financial.netCash >= 0,
    transactionCount: financial.transactionCount,
    periodStart: financial.periodStart,
    periodEnd: financial.periodEnd,
    recurringCommitment: vendors.recurringCommitment,
    recurringCommitmentFormatted: formatINR(vendors.recurringCommitment),
  };
}
