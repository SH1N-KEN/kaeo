import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AIResponseSchema = z.object({
  assessment: z.string(),
  likelihood: z.enum(["high", "medium", "low"]),
  recommendedAction: z.enum(["APPROVE", "INVESTIGATE", "REJECT", "REQUEST_DOCUMENTATION"]),
  confidence: z.number().min(0).max(100),
  reasoning: z.string()
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authentication token" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify token with Supabase Auth
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();

    if (authErr || !user) {
      return new Response(JSON.stringify({ error: `Unauthorized: ${authErr?.message || "Invalid token"}` }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse input body
    let body: any = {};
    try {
      body = await req.json();
    } catch (_err) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { exceptionType, evidence } = body;
    if (!exceptionType || !evidence) {
      return new Response(JSON.stringify({ error: "Missing required fields: exceptionType, evidence" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Format prompt fields
    const proc = evidence.processorTxn || {};
    const bank = evidence.bankTxn;

    const procInfo = `${proc.description || 'N/A'} ₹${Math.abs(proc.amount ?? 0)} ${proc.transaction_date || 'N/A'}`;
    const bankInfo = bank 
      ? `${bank.description || 'N/A'} ₹${Math.abs(bank.amount ?? 0)} ${bank.transaction_date || 'N/A'}`
      : 'MISSING';

    const prompt = `Exception Type: ${exceptionType}
Processor: ${procInfo}
Bank: ${bankInfo}
Discrepancy: ${evidence.discrepancy || 'N/A'}

Assess likelihood this is a legitimate settlement variance. 
Return JSON with assessment, likelihood, recommended action, confidence (0-100), reasoning.`;

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");

    let isAnthropic = false;
    let apiKey = "";
    let model = "";

    if (anthropicKey) {
      isAnthropic = true;
      apiKey = anthropicKey;
      model = Deno.env.get("ANTHROPIC_MODEL") || "claude-3-5-sonnet-20241022";
    } else if (openrouterKey) {
      apiKey = openrouterKey;
      model = Deno.env.get("OPENROUTER_MODEL") || "anthropic/claude-3.5-sonnet";
    } else {
      throw new Error("API credentials are not configured. Set ANTHROPIC_API_KEY or OPENROUTER_API_KEY.");
    }

    // Fetch response with retry policy
    let attempts = 0;
    let rawText = "";
    let parsedJson: any = null;

    while (attempts < 2) {
      try {
        attempts++;
        if (isAnthropic) {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              model: model,
              max_tokens: 1000,
              messages: [{ role: 'user', content: prompt }],
              system: 'You are a financial reconciliation assistant. You MUST return your response as a strict raw JSON object matching the requested schema. Do NOT wrap the JSON in markdown code blocks like ```json ... ```. Return only the JSON.'
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Anthropic error (Status ${response.status}): ${errText}`);
          }
          const resData = await response.json();
          rawText = resData.content?.[0]?.text || "";
        } else {
          // OpenRouter API
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
                { role: 'system', content: 'You are a financial reconciliation assistant. Always return response in strict JSON format.' },
                { role: 'user', content: prompt }
              ],
              temperature: 0.3,
              response_format: { type: "json_object" }
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            throw new Error(`OpenRouter error (Status ${response.status}): ${errText}`);
          }
          const resData = await response.json();
          rawText = resData.choices?.[0]?.message?.content || "";
        }

        // Clean up markdown block wrapping if present
        let cleaned = rawText.trim();
        if (cleaned.startsWith("```")) {
          cleaned = cleaned.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
        }

        parsedJson = JSON.parse(cleaned);
        AIResponseSchema.parse(parsedJson); // schema validation
        break; // Success!
      } catch (err) {
        console.warn(`[reconciliation-ai] Attempt ${attempts} failed:`, err);
        if (attempts >= 2) {
          throw err;
        }
      }
    }

    return new Response(JSON.stringify(parsedJson), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error("[reconciliation-ai] Processing exception:", err.message);
    
    // Resilient fallback payload on failure
    const fallbackResponse = {
      assessment: "LLM unavailable",
      likelihood: "low",
      recommendedAction: "INVESTIGATE",
      confidence: 0,
      reasoning: `An error occurred while calling the LLM: ${err.message}`
    };

    return new Response(JSON.stringify(fallbackResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
