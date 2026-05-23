import { supabase } from './supabase';
import { inferTransactionCategory, getDisplayCategory } from './categoryEngine';
import { calculateMonthEndReadiness } from './readinessEngine';

export interface AIReviewSuggestion {
  id?: string;
  organization_id: string;
  client_id: string | null;
  entity_type: 'transaction' | 'risk' | 'vendor' | 'invoice';
  entity_id: string;
  suggestion_type:
    | 'categorize_transaction'
    | 'mark_reviewed'
    | 'mark_needs_review'
    | 'resolve_risk'
    | 'ignore_risk'
    | 'flag_vendor'
    | 'match_invoice'
    | 'mark_invoice_needs_review';
  proposed_value: any;
  reason: string;
  confidence: number;
  priority: 'low' | 'medium' | 'high';
  requires_approval: boolean;
  status?: 'pending' | 'approved' | 'rejected' | 'applied' | 'expired';
}

/**
 * AI review suggestions generator for transactions
 */
export function generateTransactionReviewSuggestions(
  transactions: any[],
  context: { organization_id: string; client_id: string }
): AIReviewSuggestion[] {
  const suggestions: AIReviewSuggestion[] = [];

  transactions.forEach((tx) => {
    const displayCat = getDisplayCategory(tx);
    const amountAbs = Math.abs(tx.amount || 0);

    // 1. Uncategorized Transactions
    if (displayCat === 'Uncategorized') {
      const inferredCat = inferTransactionCategory(tx.description || '', tx.counterparty_name, tx.type);
      
      if (inferredCat !== 'Uncategorized') {
        // High confidence match, safe auto-review if below threshold
        const isSafe = amountAbs < 15000;
        suggestions.push({
          organization_id: context.organization_id,
          client_id: context.client_id,
          entity_type: 'transaction',
          entity_id: tx.id,
          suggestion_type: 'categorize_transaction',
          proposed_value: { category: inferredCat },
          reason: `Obvious SaaS/vendor mapping for description keywords. Suggests mapping to ${inferredCat}.`,
          confidence: 0.9,
          priority: isSafe ? 'low' : 'medium',
          requires_approval: !isSafe, // False for safe auto-review, true if large transaction
        });
      } else if (amountAbs >= 50000) {
        // Uncategorized high value payment needs review
        suggestions.push({
          organization_id: context.organization_id,
          client_id: context.client_id,
          entity_type: 'transaction',
          entity_id: tx.id,
          suggestion_type: 'mark_needs_review',
          proposed_value: { review_status: 'needs_review' },
          reason: `High-value expense (₹${amountAbs.toLocaleString('en-IN')}) lacks categorization and requires immediate review.`,
          confidence: 0.8,
          priority: 'high',
          requires_approval: true,
        });
      }
    } else {
      // 2. Already categorized - check if we can mark reviewed
      const isUnreviewed = !tx.review_status || tx.review_status === 'new' || tx.review_status === 'needs_review';
      if (isUnreviewed) {
        const isSafe = amountAbs < 15000;
        suggestions.push({
          organization_id: context.organization_id,
          client_id: context.client_id,
          entity_type: 'transaction',
          entity_id: tx.id,
          suggestion_type: 'mark_reviewed',
          proposed_value: { review_status: 'reviewed' },
          reason: `Fully categorized, low-risk transaction below threshold (₹${amountAbs.toLocaleString('en-IN')}). Safe to mark reviewed.`,
          confidence: 0.95,
          priority: 'low',
          requires_approval: !isSafe, // If under 15k, no approval required (safe auto-review)
        });
      }
    }
  });

  return suggestions;
}

/**
 * AI review suggestions generator for risks
 */
export function generateRiskReviewSuggestions(
  risks: any[],
  _transactions: any[],
  _vendors: any[],
  _invoices: any[],
  context: { organization_id: string; client_id: string }
): AIReviewSuggestion[] {
  const suggestions: AIReviewSuggestion[] = [];

  risks.forEach((risk) => {
    if (risk.status !== 'open') return;

    if (risk.risk_type === 'duplicate_payment') {
      const amount = Number(risk.amount_at_risk || 0);
      const isHighPriority = amount >= 25000;
      
      suggestions.push({
        organization_id: context.organization_id,
        client_id: context.client_id,
        entity_type: 'risk',
        entity_id: risk.id,
        suggestion_type: 'resolve_risk',
        proposed_value: { status: 'resolved' },
        reason: `Potential duplicate payment detected for ${risk.title}. Review ledger and resolve risk.`,
        confidence: 0.8,
        priority: isHighPriority ? 'high' : 'medium',
        requires_approval: true, // Resolving duplicate risk always requires approval
      });
    } else if (risk.risk_type === 'invoice_payment_mismatch') {
      suggestions.push({
        organization_id: context.organization_id,
        client_id: context.client_id,
        entity_type: 'risk',
        entity_id: risk.id,
        suggestion_type: 'match_invoice',
        proposed_value: { status: 'resolved' },
        reason: `Scan amount mismatch. Verify scanned receipt amount against transaction payment and resolve.`,
        confidence: 0.75,
        priority: 'medium',
        requires_approval: true,
      });
    } else if (risk.risk_type === 'unpaid_invoice') {
      suggestions.push({
        organization_id: context.organization_id,
        client_id: context.client_id,
        entity_type: 'risk',
        entity_id: risk.id,
        suggestion_type: 'match_invoice',
        proposed_value: { status: 'resolved' },
        reason: `Unpaid overdue invoice from vendor. Reconcile matching transactions or mark paid if processed offline.`,
        confidence: 0.7,
        priority: 'high',
        requires_approval: true,
      });
    } else if (risk.risk_type === 'low_confidence_invoice_extraction' || risk.risk_type === 'invoice_without_vendor') {
      suggestions.push({
        organization_id: context.organization_id,
        client_id: context.client_id,
        entity_type: 'risk',
        entity_id: risk.id,
        suggestion_type: 'mark_invoice_needs_review',
        proposed_value: { status: 'needs_review' },
        reason: `Scanned receipt flagged for low OCR confidence or missing details. Open and manually confirm fields.`,
        confidence: 0.85,
        priority: 'low',
        requires_approval: true,
      });
    }
  });

  return suggestions;
}

/**
 * AI review suggestions generator for vendors
 */
export function generateVendorReviewSuggestions(
  vendors: any[],
  _transactions: any[],
  _risks: any[],
  context: { organization_id: string; client_id: string }
): AIReviewSuggestion[] {
  const suggestions: AIReviewSuggestion[] = [];

  vendors.forEach((vendor) => {
    if (vendor.recommendation === 'review' || vendor.recommendation === 'cancel_candidate') {
      const isHighPriority = vendor.total_spend >= 100000;
      
      suggestions.push({
        organization_id: context.organization_id,
        client_id: context.client_id,
        entity_type: 'vendor',
        entity_id: vendor.id,
        suggestion_type: 'flag_vendor',
        proposed_value: { recommendation: 'review' },
        reason: `${vendor.recommendation_reason || 'Recurring spend analysis recommends reviewing this vendor subscription.'}`,
        confidence: 0.8,
        priority: isHighPriority ? 'high' : 'medium',
        requires_approval: true,
      });
    }
  });

  return suggestions;
}

/**
 * Month-End readiness plan compilation and score projection
 */
export function generateMonthEndReviewPlan(
  transactions: any[],
  risks: any[],
  suggestions: AIReviewSuggestion[]
) {
  const current = calculateMonthEndReadiness(transactions, risks);

  // Simulate applying safe suggestions
  const safeSuggestions = suggestions.filter((s) => !s.requires_approval && s.status !== 'rejected');

  const projectedTxs = transactions.map((tx) => {
    const updated = { ...tx };
    const categorySuggestion = safeSuggestions.find(
      (s) => s.entity_type === 'transaction' && s.entity_id === tx.id && s.suggestion_type === 'categorize_transaction'
    );
    const reviewSuggestion = safeSuggestions.find(
      (s) => s.entity_type === 'transaction' && s.entity_id === tx.id && s.suggestion_type === 'mark_reviewed'
    );

    if (categorySuggestion) {
      updated.category = categorySuggestion.proposed_value.category;
    }
    if (reviewSuggestion) {
      updated.review_status = reviewSuggestion.proposed_value.review_status;
    }
    return updated;
  });

  const projectedRisks = risks.map((risk) => {
    const updated = { ...risk };
    const riskSuggestion = safeSuggestions.find(
      (s) => s.entity_type === 'risk' && s.entity_id === risk.id && s.suggestion_type === 'resolve_risk'
    );
    if (riskSuggestion) {
      updated.status = 'resolved';
    }
    return updated;
  });

  const projected = calculateMonthEndReadiness(projectedTxs, projectedRisks);

  const pendingCount = suggestions.filter((s) => s.status === 'pending').length;
  const safeCount = safeSuggestions.filter((s) => s.status === 'pending').length;
  const highPriorityCount = suggestions.filter((s) => s.priority === 'high' && s.status === 'pending').length;

  return {
    currentScore: current.score,
    projectedScore: projected.score,
    status: current.status,
    projectedStatus: projected.status,
    totalCount: pendingCount,
    safeCount,
    highPriorityCount,
    requiresApprovalCount: pendingCount - safeCount,
    checklist: current.checklist,
    projectedChecklist: projected.checklist,
  };
}

/**
 * Synchronize and store suggestions in Supabase
 */
export async function syncReviewSuggestions(orgId: string, clientId: string) {
  if (!orgId || !clientId) return [];

  // 1. Fetch current data
  const [txRes, riskRes, vendorRes, invoiceRes] = await Promise.all([
    supabase.from('transactions').select('*').eq('client_id', clientId),
    supabase.from('risk_events').select('*').eq('client_id', clientId),
    supabase.from('vendors').select('*').eq('client_id', clientId),
    supabase.from('invoices').select('*').eq('client_id', clientId),
  ]);

  if (txRes.error) throw txRes.error;
  if (riskRes.error) throw riskRes.error;
  if (vendorRes.error) throw vendorRes.error;
  if (invoiceRes.error) throw invoiceRes.error;

  const transactions = txRes.data || [];
  const risks = riskRes.data || [];
  const vendors = vendorRes.data || [];
  const invoices = invoiceRes.data || [];

  const context = { organization_id: orgId, client_id: clientId };

  // 2. Generate suggestions
  const txSuggestions = generateTransactionReviewSuggestions(transactions, context);
  const riskSuggestions = generateRiskReviewSuggestions(risks, transactions, vendors, invoices, context);
  const vendorSuggestions = generateVendorReviewSuggestions(vendors, transactions, risks, context);

  const allSuggestions = [...txSuggestions, ...riskSuggestions, ...vendorSuggestions];

  // 3. Clear existing pending suggestions
  const { error: deleteErr } = await supabase
    .from('ai_review_suggestions')
    .delete()
    .eq('client_id', clientId)
    .eq('status', 'pending');

  if (deleteErr) throw deleteErr;

  // 4. Insert new suggestions
  if (allSuggestions.length > 0) {
    const { data: inserted, error: insertErr } = await supabase
      .from('ai_review_suggestions')
      .insert(allSuggestions)
      .select();

    if (insertErr) throw insertErr;
    return inserted || [];
  }

  return [];
}
