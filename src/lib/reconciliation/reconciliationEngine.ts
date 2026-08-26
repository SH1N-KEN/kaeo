import type { NormalizedTransaction } from '../../types/finance';

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
  return {
    summary: {
      totalBankTxns: bankTxns.length,
      totalStripeTxns: stripeTxns.length,
      matchedBankTxnsCount: 0,
      matchedStripeTxnsCount: 0,
      unmatchedBankTxnsCount: bankTxns.length,
      unmatchedStripeTxnsCount: stripeTxns.length,
      matchRate: 0,
    },
    matches: [],
    timestamp: new Date().toISOString(),
  };
}
