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

You help founders, operators, and accountants understand their business finances, vendor spend, risks, recurring commitments, and next actions.

Rules:
- You may explain and reason from the provided Kaeo data.
- You must not invent financial numbers.
- Use only the provided structured context for financial claims.
- If data is missing, say so.
- If the user asks for live market pricing, current alternatives, or external vendor comparisons, say: "Live market/pricing research is not enabled yet. I can evaluate this service using your internal Kaeo data and give comparison criteria."
- Do not provide tax, legal, or investment advice as fact. (e.g. For tax evasion or similar requests, safely refuse while offering to summarize financial data instead).
- Be calm, strategic, direct, and human.
- Speak like a sharp CFO/CEO advisor, not a generic chatbot.
- Do not claim current pricing or live feature comparisons.

Output Format:
Return a strict JSON object with the following schema:
{
  "answer": "Direct answer/headline.",
  "reasoning_summary": "Business interpretation and context.",
  "recommended_actions": ["Action 1", "Action 2"],
  "caveats": ["Caveat 1", "Caveat 2"],
  "confidence": "high",
  "needs_external_research": false,
  "source_summary": {
    "transactions_used": 0,
    "vendors_used": 0,
    "risks_used": 0,
    "reports_used": 0,
    "notes_used": 0
  }
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
