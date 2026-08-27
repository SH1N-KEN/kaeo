import type { NormalizedTransaction } from '../../types/finance';
import { findMatchForBankTxn } from './transactionMatcher';

import type { ReconciliationMode } from './transactionMatcher';
import type { ReconciliationRunResult, ReconciliationMatchResult, ReconciliationRecord } from '../../types/reconciliation';

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
 * @param mode Matching strategy ('merchant' or 'processor')
 * @returns A reconciliation report containing match details and summary statistics
 */
export function reconcileTransactions(
  bankTxns: NormalizedTransaction[],
  stripeTxns: NormalizedTransaction[],
  mode: ReconciliationMode = 'merchant'
): ReconciliationReport {
  const matches: ReconciliationMatch[] = [];
  const unmatchedBankTxns: NormalizedTransaction[] = [];
  
  // Clone the Stripe transactions array to track the pool of available matches
  let remainingStripe = [...stripeTxns];

  for (const bankTxn of bankTxns) {
    const match = findMatchForBankTxn(bankTxn, remainingStripe, {}, mode);
    if (match) {
      matches.push(match);
      // Remove matched Stripe transaction from the pool to prevent double matching
      // Using reference comparison to avoid issues with missing transaction IDs
      remainingStripe = remainingStripe.filter(s => s !== match.stripeTxn);
    } else {
      unmatchedBankTxns.push(bankTxn);
    }
  }

  const matchedBankCount = matches.length;
  const matchedStripeCount = stripeTxns.length - remainingStripe.length;
  const totalBankTxns = bankTxns.length;
  // Calculate match rate based on the percentage of Stripe transactions reconciled
  const matchRate = stripeTxns.length > 0 ? (matchedStripeCount / stripeTxns.length) * 100 : 0;

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

export async function reconcileTransactionsPipeline(
  bankTxns: NormalizedTransaction[],
  processorTxns: NormalizedTransaction[]
): Promise<ReconciliationRunResult> {
  const results: ReconciliationMatchResult[] = [];
  
  // 1. Identify processor duplicates
  // A processor record is a duplicate if there exists another record with identical amount, date, and description.
  const isProcessorDuplicate = (txn: NormalizedTransaction, index: number, arr: NormalizedTransaction[]): boolean => {
    return arr.some((other, idx) => 
      idx !== index && 
      other.amount === txn.amount && 
      other.transaction_date === txn.transaction_date && 
      other.description === txn.description
    );
  };

  // Clone processor transactions to categorize them
  // Track bank transactions pool
  let remainingBank = [...bankTxns];

  // Processor records mapping
  const processorRecordsWithStatus = processorTxns.map((txn, index, arr) => {
    let status: 'MATCHED' | 'REVIEW' | 'UNRESOLVED' | 'PENDING' | 'PROCESSING' | 'CHARGEBACK' | 'DUPLICATE' = 'UNRESOLVED';
    let reason = 'Unmatched processor record';
    
    const descLower = (txn.description || '').toLowerCase();
    
    if (isProcessorDuplicate(txn, index, arr)) {
      status = 'DUPLICATE';
      reason = 'Duplicate processor record detected';
    } else if (descLower.includes('pending')) {
      status = 'PENDING';
      reason = 'Pending settlement';
    } else if (descLower.includes('processing')) {
      status = 'PROCESSING';
      reason = 'Processing settlement';
    } else if (descLower.includes('chargeback')) {
      status = 'CHARGEBACK';
      reason = 'Chargeback exception';
    }
    
    return {
      transaction: txn,
      initialStatus: status,
      initialReason: reason
    };
  });

  // Helper to check if date is exact or near
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

  // Reconcile eligible records
  for (const procRecord of processorRecordsWithStatus) {
    const { transaction, initialStatus, initialReason } = procRecord;
    
    const record: ReconciliationRecord = { transaction };
    
    if (initialStatus !== 'UNRESOLVED') {
      // Non-eligible (Pending, Processing, Chargeback, Duplicate)
      results.push({
        processorRecord: record,
        decision: {
          status: initialStatus,
          reason: initialReason,
          verificationPassed: initialStatus === 'PENDING' || initialStatus === 'PROCESSING',
          evidence: {
            confidenceScore: 0,
            amountExact: false,
            amountDifference: 0,
            feeAdjusted: false,
            dateWithinWindow: false
          }
        },
        auditTrail: [`Transaction categorized as ${initialStatus}: ${initialReason}`]
      });
      continue;
    }

    // Eligible transaction: try to match
    let bestBankMatch: NormalizedTransaction | null = null;
    let highestScore = -1;
    let matchEvidence = {
      confidenceScore: 0,
      amountExact: false,
      amountDifference: 0,
      feeAdjusted: false,
      dateWithinWindow: false
    };

    for (const bankTxn of remainingBank) {
      const amountDiff = Math.abs(Math.abs(transaction.amount) - Math.abs(bankTxn.amount));
      if (amountDiff > 1.0) continue; // amount tolerance is 1 rupee

      const dateDiff = getDateDiffInDays(transaction.transaction_date, bankTxn.transaction_date);
      if (dateDiff > 2.0) continue; // date tolerance is 2 days

      // Calculate confidence score dynamically
      const descSimilarity = (txn1: string, txn2: string): number => {
        const tokens1 = new Set(txn1.toLowerCase().split(/[^a-z0-9]/).filter(t => t.length > 2));
        const tokens2 = new Set(txn2.toLowerCase().split(/[^a-z0-9]/).filter(t => t.length > 2));
        if (tokens1.size === 0 || tokens2.size === 0) return 0;
        
        let intersection = 0;
        for (const t of tokens1) {
          if (tokens2.has(t)) intersection++;
        }
        return (intersection / Math.max(tokens1.size, tokens2.size)) * 10;
      };

      const similarityBonus = descSimilarity(transaction.description, bankTxn.description);
      let baseConfidence = 50;
      if (isSameDay(transaction.transaction_date, bankTxn.transaction_date)) {
        baseConfidence = 90;
      } else if (dateDiff <= 1.0) {
        baseConfidence = 75;
      }

      const score = baseConfidence + similarityBonus;

      if (score > highestScore) {
        highestScore = score;
        bestBankMatch = bankTxn;
        matchEvidence = {
          confidenceScore: Math.round(score),
          amountExact: amountDiff === 0,
          amountDifference: amountDiff,
          feeAdjusted: false,
          dateWithinWindow: true
        };
      }
    }

    if (bestBankMatch) {
      // Matched!
      remainingBank = remainingBank.filter(b => b !== bestBankMatch);
      
      results.push({
        processorRecord: record,
        bankRecord: { transaction: bestBankMatch },
        decision: {
          status: 'MATCHED',
          reason: `Matched bank transaction: ${bestBankMatch.description}`,
          verificationPassed: true,
          evidence: matchEvidence
        },
        auditTrail: [
          `Eligible processor record: ${transaction.description} (${transaction.transaction_date})`,
          `Matching bank record found: ${bestBankMatch.description} (${bestBankMatch.transaction_date})`,
          `Confidence score: ${matchEvidence.confidenceScore}% (based on amount & date similarity)`,
          `Financial control verified: matched exactly within tolerance window.`
        ]
      });
    } else {
      // Unmatched eligible processor record -> REVIEW/UNRESOLVED
      const descLower = (transaction.description || '').toLowerCase();
      const isRefund = descLower.includes('refund') || transaction.amount < 0;
      const status: 'REVIEW' | 'UNRESOLVED' = isRefund ? 'REVIEW' : 'UNRESOLVED';
      
      results.push({
        processorRecord: record,
        decision: {
          status,
          reason: isRefund ? 'Refund settlement pending bank confirmation' : 'No matching deposit found in bank statement',
          verificationPassed: false,
          evidence: {
            confidenceScore: 0,
            amountExact: false,
            amountDifference: Math.abs(transaction.amount),
            feeAdjusted: false,
            dateWithinWindow: false
          }
        },
        auditTrail: [
          `Eligible processor record: ${transaction.description} (${transaction.transaction_date})`,
          `Scan completed: no bank statement entry matches amount ₹${Math.abs(transaction.amount)} within ±2 days.`,
          `Exception raised: status set to ${status}.`
        ]
      });
    }
  }

  // 2. Classify remaining unmatched bank transactions
  const processorKeywords = ['stripe', 'razorpay', 'payout', 'settlement', 'payment gateway'];
  const isProcessorRelated = (desc: string): boolean => {
    const dLower = desc.toLowerCase();
    return processorKeywords.some(kw => dLower.includes(kw));
  };

  const outOfScopeBankTxns: NormalizedTransaction[] = [];
  
  for (const bankTxn of remainingBank) {
    if (isProcessorRelated(bankTxn.description)) {
      // In-scope unmatched bank record (discrepancy)
      results.push({
        processorRecord: {
          transaction: {
            id: `virtual-missing-proc-${bankTxn.id}`,
            organization_id: bankTxn.organization_id,
            client_id: bankTxn.client_id,
            import_id: null,
            file_id: null,
            transaction_date: bankTxn.transaction_date,
            description: 'Missing Processor Transaction',
            amount: 0,
            currency: bankTxn.currency,
            type: 'unknown',
            raw_row_json: null,
            category: null,
            counterparty_name: null,
            source_provider: null
          }
        },
        bankRecord: { transaction: bankTxn },
        decision: {
          status: 'UNRESOLVED',
          reason: `Bank payout received but corresponding processor transaction is missing`,
          verificationPassed: false,
          evidence: {
            confidenceScore: 0,
            amountExact: false,
            amountDifference: Math.abs(bankTxn.amount),
            feeAdjusted: false,
            dateWithinWindow: false
          }
        },
        auditTrail: [
          `In-scope bank statement transaction: ${bankTxn.description} (${bankTxn.transaction_date})`,
          `Scan completed: no matching payout recorded on payment processor.`,
          `Exception raised: unresolved settlement discrepancy.`
        ]
      });
    } else {
      outOfScopeBankTxns.push(bankTxn);
    }
  }

  // Calculate summary metrics
  const matchedCount = results.filter(r => r.decision.status === 'MATCHED').length;
  const reviewCount = results.filter(r => r.decision.status === 'REVIEW').length;
  const unresolvedCount = results.filter(r => r.decision.status === 'UNRESOLVED').length;
  const pendingCount = results.filter(r => r.decision.status === 'PENDING' || r.decision.status === 'PROCESSING').length;
  const duplicateCount = results.filter(r => r.decision.status === 'DUPLICATE').length;
  const chargebackCount = results.filter(r => r.decision.status === 'CHARGEBACK').length;

  const totalProcessorRecords = processorTxns.length;
  const nonEligibleCount = pendingCount + chargebackCount;
  const eligibleProcessorRecords = totalProcessorRecords - nonEligibleCount;
  
  const reconciledValue = results
    .filter(r => r.decision.status === 'MATCHED' && r.bankRecord)
    .reduce((sum, r) => sum + Math.abs(r.bankRecord!.transaction.amount), 0);

  const matchRate = eligibleProcessorRecords > 0 ? (matchedCount / eligibleProcessorRecords) * 100 : 0;

  const difference = results
    .filter(r => r.decision.status === 'UNRESOLVED' || r.decision.status === 'REVIEW')
    .reduce((sum, r) => {
      const procAmt = r.processorRecord.transaction.amount;
      const bankAmt = r.bankRecord ? r.bankRecord.transaction.amount : 0;
      return sum + Math.abs(procAmt || bankAmt);
    }, 0);

  return {
    summary: {
      reconciledValue,
      eligibleProcessorRecords,
      totalProcessorRecords,
      difference,
      matchRate,
      matchedCount,
      reviewCount,
      unresolvedCount,
      pendingCount: pendingCount + chargebackCount,
      duplicateCount,
      outOfScopeCount: outOfScopeBankTxns.length
    },
    results,
    outOfScopeBankTxns
  };
}
