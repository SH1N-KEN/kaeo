import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

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

const ASK_KAEO_SYSTEM_PROMPT = `You are Libby, an AI finance manager built into Kaeo — a financial review workspace for Indian SMEs and accountants.

Identity & Role:
- You are Libby. You are not a generic AI assistant. You are a finance manager that works with real workspace data.
- You help business owners and accountants review spend, understand risks, analyse vendors, check report readiness, and make informed financial decisions.
- You can suggest actions, but must always request user approval before anything is applied.

Core Rules — Non-Negotiable:
1. Never invent financial data. Only use numbers from the workspace context you are given.
2. Never guess transaction values, vendor amounts, or risk counts. If you don't have the data, say so.
3. Never say you have modified, updated, or applied anything. You suggest — the user approves.
4. Always reference current workspace data first before giving any general advice.
5. If the requested information is not available in your context, say clearly: "I don't have that data in your current workspace. [explain what you'd need]."
6. All currency must use Indian Rupees (₹) with Indian number grouping (e.g., ₹9,10,303 or ₹12,000). Never use $ or USD.

Tone & Style:
- Sound like a trusted, calm operator — direct and practical.
- Use natural language: "Here's what I'm seeing", "My take:", "The move:", "I'd check this first".
- Never say "Based on the provided data" or "The analysis indicates". Sound human, not robotic.
- Keep responses focused. Do not dump all metrics unless the user explicitly asks for a full breakdown.
- Do not print cash flow formulas or calculations unless the user asks "how is this calculated" or "explain the math".

Response Modes:
Adjust your response based on the "response_mode" in your context:

1. "priority_advice" — Action-first. Max 1-2 key numbers. Give ranked next steps with clear first click.
2. "metric_answer" — Answer the specific financial question with exact verified totals from context.
3. "explanation" — Explain a concept or alternative with key tradeoffs. Keep it concise.
4. "report_summary" — High-level summary of financial aggregates for the period.
5. "vendor_review" — Focus on vendor spend, alternatives, and seat count audits.
6. "risk_review" — Focus on open compliance risks, duplicates, and exposure amounts.
7. "invoice_review" — Focus on invoice match status, overdue counts, and mismatch totals.
8. "casual_followup" — Short 1-2 sentence natural reply. Do not include metrics.

Formatting Rules:
- NEVER use markdown: no **, *, #, tables, or code fences.
- Never use -- or em-dashes. Use commas or clean line breaks instead.
- Use • for bullet points only. Use numbered lists for ranked action steps.
- Section labels must be human: "My take:", "What I'd check:", "The move:", "Small caveat:".
- Use clean short paragraphs with clear spacing.
- Prefer readable paragraphs over tables.

Required JSON Schema:
Return a strict JSON object:
{
  "answer": "Direct, human headline or opening reply to the question.",
  "reasoning_summary": "Natural explanation, operator reasoning, and what the numbers mean for this business.",
  "recommended_actions": ["Specific actionable next step in Kaeo", "Second action if needed"],
  "caveats": ["Short caveat only if needed, e.g., 'Based on 39 imported transactions.' or 'Live market data is not available.'"],
  "confidence": "high" | "medium" | "low",
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
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    
    let user: any = null;
    let authErrorMsg: string | null = null;
    if (authHeader) {
      try {
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: { user: identifiedUser }, error: authErr } = await userClient.auth.getUser();
        user = identifiedUser;
        if (authErr) {
          authErrorMsg = authErr.message;
        }
      } catch (err: any) {
        authErrorMsg = err.message;
      }
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch (_err) {
      // Body may not be valid JSON
    }

    const { context, workspace_id, message, intent } = body;

    console.log("[ask-kaeo-ai] Request received");
    console.log("[ask-kaeo-ai] Auth header exists:", !!authHeader);
    console.log("[ask-kaeo-ai] Workspace ID presence:", !!workspace_id);
    console.log("[ask-kaeo-ai] User ID presence:", !!user?.id);
    console.log("[ask-kaeo-ai] Message presence:", !!message);
    console.log("[ask-kaeo-ai] Intent presence:", !!intent);
    console.log("[ask-kaeo-ai] Context presence:", !!context);

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authentication" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (authErrorMsg || !user) {
      return new Response(JSON.stringify({ error: `Invalid authentication token: ${authErrorMsg || "Unauthorized"}` }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!workspace_id) {
      return new Response(JSON.stringify({ error: "Missing workspace_id" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!context) {
      return new Response(JSON.stringify({ error: "Missing context" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!message) {
      return new Response(JSON.stringify({ error: "Missing message" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (!intent) {
      return new Response(JSON.stringify({ error: "Missing intent" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const provider = Deno.env.get('AI_PROVIDER');
    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    const model = Deno.env.get('OPENROUTER_MODEL');
    
    if (!apiKey || !model || provider !== 'openrouter') {
      console.warn("AI Not Configured on Server");
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const siteUrl = Deno.env.get('OPENROUTER_SITE_URL') || 'http://localhost:5173';
    const appName = Deno.env.get('OPENROUTER_APP_NAME') || 'Kaeo';

    let payload: any = {
      model: model,
      messages: [
        { role: "system", content: ASK_KAEO_SYSTEM_PROMPT },
        { role: "user", content: JSON.stringify(context) }
      ],
      temperature: 0.3,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    };

    if (context.needs_web_research) {
      payload.tools = [{ type: "openrouter:web_search" }];
    }

    let response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': siteUrl,
        'X-Title': appName
      },
      body: JSON.stringify(payload)
    });

    // If the request fails and we tried tools, fallback to plugins
    if (!response.ok && context.needs_web_research && payload.tools) {
      console.warn(`OpenRouter rejected tools, falling back to plugins for web search (Status ${response.status})`);
      delete payload.tools;
      payload.plugins = [{ id: "web" }];
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': siteUrl,
          'X-Title': appName
        },
        body: JSON.stringify(payload)
      });
    }

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

    // ── Normalize before strict schema validation ──
    // Coerce confidence casing ("Medium" → "medium", "High" → "high", "Low" → "low")
    if (parsedJson.confidence) {
      const c = String(parsedJson.confidence).toLowerCase().trim();
      parsedJson.confidence = c === 'high' ? 'high' : c === 'low' ? 'low' : 'medium';
    }
    // Ensure array fields exist
    if (!Array.isArray(parsedJson.recommended_actions)) parsedJson.recommended_actions = [];
    if (!Array.isArray(parsedJson.caveats)) parsedJson.caveats = [];
    // Ensure needs_external_research is boolean
    if (typeof parsedJson.needs_external_research !== 'boolean') {
      parsedJson.needs_external_research = false;
    }
    // Ensure source_summary exists with numeric fields
    if (!parsedJson.source_summary || typeof parsedJson.source_summary !== 'object') {
      parsedJson.source_summary = { transactions_used: 0, vendors_used: 0, risks_used: 0, reports_used: 0, notes_used: 0 };
    } else {
      const ss = parsedJson.source_summary;
      for (const k of ['transactions_used','vendors_used','risks_used','reports_used','notes_used']) {
        if (typeof ss[k] !== 'number') ss[k] = 0;
      }
    }

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
