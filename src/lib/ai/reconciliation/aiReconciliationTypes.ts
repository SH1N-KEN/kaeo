import type { ReconciliationMatchResult, ReconciliationRecord } from '../../../types/reconciliation';

export type AIDiagnosis =
  | 'PROBABLE_PROCESSOR_FEE'
  | 'POSSIBLE_DUPLICATE'
  | 'POSSIBLE_DATE_SHIFT'
  | 'POSSIBLE_PARTIAL_SETTLEMENT'
  | 'MISSING_BANK_RECORD'
  | 'MISSING_PROCESSOR_RECORD'
  | 'POSSIBLE_REFUND'
  | 'POSSIBLE_CHARGEBACK'
  | 'INSUFFICIENT_EVIDENCE'
  | 'UNRELATED_TRANSACTION'
  | 'UNKNOWN';

export type AIRecommendation =
  | 'REVIEW'
  | 'ESCALATE'
  | 'NO_ACTION'
  | 'REQUEST_EVIDENCE';

export interface AIEvidenceItem {
  type: string;
  value: any;
}

export interface AIInvestigationOutput {
  diagnosis: AIDiagnosis;
  explanation: string;
  evidence: AIEvidenceItem[];
  recommendation: AIRecommendation;
  confidence: number;
  required_human_action: boolean;
  reasoning_summary: string;
  risk_flags: string[];
}

export interface AIExceptionResolverInput {
  reconciliationRecord: ReconciliationMatchResult;
  processorRecord: ReconciliationRecord;
  bankRecord?: ReconciliationRecord;
  candidateMatches: ReconciliationRecord[];
  evidence: ReconciliationMatchResult['decision']['evidence'];
  deterministicStatus: ReconciliationMatchResult['decision']['status'];
  deterministicConfidence: number;
  historicalContext?: any;
}

export interface ReconciliationAIProvider {
  name: string;
  investigateException(input: AIExceptionResolverInput): Promise<AIInvestigationOutput>;
}
