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
  
  // Identify processor duplicates
  const isProcessorDuplicate = (txn: NormalizedTransaction, index: number, arr: NormalizedTransaction[]): boolean => {
    return arr.some((other, idx) => 
      idx !== index && 
      other.amount === txn.amount && 
      other.transaction_date === txn.transaction_date && 
      other.description === txn.description
    );
  };

  // Track bank transactions pool
  let remainingBank = [...bankTxns];

  // Processor records mapping and classification into Eligible vs events
  const processorRecordsWithStatus = processorTxns.map((txn, index, arr) => {
    let status: 'MATCHED' | 'REVIEW' | 'UNRESOLVED' | 'PENDING' | 'PROCESSING' | 'CHARGEBACK' | 'REFUND' | 'DUPLICATE' = 'UNRESOLVED';
    let reason = 'Unmatched processor record';
    let isEligible = true;
    
    const descLower = (txn.description || '').toLowerCase();
    const typeLower = (txn.type || '').toLowerCase();
    
    if (isProcessorDuplicate(txn, index, arr)) {
      status = 'DUPLICATE';
      reason = 'Duplicate processor record detected';
      isEligible = false;
    } else if (descLower.includes('pending') || typeLower.includes('pending')) {
      status = 'PENDING';
      reason = 'Pending settlement';
      isEligible = false;
    } else if (descLower.includes('processing') || typeLower.includes('processing')) {
      status = 'PROCESSING';
      reason = 'Processing settlement';
      isEligible = false;
    } else if (descLower.includes('chargeback') || typeLower.includes('chargeback')) {
      status = 'CHARGEBACK';
      reason = 'Chargeback exception';
      isEligible = false;
    } else if (descLower.includes('refund') || typeLower.includes('refund') || txn.amount < 0) {
      status = 'REFUND';
      reason = 'Customer refund event';
      isEligible = false;
    }
    
    return {
      transaction: txn,
      initialStatus: status,
      initialReason: reason,
      isEligible
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
    const { transaction, initialStatus, initialReason, isEligible } = procRecord;
    const record: ReconciliationRecord = { transaction };
    
    if (!isEligible) {
      // Excluded from matching, put straight into results as processor event
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
        auditTrail: [`Transaction categorized as processor event (${initialStatus}): ${initialReason}`]
      });
      continue;
    }

    // Try to match eligible processor records
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
          `Eligible processor record: ${transaction.description} (${transaction.transaction_date.slice(0,10)})`,
          `Matching bank record found: ${bestBankMatch.description} (${bestBankMatch.transaction_date.slice(0,10)})`,
          `Confidence score: ${matchEvidence.confidenceScore}% (based on amount & date similarity)`,
          `Financial control verified: matched exactly within tolerance window.`
        ]
      });
    } else {
      results.push({
        processorRecord: record,
        decision: {
          status: 'UNRESOLVED',
          reason: `No matching deposit found in bank statement`,
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
          `Eligible processor record: ${transaction.description} (${transaction.transaction_date.slice(0,10)})`,
          `Scan completed: no bank statement entry matches amount ₹${Math.abs(transaction.amount)} within ±2 days.`,
          `Exception raised: status set to UNRESOLVED.`
        ]
      });
    }
  }

  // Classify remaining unmatched bank transactions
  const activeProcessor = processorTxns[0]?.source_provider || 'Stripe';

  const isProcessorRelated = (desc: string): boolean => {
    const dLower = desc.toLowerCase();
    
    // Operating expenses or payroll are always out of scope
    if (dLower.includes('salary') || dLower.includes('payroll') || dLower.includes('operating expense')) {
      return false;
    }
    
    if (activeProcessor.toLowerCase() === 'razorpay') {
      if (dLower.includes('stripe')) return false;
      return dLower.includes('razorpay') || dLower.includes('payout') || dLower.includes('settlement') || dLower.includes('gateway');
    } else {
      if (dLower.includes('razorpay')) return false;
      return dLower.includes('stripe') || dLower.includes('payout') || dLower.includes('settlement') || dLower.includes('gateway');
    }
  };

  const outOfScopeBankTxns: NormalizedTransaction[] = [];
  
  for (const bankTxn of remainingBank) {
    if (isProcessorRelated(bankTxn.description)) {
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
          `In-scope bank statement transaction: ${bankTxn.description} (${bankTxn.transaction_date.slice(0,10)})`,
          `Scan completed: no matching payout recorded on payment processor.`,
          `Exception raised: unresolved settlement discrepancy.`
        ]
      });
    } else {
      // Out of scope
      outOfScopeBankTxns.push(bankTxn);
      results.push({
        processorRecord: {
          transaction: {
            id: `virtual-out-of-scope-${bankTxn.id}`,
            organization_id: bankTxn.organization_id,
            client_id: bankTxn.client_id,
            import_id: null,
            file_id: null,
            transaction_date: bankTxn.transaction_date,
            description: 'Non-processor Activity',
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
          status: 'OUT_OF_SCOPE',
          reason: `Non-processor bank transaction`,
          verificationPassed: true,
          evidence: {
            confidenceScore: 0,
            amountExact: false,
            amountDifference: 0,
            feeAdjusted: false,
            dateWithinWindow: false
          }
        },
        auditTrail: [
          `Non-processor bank statement transaction: ${bankTxn.description} (${bankTxn.transaction_date.slice(0,10)})`,
          `Scan completed: transaction is classified as out of scope.`
        ]
      });
    }
  }

  // Calculate summary metrics
  const totalProcessorRecords = processorTxns.length;
  
  const matchedCount = results.filter(r => r.decision.status === 'MATCHED').length;
  const reviewCount = results.filter(r => r.decision.status === 'REVIEW').length;
  
  const unresolvedCount = results.filter(r => 
    r.decision.status === 'UNRESOLVED' && 
    r.processorRecord && 
    !r.processorRecord.transaction.id.startsWith('virtual-')
  ).length;

  const unresolvedBankCount = results.filter(r => 
    r.decision.status === 'UNRESOLVED' && 
    r.processorRecord && 
    r.processorRecord.transaction.id.startsWith('virtual-missing-proc-')
  ).length;

  const pendingCount = results.filter(r => 
    r.decision.status === 'PENDING' || 
    r.decision.status === 'PROCESSING' || 
    r.decision.status === 'CHARGEBACK' || 
    r.decision.status === 'REFUND'
  ).length;

  const duplicateCount = results.filter(r => r.decision.status === 'DUPLICATE').length;
  const outOfScopeCount = outOfScopeBankTxns.length;

  const eligibleProcessorRecords = totalProcessorRecords - pendingCount - duplicateCount;
  
  const reconciledValue = results
    .filter(r => r.decision.status === 'MATCHED' && r.bankRecord)
    .reduce((sum, r) => sum + Math.abs(r.bankRecord!.transaction.amount), 0);

  const matchRate = eligibleProcessorRecords > 0 ? (matchedCount / eligibleProcessorRecords) * 100 : 0;

  const difference = results
    .filter(r => r.decision.status === 'UNRESOLVED')
    .reduce((sum, r) => {
      const procAmt = r.processorRecord && !r.processorRecord.transaction.id.startsWith('virtual-') ? r.processorRecord.transaction.amount : 0;
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
      unresolvedCount: unresolvedCount + unresolvedBankCount,
      pendingCount,
      duplicateCount,
      outOfScopeCount
    },
    results,
    outOfScopeBankTxns
  };
}
