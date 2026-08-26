import type { NormalizedTransaction } from '../../types/finance';
import type { ReconciliationMatch } from './reconciliationEngine';
import { merchantSimilarity } from './merchantMatcher';

export interface MatchCriteria {
  merchantSimilarityThreshold?: number; // default 80 (0-100)
  amountTolerance?: number;             // default 1 (rupees)
  dateTolerance?: number;               // default 2 (days)
}

/**
 * Finds the best match for a bank transaction from a list of Stripe transactions.
 * Match criteria: merchant similarity > 80%, amount equal (±1), dates within 2 days.
 * 
 * @param bankTxn The bank transaction to match
 * @param stripeTxns The list of Stripe transactions to search within
 * @param criteria Optional customization parameters for the match criteria
 * @returns The best reconciliation match found, or null if no match meets the criteria
 */
export function findMatchForBankTxn(
  bankTxn: NormalizedTransaction,
  stripeTxns: NormalizedTransaction[],
  criteria: MatchCriteria = {}
): ReconciliationMatch | null {
  const threshold = criteria.merchantSimilarityThreshold ?? 80;
  const amountTolerance = criteria.amountTolerance ?? 1;
  const dateTolerance = criteria.dateTolerance ?? 2;

  const getTxnDate = (t: any): string => t.transaction_date || t.date || '';
  const getTxnDescription = (t: any): string => t.description || t.counterparty_name || '';
  const getTxnAmount = (t: any): number => typeof t.amount === 'number' ? t.amount : 0;

  const isSameDay = (d1Str: string, d2Str: string): boolean => {
    const d1 = new Date(d1Str);
    const d2 = new Date(d2Str);
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const getDateDiffInDays = (d1Str: string, d2Str: string): number => {
    const d1 = new Date(d1Str);
    const d2 = new Date(d2Str);
    const diffMs = Math.abs(d1.getTime() - d2.getTime());
    return diffMs / (1000 * 60 * 60 * 24);
  };

  let bestMatch: ReconciliationMatch | null = null;
  let highestConfidence = -1;

  for (const stripeTxn of stripeTxns) {
    const similarity = merchantSimilarity(getTxnDescription(bankTxn), getTxnDescription(stripeTxn));
    if (similarity < threshold) continue;

    // Compare using absolute values of amounts to handle potential sign differences (e.g. Withdrawal vs Deposit representation)
    const amountDiff = Math.abs(Math.abs(getTxnAmount(bankTxn)) - Math.abs(getTxnAmount(stripeTxn)));
    if (amountDiff > amountTolerance) continue;

    const bankDateStr = getTxnDate(bankTxn);
    const stripeDateStr = getTxnDate(stripeTxn);
    const dateDiffDays = getDateDiffInDays(bankDateStr, stripeDateStr);
    if (dateDiffDays > dateTolerance) continue;

    // Calculate confidence score
    let confidence = similarity;
    if (Math.abs(getTxnAmount(bankTxn)) === Math.abs(getTxnAmount(stripeTxn))) {
      confidence += 10;
    }
    if (isSameDay(bankDateStr, stripeDateStr)) {
      confidence += 5;
    }
    confidence = Math.min(100, confidence);

    if (confidence > highestConfidence) {
      highestConfidence = confidence;

      const dBank = new Date(bankDateStr);
      const dStripe = new Date(stripeDateStr);
      const diffDaysRounded = Math.round((dStripe.getTime() - dBank.getTime()) / (1000 * 60 * 60 * 24));
      
      let dateText = '';
      if (diffDaysRounded === 0) {
        dateText = 'Date exact';
      } else {
        dateText = `Date ${diffDaysRounded > 0 ? '+' : ''}${diffDaysRounded} day${Math.abs(diffDaysRounded) === 1 ? '' : 's'}`;
      }

      const amtText = amountDiff === 0 ? 'Amount exact' : `Amount diff ${amountDiff.toFixed(2)}`;
      const similarityText = `Merchant ${Math.round(similarity)}%`;
      
      bestMatch = {
        bankTxn,
        stripeTxn,
        matchConfidence: confidence,
        matchType: confidence > 95 ? 'exact' : 'fuzzy',
        reason: `${similarityText}, ${amtText}, ${dateText}`
      };
    }
  }

  return bestMatch;
}
