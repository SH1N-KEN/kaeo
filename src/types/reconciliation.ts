import type { NormalizedTransaction } from './finance';

export interface ReconciliationRecord {
  id?: string;
  transaction: NormalizedTransaction;
}

export interface ReconciliationMatchResult {
  processorRecord: ReconciliationRecord;
  bankRecord?: ReconciliationRecord;
  decision: {
    status: 'MATCHED' | 'REVIEW' | 'UNRESOLVED' | 'PENDING' | 'PROCESSING' | 'CHARGEBACK' | 'DUPLICATE';
    reason: string;
    verificationPassed: boolean;
    evidence: {
      confidenceScore: number;
      amountExact: boolean;
      amountDifference: number;
      feeAdjusted: boolean;
      dateWithinWindow: boolean;
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
  };
  results: ReconciliationMatchResult[];
  outOfScopeBankTxns: NormalizedTransaction[];
}
