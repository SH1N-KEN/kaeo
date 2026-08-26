import type { NormalizedTransaction } from '../../types/finance';
import { findMatchForBankTxn } from './transactionMatcher';

export interface ReconciliationMatch {
  bankTxn: NormalizedTransaction;
  stripeTxn: NormalizedTransaction;
  matchConfidence: number; // Similarity confidence percentage (0-100)
  matchType: string;       // e.g., 'exact', 'partial', or 'none'
  reason: string;          // Reason explaining the match or lack thereof
}

export interface ReconciliationReport {
  summary: {
    totalBankTxns: number;
    totalStripeTxns: number;
    matchedBankTxnsCount: number;
    matchedStripeTxnsCount: number;
    unmatchedBankTxnsCount: number;
    unmatchedStripeTxnsCount: number;
    matchRate: number;      // Percentage of bank transactions matched (0-100)
  };
  matches: ReconciliationMatch[];
  unmatchedBankTxns: NormalizedTransaction[];
  unmatchedStripeTxns: NormalizedTransaction[];
  timestamp: string;        // ISO timestamp of reconciliation run
}

/**
 * Reconciles a list of bank transactions against a list of Stripe transactions.
 * 
 * @param bankTxns Array of normalized bank transactions
 * @param stripeTxns Array of normalized Stripe transactions
 * @returns A reconciliation report containing match details and summary statistics
 */
export function reconcileTransactions(
  bankTxns: NormalizedTransaction[],
  stripeTxns: NormalizedTransaction[]
): ReconciliationReport {
  const matches: ReconciliationMatch[] = [];
  const unmatchedBankTxns: NormalizedTransaction[] = [];
  
  // Clone the Stripe transactions array to track the pool of available matches
  let remainingStripe = [...stripeTxns];

  for (const bankTxn of bankTxns) {
    const match = findMatchForBankTxn(bankTxn, remainingStripe);
    if (match) {
      matches.push(match);
      // Remove matched Stripe transaction from the pool to prevent double matching
      remainingStripe = remainingStripe.filter(s => s.id !== match.stripeTxn.id);
    } else {
      unmatchedBankTxns.push(bankTxn);
    }
  }

  const matchedBankCount = matches.length;
  const matchedStripeCount = stripeTxns.length - remainingStripe.length;
  const totalBankTxns = bankTxns.length;
  const matchRate = totalBankTxns > 0 ? (matchedBankCount / totalBankTxns) * 100 : 0;

  return {
    summary: {
      totalBankTxns,
      totalStripeTxns: stripeTxns.length,
      matchedBankTxnsCount: matchedBankCount,
      matchedStripeTxnsCount: matchedStripeCount,
      unmatchedBankTxnsCount: unmatchedBankTxns.length,
      unmatchedStripeTxnsCount: remainingStripe.length,
      matchRate,
    },
    matches,
    unmatchedBankTxns,
    unmatchedStripeTxns: remainingStripe,
    timestamp: new Date().toISOString(),
  };
}
