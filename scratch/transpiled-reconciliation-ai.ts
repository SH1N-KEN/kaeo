// import xhr
// import serve
import { z } from 'zod';
const createClient = (url: string, key: string, options: any) => ({
      auth: {
        getUser: async () => {
          return { data: { user: { id: 'test-user-uuid', email: 'test@kaeo.ai' } }, error: null };
        }
      }
    });

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

export async function handleRequest(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  let isBatch = false;
  let exceptions: any[] = [];

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

    let body: any = {};
    try {
      body = await req.json();
      isBatch = body.isBatch === true;
      exceptions = body.exceptions || [];
    } catch (_err) {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { exceptionType, evidence } = body;
    if (!isBatch && (!exceptionType || !evidence)) {
      return new Response(JSON.stringify({ error: "Missing required fields: exceptionType, evidence" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (isBatch && (!exceptions || !Array.isArray(exceptions))) {
      return new Response(JSON.stringify({ error: "Missing exceptions array for batch review" }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let prompt = "";
    if (isBatch) {
      prompt = `Review these ${exceptions.length} reconciliation exceptions and for each provide:
recommendedAction, confidence, priority (1-10), reasoning.

Exceptions:
${exceptions.map((ex: any, idx: number) => `${idx + 1}. [${ex.type}] ₹${ex.amount} — ${ex.description} — ${ex.discrepancy}`).join('\n')}

Return a JSON object containing a "results" array, where each element corresponds to the exception in order:
{
  "results": [
    {
      "recommendedAction": "APPROVE" | "INVESTIGATE" | "REJECT" | "REQUEST_DOCUMENTATION",
      "confidence": number (0-100),
      "priority": number (1-10),
      "reasoning": string
    },
    ...
  ]
}`;
    } else {
      // Format prompt fields
      const proc = evidence.processorTxn || {};
      const bank = evidence.bankTxn;

      const procInfo = `${proc.description || 'N/A'} ₹${Math.abs(proc.amount ?? 0)} ${proc.transaction_date || 'N/A'}`;
      const bankInfo = bank 
        ? `${bank.description || 'N/A'} ₹${Math.abs(bank.amount ?? 0)} ${bank.transaction_date || 'N/A'}`
        : 'MISSING';

      prompt = `Exception Type: ${exceptionType}
Processor: ${procInfo}
Bank: ${bankInfo}
Discrepancy: ${evidence.discrepancy || 'N/A'}

Assess likelihood this is a legitimate settlement variance. 
Return JSON with assessment, likelihood, recommended action, confidence (0-100), reasoning.`;
    }

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
              max_tokens: 1000,
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

        if (isBatch) {
          let arrayData: any[] = [];
          if (Array.isArray(parsedJson)) {
            arrayData = parsedJson;
          } else if (parsedJson && Array.isArray(parsedJson.results)) {
            arrayData = parsedJson.results;
          } else if (parsedJson && Array.isArray(parsedJson.exceptions)) {
            arrayData = parsedJson.exceptions;
          } else {
            throw new Error("Response is not a JSON array or object with results array");
          }

          if (arrayData.length !== exceptions.length) {
            throw new Error(`Length mismatch: expected ${exceptions.length}, got ${arrayData.length}`);
          }

          const validated = arrayData.map((item: any) => {
            const validActions = ['APPROVE', 'INVESTIGATE', 'REJECT', 'REQUEST_DOCUMENTATION'];
            let recommendedAction = item.recommendedAction || item.recommended_action || item.action || 'INVESTIGATE';
            if (typeof recommendedAction === 'string') {
              recommendedAction = recommendedAction.toUpperCase().trim();
            }
            if (!validActions.includes(recommendedAction)) {
              recommendedAction = 'INVESTIGATE';
            }

            let confidence = Number(item.confidence);
            if (isNaN(confidence)) confidence = 50;
            confidence = Math.min(100, Math.max(0, confidence));

            let priority = Number(item.priority || item.priority_score || item.urgency);
            if (isNaN(priority)) priority = 5;
            priority = Math.min(10, Math.max(1, priority));

            return {
              recommendedAction,
              confidence,
              priority,
              reasoning: item.reasoning || item.explanation || "No reasoning provided."
            };
          });

          parsedJson = validated;
        } else {
          // ── Normalize LLM output before strict schema validation ──
          // Some models return non-standard casing or omit optional fields.

          // 1. Normalize likelihood: map verbose/cased strings → "high"|"medium"|"low"
          if (parsedJson.likelihood) {
            const l = String(parsedJson.likelihood).toLowerCase().trim();
            if (l === 'high') parsedJson.likelihood = 'high';
            else if (l === 'low') parsedJson.likelihood = 'low';
            else parsedJson.likelihood = 'medium'; // "moderate", "medium", unknown → medium
          } else {
            parsedJson.likelihood = 'medium';
          }

          // 2. Normalize recommendedAction: fill default if missing or unrecognised
          const validActions = ['APPROVE', 'INVESTIGATE', 'REJECT', 'REQUEST_DOCUMENTATION'];
          if (!parsedJson.recommendedAction || !validActions.includes(parsedJson.recommendedAction)) {
            // Try to infer from a recommended_action or action field some models emit
            const raw = (parsedJson.recommendedAction || parsedJson.recommended_action || parsedJson.action || '').toUpperCase().trim();
            parsedJson.recommendedAction = validActions.includes(raw) ? raw : 'INVESTIGATE';
          }

          // 3. Ensure confidence is a number 0-100
          if (typeof parsedJson.confidence !== 'number') {
            parsedJson.confidence = Number(parsedJson.confidence) || 50;
          }
          parsedJson.confidence = Math.min(100, Math.max(0, parsedJson.confidence));

          AIResponseSchema.parse(parsedJson); // schema validation
        }
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
    
    let fallbackResponse: any;
    if (isBatch && Array.isArray(exceptions)) {
      fallbackResponse = exceptions.map((ex: any) => ({
        recommendedAction: "INVESTIGATE",
        confidence: 50,
        priority: 5,
        reasoning: `LLM unavailable: ${err.message}`
      }));
    } else {
      // Resilient fallback payload on failure
      fallbackResponse = {
        assessment: "LLM unavailable",
        likelihood: "low",
        recommendedAction: "INVESTIGATE",
        confidence: 0,
        reasoning: `An error occurred while calling the LLM: ${err.message}`
      };
    }

    return new Response(JSON.stringify(fallbackResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}