import { supabase } from './supabase';

export type AuditAction = 
  | 'transaction_marked_reviewed'
  | 'transaction_marked_needs_review'
  | 'transaction_marked_ignored'
  | 'transaction_resolved'
  | 'risk_resolved'
  | 'risk_ignored'
  | 'risk_review_started'
  | 'spend_rule_updated'
  | 'spend_rule_created'
  | 'accountant_pack_generated'
  | 'vendor_reviewed'
  | 'ai_suggestion_approved'
  | 'ai_suggestion_rejected'
  | 'ai_bulk_review_applied'
  | 'transaction_ai_categorized'
  | 'risk_ai_flagged'
  | 'invoice_matched_by_ai'
  | 'libby_action_prepared'
  | 'libby_action_approved'
  | 'libby_action_applied'
  | 'libby_action_rejected'
  | 'libby_bulk_action_applied';

export type AuditEntityType = 'transaction' | 'risk' | 'rule' | 'report' | 'vendor' | 'ai_suggestion' | 'invoice' | 'libby_action';

/**
 * Tracks an audit event in the database for compliance and review history.
 */
export const trackAuditEvent = async (
  organizationId: string,
  action: AuditAction,
  entityType?: AuditEntityType,
  entityId?: string,
  metadata?: Record<string, any>
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!organizationId) {
      console.warn('[Audit Engine] Cannot track event without organizationId');
      return;
    }

    const { error } = await supabase.from('audit_events').insert({
      organization_id: organizationId,
      actor_id: user?.id || null,
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      metadata: metadata || {}
    });

    if (error) {
      console.error('[Audit Engine] Failed to record audit event:', error);
    }
  } catch (err) {
    console.error('[Audit Engine] Exception while recording audit event:', err);
  }
};
