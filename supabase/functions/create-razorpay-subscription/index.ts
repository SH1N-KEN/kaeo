import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const RAZORPAY_KEY_ID = Deno.env.get("RAZORPAY_KEY_ID");
    const RAZORPAY_KEY_SECRET = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
      console.error("Razorpay API secrets are missing in Edge Function environment.");
      return new Response(
        JSON.stringify({ error: "Razorpay setup missing. Add Razorpay secrets and retry." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Authenticate user from JWT Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      console.error("Authentication check failed:", authErr);
      return new Response(
        JSON.stringify({ error: "Unauthorized access." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Parse request payload
    const { organization_id, plan_id, billing_cycle } = await req.json();
    if (!organization_id || !plan_id || !billing_cycle) {
      return new Response(
        JSON.stringify({ error: "Missing required params: organization_id, plan_id, billing_cycle" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!["monthly", "yearly"].includes(billing_cycle)) {
      return new Response(
        JSON.stringify({ error: "Invalid billing cycle. Must be monthly or yearly." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (plan_id === "free") {
      return new Response(
        JSON.stringify({ error: "Free plan upgrades cannot be checked out via Razorpay." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Verify user membership in requested organization using service role
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: member, error: memberErr } = await adminClient
      .from("organization_members")
      .select("role")
      .eq("org_id", organization_id)
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member) {
      console.error(`User ${user.id} is not a member of organization ${organization_id}:`, memberErr);
      return new Response(
        JSON.stringify({ error: "Unauthorized access to this organization." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Fetch the selected plan metrics
    const { data: plan, error: planErr } = await adminClient
      .from("billing_plans")
      .select("*")
      .eq("id", plan_id)
      .single();

    if (planErr || !plan) {
      console.error(`Billing plan ${plan_id} not found:`, planErr);
      return new Response(
        JSON.stringify({ error: `Selected billing plan ${plan_id} does not exist.` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Basic Base64 auth helper
    const authString = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
    const razorpayHeaders = {
      "Authorization": `Basic ${authString}`,
      "Content-Type": "application/json",
    };

    // 5. Create or reuse Customer in Razorpay
    let customerId = "";
    const { data: currentSub } = await adminClient
      .from("subscriptions")
      .select("razorpay_customer_id")
      .eq("organization_id", organization_id)
      .not("razorpay_customer_id", "is", null)
      .limit(1);

    if (currentSub && currentSub.length > 0 && currentSub[0].razorpay_customer_id) {
      customerId = currentSub[0].razorpay_customer_id;
      console.log(`Reusing existing Razorpay Customer: ${customerId}`);
    } else {
      console.log("Creating new Razorpay Customer...");
      const customerRes = await fetch("https://api.razorpay.com/v1/customers", {
        method: "POST",
        headers: razorpayHeaders,
        body: JSON.stringify({
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Kaeo Customer",
          email: user.email,
          fail_existing: "0" // Returns existing customer if duplicate instead of failing
        }),
      });

      if (!customerRes.ok) {
        const errText = await customerRes.text();
        console.error("Razorpay Customer creation failed:", errText);
        throw new Error(`Failed to create Razorpay customer profile: ${errText}`);
      }

      const custData = await customerRes.json();
      customerId = custData.id;
      console.log(`Created Razorpay Customer: ${customerId}`);
    }

    // 6. Get or dynamically create Razorpay Plan
    let razorpayPlanId = billing_cycle === "yearly" ? plan.razorpay_plan_yearly_id : plan.razorpay_plan_monthly_id;

    if (!razorpayPlanId) {
      console.log(`Razorpay Plan ID not found locally. Dynamically registering ${plan.name} (${billing_cycle}) in Razorpay...`);
      const amountInINR = billing_cycle === "yearly" ? plan.price_yearly_inr : plan.price_monthly_inr;
      const planRes = await fetch("https://api.razorpay.com/v1/plans", {
        method: "POST",
        headers: razorpayHeaders,
        body: JSON.stringify({
          period: billing_cycle === "yearly" ? "yearly" : "monthly",
          interval: 1,
          item: {
            name: `Kaeo ${plan.name} (${billing_cycle})`,
            amount: amountInINR * 100, // Razorpay amount is in Paisa (1 INR = 100 Paisa)
            currency: "INR"
          }
        }),
      });

      if (!planRes.ok) {
        const errText = await planRes.text();
        console.error("Razorpay Plan dynamic creation failed:", errText);
        throw new Error(`Failed to provision Razorpay catalog plan: ${errText}`);
      }

      const planData = await planRes.json();
      razorpayPlanId = planData.id;
      console.log(`Dynamic Razorpay Plan created successfully: ${razorpayPlanId}`);

      // Save the dynamically created Plan ID to our database
      const updateField = billing_cycle === "yearly" ? "razorpay_plan_yearly_id" : "razorpay_plan_monthly_id";
      const { error: updatePlanErr } = await adminClient
        .from("billing_plans")
        .update({ [updateField]: razorpayPlanId })
        .eq("id", plan_id);

      if (updatePlanErr) {
        console.error("Failed to cache dynamic Razorpay Plan ID in Supabase:", updatePlanErr);
      }
    }

    // 7. Create Subscription in Razorpay
    console.log(`Creating subscription in Razorpay for plan: ${razorpayPlanId}, customer: ${customerId}...`);
    const totalCount = billing_cycle === "yearly" ? 5 : 60; // 5 years of support
    
    const subRes = await fetch("https://api.razorpay.com/v1/subscriptions", {
      method: "POST",
      headers: razorpayHeaders,
      body: JSON.stringify({
        plan_id: razorpayPlanId,
        total_count: totalCount,
        quantity: 1,
        customer_id: customerId,
        notify_info: {
          notify_phone: null,
          notify_email: user.email
        },
        addons: [],
        notes: {
          organization_id: organization_id,
          plan_id: plan_id,
          billing_cycle: billing_cycle
        }
      }),
    });

    if (!subRes.ok) {
      const errText = await subRes.text();
      console.error("Razorpay Subscription creation failed:", errText);
      throw new Error(`Razorpay subscription creation failed: ${errText}`);
    }

    const subData = await subRes.json();
    console.log(`Razorpay subscription successfully created: ${subData.id}, status: ${subData.status}`);

    // 8. Update Kaeo local subscriptions table
    // Fetch if a subscription row already exists for this org
    const { data: existingSubData } = await adminClient
      .from("subscriptions")
      .select("id")
      .eq("organization_id", organization_id)
      .limit(1);

    const subscriptionPayload = {
      organization_id,
      plan_id,
      status: "pending_payment",
      billing_cycle,
      razorpay_customer_id: customerId,
      razorpay_subscription_id: subData.id,
      razorpay_plan_id: razorpayPlanId,
      razorpay_payment_link_id: subData.short_url ? subData.id : null, // Store subscription ID as link identifier
      updated_at: new Date().toISOString()
    };

    if (existingSubData && existingSubData.length > 0) {
      console.log(`Updating existing local subscription: ${existingSubData[0].id}`);
      const { error: updateSubErr } = await adminClient
        .from("subscriptions")
        .update(subscriptionPayload)
        .eq("id", existingSubData[0].id);

      if (updateSubErr) throw updateSubErr;
    } else {
      console.log("Inserting new local subscription...");
      const { error: insertSubErr } = await adminClient
        .from("subscriptions")
        .insert({
          ...subscriptionPayload,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // Default 14 days
        });

      if (insertSubErr) throw insertSubErr;
    }

    // 9. Return the hosted redirect URL
    return new Response(
      JSON.stringify({
        checkout_url: subData.short_url,
        razorpay_subscription_id: subData.id,
        status: subData.status
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Unhandled Create Razorpay Subscription error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to create Razorpay checkout instance." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
