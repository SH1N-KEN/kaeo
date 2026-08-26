import type { ReconciliationReport } from './reconciliationEngine';

export interface FormattedReport {
  summary: {
    totalBankTxns: number;
    totalStripeTxns: number;
    matchedCount: number;
    matchRate: number;
    unmatchedBankCount: number;
    unmatchedStripeCount: number;
  };
  topMatches: Array<{
    confidence: number;
    bankDescription: string;
    stripeDescription: string;
    amount: number;
    bankDate: string;
    stripeDate: string;
  }>;
  unmatchedStripe: Array<{
    description: string;
    amount: number;
    date: string;
  }>;
  unmatchedBank: Array<{
    description: string;
    amount: number;
    date: string;
  }>;
}

/**
 * Formats a reconciliation report into a human-readable string representation.
 * 
 * @param report The reconciliation report to format
 * @returns A formatted string ready for display
 */
export function formatReconciliationReport(report: ReconciliationReport): string {
  const getTxnDescription = (t: any): string => t.description || t.counterparty_name || 'Unknown';
  const getTxnDate = (t: any): string => t.transaction_date || t.date || 'Unknown';
  const getTxnAmount = (t: any): number => typeof t.amount === 'number' ? t.amount : 0;

  const summary = report.summary;
  
  let text = `RECONCILIATION REPORT\n`;
  text += `Generated: ${report.timestamp}\n\n`;
  text += `SUMMARY\n`;
  text += `-------\n`;
  text += `Bank Transactions:        ${summary.totalBankTxns}\n`;
  text += `Stripe Transactions:      ${summary.totalStripeTxns}\n`;
  text += `Matched Pairs:            ${summary.matchedBankTxnsCount}\n`;
  text += `Match Rate:               ${summary.matchRate.toFixed(1)}%\n\n`;

  // Sort matches by confidence descending, take top 5
  const topMatches = [...report.matches]
    .sort((a, b) => b.matchConfidence - a.matchConfidence)
    .slice(0, 5);

  text += `TOP MATCHES (best 5)\n`;
  if (topMatches.length === 0) {
    text += `None\n`;
  } else {
    for (const match of topMatches) {
      const amt = getTxnAmount(match.bankTxn);
      const desc = getTxnDescription(match.stripeTxn);
      const bDate = getTxnDate(match.bankTxn);
      const sDate = getTxnDate(match.stripeTxn);
      text += `${Math.round(match.matchConfidence)}% — ₹${amt} — ${desc} (${bDate} vs ${sDate})\n`;
    }
  }
  text += `\n`;

  // Unmatched Stripe Transactions
  text += `UNMATCHED STRIPE TRANSACTIONS (${report.unmatchedStripeTxns.length})\n`;
  if (report.unmatchedStripeTxns.length === 0) {
    text += `None\n`;
  } else {
    for (const txn of report.unmatchedStripeTxns) {
      text += `⚠ ₹${getTxnAmount(txn)} — ${getTxnDescription(txn)} (${getTxnDate(txn)})\n`;
    }
  }
  text += `\n`;

  // Unmatched Bank Transactions
  text += `UNMATCHED BANK TRANSACTIONS (${report.unmatchedBankTxns.length})\n`;
  if (report.unmatchedBankTxns.length === 0) {
    text += `None\n`;
  } else {
    for (const txn of report.unmatchedBankTxns) {
      text += `⚠ ₹${getTxnAmount(txn)} — ${getTxnDescription(txn)} (${getTxnDate(txn)})\n`;
    }
  }

  return text;
}

/**
 * Formats a reconciliation report into a structured JSON format suitable for UI rendering.
 * 
 * @param report The reconciliation report to format
 * @returns A structured report object
 */
export function formatReconciliationReportJSON(report: ReconciliationReport): FormattedReport {
  const getTxnDescription = (t: any): string => t.description || t.counterparty_name || 'Unknown';
  const getTxnDate = (t: any): string => t.transaction_date || t.date || 'Unknown';
  const getTxnAmount = (t: any): number => typeof t.amount === 'number' ? t.amount : 0;

  const topMatches = [...report.matches]
    .sort((a, b) => b.matchConfidence - a.matchConfidence)
    .slice(0, 5)
    .map(match => ({
      confidence: match.matchConfidence,
      bankDescription: getTxnDescription(match.bankTxn),
      stripeDescription: getTxnDescription(match.stripeTxn),
      amount: getTxnAmount(match.bankTxn),
      bankDate: getTxnDate(match.bankTxn),
      stripeDate: getTxnDate(match.stripeTxn)
    }));

  const unmatchedStripe = report.unmatchedStripeTxns.map(txn => ({
    description: getTxnDescription(txn),
    amount: getTxnAmount(txn),
    date: getTxnDate(txn)
  }));

  const unmatchedBank = report.unmatchedBankTxns.map(txn => ({
    description: getTxnDescription(txn),
    amount: getTxnAmount(txn),
    date: getTxnDate(txn)
  }));

  return {
    summary: {
      totalBankTxns: report.summary.totalBankTxns,
      totalStripeTxns: report.summary.totalStripeTxns,
      matchedCount: report.summary.matchedBankTxnsCount,
      matchRate: report.summary.matchRate,
      unmatchedBankCount: report.summary.unmatchedBankTxnsCount,
      unmatchedStripeCount: report.summary.unmatchedStripeTxnsCount
    },
    topMatches,
    unmatchedStripe,
    unmatchedBank
  };
}
