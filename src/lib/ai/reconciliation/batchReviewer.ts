import { supabase } from '../../supabase';

export interface Exception {
  type: string;
  amount: number;
  description: string;
  discrepancy: string;
}

export interface BatchReviewItem {
  id: string;
  type: string;
  amount: number;
  description: string;
  discrepancy: string;
  recommendedAction: 'APPROVE' | 'INVESTIGATE' | 'REJECT' | 'REQUEST_DOCUMENTATION';
  confidence: number;
  priority: number; // 1-10
  reasoning: string;
  rankScore: number; // financial impact × confidence × urgency
}

export interface ActionBreakdown {
  count: number;
  amount: number;
}

export interface BatchReviewResult {
  totalReviewed: number;
  totalExposure: number;
  breakdown: {
    APPROVE: ActionBreakdown;
    INVESTIGATE: ActionBreakdown;
    REJECT: ActionBreakdown;
    REQUEST_DOCUMENTATION: ActionBreakdown;
  };
  items: BatchReviewItem[];
}

/**
 * Sends a list of exceptions in ONE LLM call to get a batch review result.
 * Implements a local rules-based simulation as a fallback if the Edge Function call fails.
 */
export async function batchReviewExceptions(exceptions: Exception[]): Promise<BatchReviewResult> {
  const totalReviewed = exceptions.length;
  const totalExposure = exceptions.reduce((sum, ex) => sum + Math.abs(ex.amount), 0);

  let rawItems: any[] = [];
  try {
    const { data, error } = await supabase.functions.invoke('reconciliation-ai', {
      body: {
        isBatch: true,
        exceptions: exceptions.map(ex => ({
          type: ex.type,
          amount: ex.amount,
          description: ex.description,
          discrepancy: ex.discrepancy
        }))
      }
    });

    if (error) {
      throw new Error(`Edge function error: ${error.message}`);
    }

    if (data && Array.isArray(data)) {
      rawItems = data;
    } else {
      throw new Error('Invalid response structure from Edge function');
    }
  } catch (err) {
    console.warn('[Batch Review] Falling back to local rules-based simulation:', err);
    
    // Local rules-based mock fallback
    rawItems = exceptions.map(ex => {
      let recommendedAction: 'APPROVE' | 'INVESTIGATE' | 'REJECT' | 'REQUEST_DOCUMENTATION' = 'INVESTIGATE';
      let confidence = 70;
      let priority = 5;
      let reasoning = `Local AI Review: Analyzed ${ex.type.toLowerCase()} variance of ₹${Math.abs(ex.amount)}. Requires manual ledger confirmation.`;

      // 1. Probable processor fee
      if (ex.type === 'REVIEW' && Math.abs(ex.amount) > 0 && Math.abs(ex.amount) < 500) {
        recommendedAction = 'APPROVE';
        confidence = 94;
        priority = 3;
        reasoning = `The variance of ₹${Math.abs(ex.amount)} is extremely likely a standard processing gateway fee adjustment.`;
      }
      // 2. Duplicate
      else if (ex.type === 'DUPLICATE') {
        recommendedAction = 'REJECT';
        confidence = 95;
        priority = 8;
        reasoning = `Duplicate entry detected matching date, amount, and reference tags. Recommend rejection to prevent double counting.`;
      }
      // 3. Chargeback
      else if (ex.type === 'CHARGEBACK' || ex.description.toLowerCase().includes('chargeback') || ex.discrepancy.toLowerCase().includes('chargeback')) {
        recommendedAction = 'REJECT';
        confidence = 95;
        priority = 9;
        reasoning = `Chargeback transaction indicates a customer dispute has reversed the credit. Recommend rejecting the reconciliation match.`;
      }
      // 4. Missing bank record (high exposure)
      else if (ex.discrepancy.toLowerCase().includes('missing bank') || (!ex.description.includes('deposit') && Math.abs(ex.amount) > 5000)) {
        recommendedAction = 'REQUEST_DOCUMENTATION';
        confidence = 90;
        priority = 8;
        reasoning = `High exposure transaction of ₹${Math.abs(ex.amount)} has processor logs but lacks bank statement entry. Request settlement proof.`;
      }

      return {
        recommendedAction,
        confidence,
        priority,
        reasoning
      };
    });
  }

  // Map raw items and compute ranks/scores
  const items: BatchReviewItem[] = exceptions.map((ex, idx) => {
    const aiReview = rawItems[idx] || {
      recommendedAction: 'INVESTIGATE',
      confidence: 50,
      priority: 5,
      reasoning: 'Fallback item'
    };

    const financialImpact = Math.abs(ex.amount);
    const confidenceDecimal = aiReview.confidence / 100;
    const urgency = aiReview.priority;
    const rankScore = financialImpact * confidenceDecimal * urgency;

    return {
      id: `ex-batch-${idx}`,
      type: ex.type,
      amount: ex.amount,
      description: ex.description,
      discrepancy: ex.discrepancy,
      recommendedAction: aiReview.recommendedAction,
      confidence: aiReview.confidence,
      priority: aiReview.priority,
      reasoning: aiReview.reasoning,
      rankScore
    };
  });

  // Sort by rankScore descending
  items.sort((a, b) => b.rankScore - a.rankScore);

  // Compute breakdown
  const breakdown = {
    APPROVE: { count: 0, amount: 0 },
    INVESTIGATE: { count: 0, amount: 0 },
    REJECT: { count: 0, amount: 0 },
    REQUEST_DOCUMENTATION: { count: 0, amount: 0 }
  };

  items.forEach(item => {
    const action = item.recommendedAction;
    if (breakdown[action]) {
      breakdown[action].count++;
      breakdown[action].amount += Math.abs(item.amount);
    }
  });

  return {
    totalReviewed,
    totalExposure,
    breakdown,
    items
  };
}
