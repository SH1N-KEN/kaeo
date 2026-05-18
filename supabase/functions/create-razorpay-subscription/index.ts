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
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single();

    if (memberErr || !member || !["owner", "admin", "member"].includes(member.role || "")) {
      console.error(`User ${user.id} is not an authorized member of organization ${organization_id}:`, memberErr);
      return new Response(
        JSON.stringify({ 
          error: "Unauthorized access to this organization.",
          debug: {
            organization_id_received: organization_id,
            user_id: user.id,
            membership_found: !!member,
            member_role: member?.role || null,
            error_details: memberErr?.message || null
          }
        }),
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

    // 7. Obtain Kaeo local Subscription ID (inserting if absent)
    const { data: existingSubData } = await adminClient
      .from("subscriptions")
      .select("id")
      .eq("organization_id", organization_id)
      .limit(1);

    let kaeoSubId = "";
    const subscriptionPayload = {
      organization_id,
      plan_id,
      status: "pending_payment",
      billing_cycle,
      razorpay_customer_id: customerId,
      razorpay_plan_id: razorpayPlanId,
      updated_at: new Date().toISOString()
    };

    if (existingSubData && existingSubData.length > 0) {
      kaeoSubId = existingSubData[0].id;
      console.log(`Using existing local subscription: ${kaeoSubId}`);
    } else {
      console.log("Inserting placeholder local subscription to obtain ID...");
      const { data: newSubRow, error: insertSubErr } = await adminClient
        .from("subscriptions")
        .insert({
          ...subscriptionPayload,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString() // Default 14 days
        })
        .select("id")
        .single();

      if (insertSubErr || !newSubRow) {
        throw new Error(`Failed to create local subscription record: ${insertSubErr?.message}`);
      }
      kaeoSubId = newSubRow.id;
    }

    // 8. Create Payment Link in Razorpay
    const amountInINR = billing_cycle === "yearly" ? plan.price_yearly_inr : plan.price_monthly_inr;
    const priceInPaise = amountInINR * 100;
    const reqHeaderOrigin = req.headers.get("origin");
    const APP_URL = reqHeaderOrigin || "http://localhost:5173";

    console.log(`Creating Razorpay Payment Link for plan: ${plan.name}, amount: ${amountInINR} INR...`);
    const paymentLinkRes = await fetch("https://api.razorpay.com/v1/payment_links", {
      method: "POST",
      headers: razorpayHeaders,
      body: JSON.stringify({
        amount: priceInPaise,
        currency: "INR",
        accept_partial: false,
        description: `Kaeo ${plan.name} Plan - ${billing_cycle}`,
        customer: {
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Kaeo Customer",
          email: user.email
        },
        notify: {
          sms: false,
          email: true
        },
        reminder_enable: true,
        notes: {
          organization_id: organization_id,
          plan_id: plan_id,
          billing_cycle: billing_cycle,
          kaeo_subscription_id: kaeoSubId
        },
        callback_url: `${APP_URL}/billing?payment=razorpay_return`,
        callback_method: "get"
      }),
    });

    if (!paymentLinkRes.ok) {
      const errText = await paymentLinkRes.text();
      console.error("Razorpay Payment Link creation failed:", errText);
      throw new Error(`Razorpay Payment Link creation failed: ${errText}`);
    }

    const paymentLinkData = await paymentLinkRes.json();
    console.log(`Razorpay Payment Link created: ${paymentLinkData.id}, short_url: ${paymentLinkData.short_url}`);

    // Update local subscription table
    const { error: updateSubLinkErr } = await adminClient
      .from("subscriptions")
      .update({
        status: "pending_payment",
        razorpay_payment_link_id: paymentLinkData.id,
        updated_at: new Date().toISOString()
      })
      .eq("id", kaeoSubId);

    if (updateSubLinkErr) {
      console.error("Failed to update subscription link ID locally:", updateSubLinkErr);
    }

    // Create billing_payments entry for audit trail
    console.log("Creating billing_payments entry for audit trail...");
    const { error: paymentErr } = await adminClient
      .from("billing_payments")
      .insert({
        organization_id,
        subscription_id: kaeoSubId,
        plan_id,
        amount_inr: amountInINR,
        status: paymentLinkData.status || "created",
        provider: "razorpay",
        razorpay_payment_link_id: paymentLinkData.id,
        payload_json: paymentLinkData
      });

    if (paymentErr) {
      console.error("Failed to insert billing payment audit record:", paymentErr);
    }

    // 9. Return the hosted redirect URL
    return new Response(
      JSON.stringify({
        checkout_url: paymentLinkData.short_url,
        razorpay_payment_link_id: paymentLinkData.id,
        status: paymentLinkData.status
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
