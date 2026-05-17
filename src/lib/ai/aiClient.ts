import { supabase } from '../supabase';
import { AskKaeoAIResponseSchema } from './schemas';
import type { AskKaeoAIResponse } from './schemas';

export interface AIStructuredContext {
  question: string;
  intent: string;
  active_client_name: string;
  financial_summary: {
    income: number;
    refunds: number;
    expenses: number;
    netCash: number;
    net_cash_movement?: number;
    transaction_count?: number;
    period_start?: string | null;
    period_end?: string | null;
  };
  top_vendors: Array<{ name: string; spend: number; category?: string }>;
  recurring_spend: {
    commitment: number;
    active_vendors: number;
  };
  open_risks: Array<{ title: string; severity: string; amount?: number }>;
  high_priority_risks: number;
  latest_report_summary: string | null;
  relevant_notes: string[];
  caveats: string[];
  counts: {
    transactions: number;
    vendors: number;
    risks: number;
  };
  approved_extra_numbers?: number[];
  matching_vendor?: {
    name: string;
    display_name: string;
    total_spend: number;
    monthly_average: number;
    category: string;
  } | null;
}

export const askKaeoAi = async (context: AIStructuredContext): Promise<AskKaeoAIResponse | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('ask-kaeo-ai', {
      body: { context }
    });

    if (error) {
      console.warn('[AI Client] Edge function error:', error.message);
      return null;
    }

    if (!data) {
      console.warn('[AI Client] Empty response from Edge function');
      return null;
    }

    // Validate with Zod
    const result = AskKaeoAIResponseSchema.safeParse(data);
    if (!result.success) {
      console.error('[AI Client] AI response validation failed:', result.error);
      return null;
    }
    
    // Check for contradiction (did AI invent numbers?)
    // A simple sanity check: total transactions used should not exceed context.
    if (result.data.source_summary.transactions_used > context.counts.transactions || 
        result.data.source_summary.vendors_used > context.counts.vendors ||
        result.data.source_summary.risks_used > context.counts.risks) {
       console.warn('[AI Client] AI hallucinated larger source numbers. Falling back to deterministic.');
       return null;
    }

    return result.data;
  } catch (err) {
    console.error('[AI Client] Invocation failed:', err);
    return null;
  }
};
