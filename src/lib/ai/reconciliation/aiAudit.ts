import { supabase } from '../../supabase';

export interface AIEvaluationAuditRecord {
  timestamp: string;
  reconciliationRecordId: string;
  aiProvider: string;
  inputEvidenceIdentifiers: {
    processorTxId?: string | null;
    bankTxId?: string | null;
    processorAmount?: number;
    bankAmount?: number;
  };
  deterministicResult: {
    status: string;
    reason: string;
    confidenceScore: number;
  };
  aiDiagnosis: string;
  aiRecommendation: string;
  aiConfidence: number;
  verificationResult: string; // 'VERIFIED_REVIEW' | 'VERIFICATION_FAILED'
  finalDisposition: string; // 'APPROVED' | 'EVIDENCE_REQUESTED' | 'DISMISSED' | 'PENDING'
  humanAction?: string | null;
}

/**
 * Persists an AI investigation audit log entry to the database.
 * 
 * Uses the existing `audit_events` table for clean authorization, policy checks, and indexing.
 */
export async function recordAIEvaluationAudit(
  organizationId: string,
  audit: AIEvaluationAuditRecord
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!organizationId) {
      console.warn('[AI Audit] Cannot track audit trail without organizationId');
      return;
    }

    const cleanRecordId = audit.reconciliationRecordId.startsWith('virtual-') 
      ? null 
      : audit.reconciliationRecordId;

    const { error } = await supabase.from('audit_events').insert({
      organization_id: organizationId,
      actor_id: user?.id || null,
      action: 'reconciliation_ai_investigation',
      entity_type: 'reconciliation_record',
      entity_id: cleanRecordId,
      metadata: {
        ...audit,
        is_ai_reconciliation: true,
      }
    });

    if (error) {
      console.error('[AI Audit] Failed to record AI investigation event:', error);
    }
  } catch (err) {
    console.error('[AI Audit] Exception while recording AI investigation audit:', err);
  }
}
