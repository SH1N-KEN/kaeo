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

    // Perform AI Response Repair before Zod Validation
    const repairedData = { ...data };
    let repaired = false;

    if (!repairedData.recommended_actions || !Array.isArray(repairedData.recommended_actions)) {
      repairedData.recommended_actions = [];
      repaired = true;
    }
    if (!repairedData.caveats || !Array.isArray(repairedData.caveats)) {
      repairedData.caveats = [];
      repaired = true;
    }
    if (!repairedData.confidence || !['high', 'medium', 'low'].includes(repairedData.confidence)) {
      repairedData.confidence = 'medium';
      repaired = true;
    }
    if (repairedData.needs_external_research === undefined || repairedData.needs_external_research === null) {
      const fullText = (repairedData.answer || '') + ' ' + (repairedData.reasoning_summary || '') + ' ' + repairedData.caveats.join(' ');
      const hasResearchKeywords = /live research|live pricing|market research|external research|not enabled yet/i.test(fullText);
      repairedData.needs_external_research = hasResearchKeywords;
      repaired = true;
    }
    if (!repairedData.source_summary || typeof repairedData.source_summary !== 'object') {
      repairedData.source_summary = {
        transactions_used: context.counts.transactions,
        vendors_used: context.counts.vendors,
        risks_used: context.counts.risks,
        reports_used: context.latest_report_summary ? 1 : 0,
        notes_used: context.relevant_notes.length
      };
      repaired = true;
    } else {
      const ss = { ...repairedData.source_summary };
      if (typeof ss.transactions_used !== 'number') { ss.transactions_used = 0; repaired = true; }
      if (typeof ss.vendors_used !== 'number') { ss.vendors_used = 0; repaired = true; }
      if (typeof ss.risks_used !== 'number') { ss.risks_used = 0; repaired = true; }
      if (typeof ss.reports_used !== 'number') { ss.reports_used = 0; repaired = true; }
      if (typeof ss.notes_used !== 'number') { ss.notes_used = 0; repaired = true; }

      // Clamp values so they never exceed context counts and trigger false fallback
      if (ss.transactions_used > context.counts.transactions) { ss.transactions_used = context.counts.transactions; repaired = true; }
      if (ss.vendors_used > context.counts.vendors) { ss.vendors_used = context.counts.vendors; repaired = true; }
      if (ss.risks_used > context.counts.risks) { ss.risks_used = context.counts.risks; repaired = true; }

      repairedData.source_summary = ss;
    }

    if (repaired) {
      console.warn('[AI Client] Repaired/Clamped missing or malformed optional fields in AI response:', repairedData);
    }

    // Validate with Zod
    const result = AskKaeoAIResponseSchema.safeParse(repairedData);
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
