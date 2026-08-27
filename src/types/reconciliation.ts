import type { NormalizedTransaction } from './finance';

export interface ReconciliationRecord {
  id?: string;
  transaction: NormalizedTransaction;
}

export interface ReconciliationMatchResult {
  processorRecord: ReconciliationRecord;
  bankRecord?: ReconciliationRecord;
  decision: {
    status: 'MATCHED' | 'REVIEW' | 'UNRESOLVED' | 'PENDING' | 'PROCESSING' | 'CHARGEBACK' | 'DUPLICATE' | 'REFUND' | 'OUT_OF_SCOPE';
    reason: string;
    verificationPassed: boolean;
    evidence: {
      confidenceScore: number;
      amountExact: boolean;
      amountDifference: number;
      feeAdjusted: boolean;
      dateWithinWindow: boolean;
      processorAmount?: number;
      bankAmount?: number;
      normalizedSettlementAmount?: number;
      directionallyValid?: boolean;
      absoluteAmountMatch?: boolean;
    };
  };
  auditTrail: string[];
}

export interface ReconciliationRunResult {
  summary: {
    reconciledValue: number;
    eligibleProcessorRecords: number;
    totalProcessorRecords: number;
    difference: number;
    matchRate: number;
    matchedCount: number;
    reviewCount: number;
    unresolvedCount: number;
    pendingCount: number;
    duplicateCount: number;
    outOfScopeCount: number;
    
    // Canonical summary metrics
    processorTotal: number;
    eligibleSettlementCount: number;
    matchedSettlementCount: number;
    unresolvedSettlementCount: number;
    processingCount: number;
    refundCount: number;
    chargebackCount: number;
    outOfScopeBankCount: number;
    unresolvedExposure: number;
  };
  results: ReconciliationMatchResult[];
  outOfScopeBankTxns: NormalizedTransaction[];
}
