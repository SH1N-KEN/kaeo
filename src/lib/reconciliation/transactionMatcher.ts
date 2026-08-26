import type { NormalizedTransaction } from '../../types/finance';
import type { ReconciliationMatch } from './reconciliationEngine';

/**
 * Finds the best match for a bank transaction from a list of Stripe transactions.
 * Match criteria: merchant similarity > 80%, amount equal (±1), dates within 2 days.
 * 
 * @param bankTxn The bank transaction to match
 * @param stripeTxns The list of Stripe transactions to search within
 * @returns The best reconciliation match found, or null if no match meets the criteria
 */
export function findMatchForBankTxn(
  bankTxn: NormalizedTransaction,
  stripeTxns: NormalizedTransaction[]
): ReconciliationMatch | null {
  // Stub implementation
  return null;
}
