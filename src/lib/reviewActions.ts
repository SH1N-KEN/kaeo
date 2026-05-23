import { supabase } from './supabase';
import { trackAuditEvent } from './auditEngine';

/**
 * Applies or rejects an AI Review Suggestion and updates the target database entity.
 */
export async function applyReviewSuggestion(
  suggestion: any,
  status: 'approved' | 'rejected',
  userId?: string
) {
  const isApproved = status === 'approved';

  // 1. Update the suggestion status in the DB
  const { error: sugErr } = await supabase
    .from('ai_review_suggestions')
    .update({
      status: isApproved ? 'applied' : 'rejected',
      reviewed_by: userId || null,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', suggestion.id);

  if (sugErr) throw sugErr;

  if (isApproved) {
    // 2. Apply modifications to the target entity depending on its type
    if (suggestion.entity_type === 'transaction') {
      const updates: any = {};
      if (suggestion.suggestion_type === 'categorize_transaction') {
        updates.category = suggestion.proposed_value.category;
      }
      if (suggestion.suggestion_type === 'mark_reviewed') {
        updates.review_status = 'reviewed';
        updates.reviewed_at = new Date().toISOString();
        updates.reviewed_by = userId || null;
      }
      if (suggestion.suggestion_type === 'mark_needs_review') {
        updates.review_status = 'needs_review';
      }

      const { error: txErr } = await supabase
        .from('transactions')
        .update(updates)
        .eq('id', suggestion.entity_id);

      if (txErr) throw txErr;

      // Track compliance audit event for the specific entity change
      await trackAuditEvent(
        suggestion.organization_id,
        'transaction_ai_categorized',
        'transaction',
        suggestion.entity_id,
        { proposed_value: suggestion.proposed_value, reason: suggestion.reason }
      );
    } else if (suggestion.entity_type === 'risk') {
      if (suggestion.suggestion_type === 'resolve_risk') {
        const { error: riskErr } = await supabase
          .from('risk_events')
          .update({
            status: 'resolved',
            reviewed_by: userId || null,
            reviewed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', suggestion.entity_id);

        if (riskErr) throw riskErr;

        // Track compliance audit event for risk resolution
        await trackAuditEvent(
          suggestion.organization_id,
          'risk_resolved',
          'risk',
          suggestion.entity_id,
          { action: 'resolve', source: 'ai_suggestion' }
        );
      }
    } else if (suggestion.entity_type === 'vendor') {
      if (suggestion.suggestion_type === 'flag_vendor') {
        const { error: vendorErr } = await supabase
          .from('vendors')
          .update({
            recommendation: suggestion.proposed_value.recommendation,
            updated_at: new Date().toISOString(),
          })
          .eq('id', suggestion.entity_id);

        if (vendorErr) throw vendorErr;

        // Track compliance audit event for vendor review
        await trackAuditEvent(
          suggestion.organization_id,
          'vendor_reviewed',
          'vendor',
          suggestion.entity_id,
          { recommendation: suggestion.proposed_value.recommendation }
        );
      }
    } else if (suggestion.entity_type === 'invoice') {
      if (suggestion.suggestion_type === 'match_invoice') {
        const { error: invErr } = await supabase
          .from('invoices')
          .update({
            status: 'matched',
            updated_at: new Date().toISOString(),
          })
          .eq('id', suggestion.entity_id);

        if (invErr) throw invErr;

        // Track compliance audit event for invoice matching
        await trackAuditEvent(
          suggestion.organization_id,
          'invoice_matched_by_ai',
          'invoice',
          suggestion.entity_id,
          { status: 'matched' }
        );
      } else if (suggestion.suggestion_type === 'mark_invoice_needs_review') {
        const { error: invErr } = await supabase
          .from('invoices')
          .update({
            status: 'needs_review',
            updated_at: new Date().toISOString(),
          })
          .eq('id', suggestion.entity_id);

        if (invErr) throw invErr;
      }
    }

    // Track suggestion approval audit
    await trackAuditEvent(
      suggestion.organization_id,
      'ai_suggestion_approved',
      'ai_suggestion' as any,
      suggestion.id,
      { entity_type: suggestion.entity_type, entity_id: suggestion.entity_id }
    );
  } else {
    // Track suggestion rejection audit
    await trackAuditEvent(
      suggestion.organization_id,
      'ai_suggestion_rejected',
      'ai_suggestion' as any,
      suggestion.id,
      { entity_type: suggestion.entity_type, entity_id: suggestion.entity_id }
    );
  }
}

/**
 * Applies or rejects multiple suggestions in bulk.
 */
export async function applyReviewSuggestionsBulk(
  suggestions: any[],
  status: 'approved' | 'rejected',
  userId?: string
) {
  for (const sug of suggestions) {
    await applyReviewSuggestion(sug, status, userId);
  }

  if (suggestions.length > 0 && status === 'approved') {
    await trackAuditEvent(
      suggestions[0].organization_id,
      'ai_bulk_review_applied',
      'ai_suggestion' as any,
      undefined,
      { count: suggestions.length }
    );
  }
}
