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
  unreviewedCount: number;
  missingProofAmount: number;
  categoryTrendStr: string;
  hasDuplicateVendor: boolean;
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

  // Calculate missing proof amount
  const staffTxs = context.rawTransactions.filter(tx => {
    const isStaff = tx.is_staff_expense === true || tx.is_staff_expense === 'true' || tx.raw_row_json?.is_staff_expense === true || tx.raw_row_json?.is_staff_expense === 'true';
    const cat = tx.category || '';
    return isStaff || cat === 'Staff / Petty Expenses';
  });
  const staffMissingProof = staffTxs.filter(tx => {
    const ps = tx.proof_status || tx.raw_row_json?.proof_status;
    return !ps || ps === 'missing' || ps === 'needs_review';
  });
  const missingProofAmount = staffMissingProof.reduce((sum, tx) => {
    const amt = tx.amount_in_base_currency !== null && tx.amount_in_base_currency !== undefined
      ? Number(tx.amount_in_base_currency)
      : Number(tx.amount || 0);
    return sum + Math.abs(amt);
  }, 0);

  // Calculate category spend trend
  const sortedTxs = [...context.rawTransactions].sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());
  let categoryTrendStr = '';
  if (sortedTxs.length > 0) {
    const half = Math.floor(sortedTxs.length / 2);
    const p1 = sortedTxs.slice(0, half);
    const p2 = sortedTxs.slice(half);
    
    const catSpendP1: Record<string, number> = {};
    const catSpendP2: Record<string, number> = {};
    
    p1.forEach(t => {
      const cat = t.category || 'Uncategorized';
      const amt = t.amount_in_base_currency !== null && t.amount_in_base_currency !== undefined ? Number(t.amount_in_base_currency) : Number(t.amount || 0);
      catSpendP1[cat] = (catSpendP1[cat] || 0) + Math.abs(amt);
    });
    p2.forEach(t => {
      const cat = t.category || 'Uncategorized';
      const amt = t.amount_in_base_currency !== null && t.amount_in_base_currency !== undefined ? Number(t.amount_in_base_currency) : Number(t.amount || 0);
      catSpendP2[cat] = (catSpendP2[cat] || 0) + Math.abs(amt);
    });
    
    let maxIncreasePercent = 0;
    let maxIncreaseCategory = '';
    
    Object.keys(catSpendP2).forEach(cat => {
      const s1 = catSpendP1[cat] || 0;
      const s2 = catSpendP2[cat] || 0;
      if (s1 > 1000 && s2 > s1) {
        const pct = ((s2 - s1) / s1) * 100;
        if (pct > maxIncreasePercent) {
          maxIncreasePercent = Math.round(pct);
          maxIncreaseCategory = cat;
        }
      }
    });
    
    if (maxIncreaseCategory && maxIncreasePercent > 0) {
      categoryTrendStr = `${maxIncreaseCategory} spend increased ${maxIncreasePercent}%`;
    }
  }

  // Duplicate vendor check
  const hasDuplicateVendor = risks.some(r => r.risk_type === 'duplicate_vendor' || r.title.toLowerCase().includes('duplicate vendor'));

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
    unreviewedCount,
    missingProofAmount,
    categoryTrendStr,
    hasDuplicateVendor,
  };
}
