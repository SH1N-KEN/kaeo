
import type { RiskEvent } from './riskEngine';
import { getDisplayCategory } from './categoryEngine';
import { getCleanTransactions } from './transactionFilters';

export interface ReadinessResult {
  score: number;
  status: 'Ready' | 'Almost ready' | 'Needs review' | 'Not ready';
  checklist: string[];
  deductions: { reason: string; amount: number }[];
}

export const calculateMonthEndReadiness = (
  rawTransactions: any[],
  risks: RiskEvent[]
): ReadinessResult => {
  const transactions = getCleanTransactions(rawTransactions);

  if (transactions.length === 0) {
    return {
      score: 0,
      status: 'Not ready',
      checklist: ['Upload data to calculate readiness'],
      deductions: []
    };
  }

  let score = 100;
  const deductions: { reason: string; amount: number }[] = [];
  const checklist = new Set<string>();

  // 1. Open Risks Penalty
  const openHighRisks = risks.filter(r => r.status === 'open' && r.severity === 'critical');
  const openMediumRisks = risks.filter(r => r.status === 'open' && r.severity === 'high');

  if (openHighRisks.length > 0) {
    const penalty = openHighRisks.length * 15;
    score -= penalty;
    deductions.push({ reason: `${openHighRisks.length} open critical risks`, amount: penalty });
    checklist.add('Review and resolve critical risks in Risk Inbox');
  }

  if (openMediumRisks.length > 0) {
    const penalty = openMediumRisks.length * 8;
    score -= penalty;
    deductions.push({ reason: `${openMediumRisks.length} open high risks`, amount: penalty });
    checklist.add('Review and resolve high risks in Risk Inbox');
  }

  // 2. Unknown Rows Penalty
  const unknownRows = transactions.filter(tx => tx.type === 'unknown');
  if (unknownRows.length > 0) {
    const penalty = Math.min(unknownRows.length * 2, 20); // Cap at 20
    score -= penalty;
    deductions.push({ reason: `${unknownRows.length} transactions with unknown type`, amount: penalty });
    checklist.add('Identify unknown rows in Transactions page');
  }

  // 3. Uncategorized Transactions Penalty
  let uncategorizedCount = 0;
  transactions.forEach(tx => {
    const cat = getDisplayCategory(tx);
    if (cat === 'Uncategorized') {
      uncategorizedCount++;
    }
  });

  if (uncategorizedCount > 0) {
    const penalty = Math.min(uncategorizedCount * 1, 15); // Cap at 15
    score -= penalty;
    deductions.push({ reason: `${uncategorizedCount} uncategorized transactions`, amount: penalty });
    checklist.add('Categorize remaining transactions');
  }

  // 4. Unreviewed Transactions Percentage Penalty
  const totalTxs = transactions.length;
  if (totalTxs > 0) {
    const unreviewedTxs = transactions.filter(tx => !tx.review_status || tx.review_status === 'new' || tx.review_status === 'needs_review');
    const unreviewedPercent = unreviewedTxs.length / totalTxs;
    
    if (unreviewedPercent > 0.1) {
      // If more than 10% unreviewed, start penalizing
      const penalty = Math.floor((unreviewedPercent - 0.1) * 100); // 1 point per percent over 10%
      const cappedPenalty = Math.min(penalty, 25);
      score -= cappedPenalty;
      deductions.push({ reason: `${Math.round(unreviewedPercent * 100)}% of transactions are unreviewed`, amount: cappedPenalty });
      checklist.add('Review pending transactions');
    }
  }

  // Bound score
  score = Math.max(0, score);

  // Determine status
  let status: ReadinessResult['status'] = 'Not ready';
  if (score >= 90) status = 'Ready';
  else if (score >= 70) status = 'Almost ready';
  else if (score >= 50) status = 'Needs review';

  if (score >= 90 && checklist.size === 0) {
    checklist.add('Ready to export Accountant Pack');
  }

  return {
    score,
    status,
    checklist: Array.from(checklist),
    deductions
  };
};
