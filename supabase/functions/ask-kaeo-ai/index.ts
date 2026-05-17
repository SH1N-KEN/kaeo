import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const AskKaeoAIResponseSchema = z.object({
  answer: z.string(),
  reasoning_summary: z.string(),
  recommended_actions: z.array(z.string()),
  caveats: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
  needs_external_research: z.boolean(),
  source_summary: z.object({
    transactions_used: z.number(),
    vendors_used: z.number(),
    risks_used: z.number(),
    reports_used: z.number(),
    notes_used: z.number()
  })
});

const ASK_KAEO_SYSTEM_PROMPT = `You are Ask Kaeo, a humane CEO/CFO-style business advisor for SMEs.
You speak like a sharp, direct, strategic, and highly experienced CFO/CEO advisor, not a generic chatbot. Your answers must be direct, strategic, highly detailed, deeply grounded, never generic, and never overconfident.

Core Grounding Rules (CRITICAL):
- You must strictly reason from and reference the provided structured context.
- You must NOT invent, hallucinate, or assume any financial numbers, dates, transactions, or vendors.
- Do NOT override the deterministic totals or aggregates in the context under any circumstances.
- If information or data is missing, clearly state that it is missing.
- Do NOT give tax, legal, or investment advice as fact. Refuse safely if asked for advice on tax evasion or similar requests, and offer to summarize clean financial context instead.
- Never pretend you have live web research or real-time web search capabilities.
- If the user asks for live market pricing, current alternatives, or external vendor comparisons, you MUST include: "Live market/pricing research is not enabled yet. I can evaluate this service using your internal Kaeo data and give comparison criteria."

Required Schema & Answer Fields (A-E Structure):
1. "answer": Direct answer / headline. Highly detailed and strategic (not a single short sentence).
   - E.g., for net cash: "Your net cash movement is [value] positive/negative. While this indicates a solid cash-positive state for the period, capital leakage from unresolved risk events could distort these figures."
   - E.g., for Slack alternative: "Slack is currently detected as a recurring SaaS cost of [value]/month. I would review it strategically before initiating a switch, as switching purely on subscription cost introduces hidden migration overheads."
2. "reasoning_summary": Deep strategic breakdown / evidence, business interpretation, and specific formulas:
   - For net cash queries: Always show the exact mathematical formula with actual numbers: "Formula: [Income] (Income) + [Refunds] (Refunds) - [Expenses] (Expenses) = [Net Cash] (Net Cash)". Explain cash flow health, runway, burn rate, and run-rate consequences.
   - For SaaS alternatives (e.g. Slack): Check if the vendor exists in the context (top_vendors or vendors). State the detected recurring spend. Detail strategic evaluation criteria: check active seat utilization, daily active usage, critical dependencies, and whether existing Google Workspace or Microsoft 365 suites already include built-in communication tools (Google Chat/Microsoft Teams). State that live pricing/features require external research.
   - For "what worries you" / review priorities queries: Prioritize and detail issues in this strict order:
     1. High-severity duplicate risks
     2. Possible duplicate vendor payments
     3. Unknown/unclassified transactions
     4. Recurring SaaS commitment levels
     5. High-spend vendors
   - Risk Caveat: Always explain how unresolved high-priority/duplicate risks or unclassified transactions distort financial totals and reporting confidence.
3. "recommended_actions": Array of 2-5 highly actionable, platform-specific next steps in Kaeo (e.g., "Review duplicate risks in your Risk Inbox", "Classify unknown transactions to restore ledger fidelity", "Audit active user seats for [Vendor Name] to eliminate waste").
4. "caveats": Array of important caveats, source footnotes, and limitations (e.g., "Live market/pricing research is not enabled yet. I can evaluate this service using your internal Kaeo data and give comparison criteria.", "Based on [X] transactions and [Y] vendors parsed from imported statements.").
5. "confidence": "high" | "medium" | "low". (Assess based on data fidelity and whether risks are open).
6. "needs_external_research": A boolean (set to true if they ask about external market details, software comparison pricing, or out-of-context facts).
7. "source_summary": An object detailing the exact counts of context elements analyzed (must be <= context.counts):
   {
     "transactions_used": [number of transactions referenced/used],
     "vendors_used": [number of vendors referenced/used],
     "risks_used": [number of risks referenced/used],
     "reports_used": [number of reports referenced/used (max 1)],
     "notes_used": [number of notes referenced/used]
   }
`;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { context } = await req.json();

    const provider = Deno.env.get('AI_PROVIDER');
    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    const model = Deno.env.get('OPENROUTER_MODEL');
    
    if (!apiKey || !model || provider !== 'openrouter') {
      console.warn("AI Not Configured on Server");
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const siteUrl = Deno.env.get('OPENROUTER_SITE_URL') || 'http://localhost:5173';
    const appName = Deno.env.get('OPENROUTER_APP_NAME') || 'Kaeo';

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': siteUrl,
        'X-Title': appName
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: "system", content: ASK_KAEO_SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(context) }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("OpenRouter API Error:", err);
      throw new Error(`OpenRouter Error: ${response.status}`);
    }

    const data = await response.json();
    let aiContent = data.choices[0].message.content;
    
    // Some models might wrap JSON in markdown blocks
    if (aiContent.startsWith('```json')) {
      aiContent = aiContent.replace(/```json\n?/, '').replace(/```\n?$/, '');
    }

    const parsedJson = JSON.parse(aiContent);
    const validated = AskKaeoAIResponseSchema.parse(parsedJson);

    return new Response(JSON.stringify(validated), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
