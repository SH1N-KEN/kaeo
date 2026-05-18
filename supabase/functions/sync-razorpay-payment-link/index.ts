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
    const { organization_id, subscription_id, razorpay_payment_link_id } = await req.json();
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "Missing required parameter: organization_id" }),
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
        JSON.stringify({ error: "Unauthorized access to this organization." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Resolve paymentLinkId and targetSubId
    let paymentLinkId = razorpay_payment_link_id;
    let targetSubId = subscription_id;

    if (!paymentLinkId) {
      // Find the latest pending subscription for the organization
      const { data: latestSub, error: subErr } = await adminClient
        .from("subscriptions")
        .select("id, razorpay_payment_link_id")
        .eq("organization_id", organization_id)
        .not("razorpay_payment_link_id", "is", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subErr) {
        console.error("Error querying latest subscription:", subErr);
      }

      if (latestSub) {
        paymentLinkId = latestSub.razorpay_payment_link_id;
        targetSubId = targetSubId || latestSub.id;
        console.log(`Resolved latest pending payment link ID: ${paymentLinkId} and sub ID: ${targetSubId}`);
      }
    }

    if (!paymentLinkId) {
      // Fallback: search billing_payments
      const { data: latestPay, error: payErr } = await adminClient
        .from("billing_payments")
        .select("subscription_id, razorpay_payment_link_id")
        .eq("organization_id", organization_id)
        .eq("status", "created")
        .not("razorpay_payment_link_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (payErr) {
        console.error("Error querying latest payment audit log:", payErr);
      }

      if (latestPay) {
        paymentLinkId = latestPay.razorpay_payment_link_id;
        targetSubId = targetSubId || latestPay.subscription_id;
        console.log(`Resolved latest pending payment link ID from billing_payments: ${paymentLinkId}`);
      }
    }

    if (!paymentLinkId) {
      return new Response(
        JSON.stringify({ 
          synced: false, 
          message: "No pending Razorpay checkout or payment link found for this organization." 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Call Razorpay API to fetch payment link status
    console.log(`Calling Razorpay API to fetch payment link details: ${paymentLinkId}...`);
    const razorpayHeaders = {
      "Authorization": `Basic ${btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`)}`,
      "Content-Type": "application/json",
    };

    const linkRes = await fetch(`https://api.razorpay.com/v1/payment_links/${paymentLinkId}`, {
      method: "GET",
      headers: razorpayHeaders,
    });

    if (!linkRes.ok) {
      const errText = await linkRes.text();
      console.error(`Razorpay API payment link fetch failed for ${paymentLinkId}:`, errText);
      return new Response(
        JSON.stringify({ error: `Razorpay API error: ${errText}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const linkData = await linkRes.json();
    const razorpayStatus = linkData.status; // status can be created, authorized, paid, expired, cancelled
    console.log(`Razorpay Payment Link status is: ${razorpayStatus}`);

    let synced = false;
    let subscriptionStatus = "pending_payment";
    let planId = "free";

    // 6. If Paid, update DB subscriptions and billing_payments
    if (razorpayStatus === "paid") {
      const notes = linkData.notes || linkData.entity?.notes || {};
      const notesOrgId = notes.organization_id || organization_id;
      const notesPlanId = notes.plan_id || "starter";
      const notesBillingCycle = notes.billing_cycle || "monthly";
      const notesKaeoSubId = notes.kaeo_subscription_id || targetSubId;

      planId = notesPlanId;

      // Determine activation period bounds
      const periodStart = new Date().toISOString();
      const daysToAdd = (notesBillingCycle === "yearly") ? 365 : 30;
      const periodEnd = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString();

      const updatePayload = {
        plan_id: notesPlanId,
        status: "active",
        billing_cycle: notesBillingCycle,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        razorpay_payment_link_id: paymentLinkId,
        updated_at: new Date().toISOString()
      };

      let subUpdateSuccess = false;
      if (notesKaeoSubId) {
        const { data: updatedSub, error: subErr } = await adminClient
          .from("subscriptions")
          .update(updatePayload)
          .eq("id", notesKaeoSubId)
          .select("id");
        
        if (subErr) {
          console.error("Error updating subscription by kaeo_subscription_id:", subErr);
        } else if (updatedSub && updatedSub.length > 0) {
          subUpdateSuccess = true;
        }
      }

      if (!subUpdateSuccess) {
        const { data: updatedSub, error: subErr } = await adminClient
          .from("subscriptions")
          .update(updatePayload)
          .eq("organization_id", notesOrgId)
          .select("id");

        if (subErr) {
          console.error("Error updating subscription by organization_id:", subErr);
        } else if (updatedSub && updatedSub.length > 0) {
          subUpdateSuccess = true;
        }
      }

      if (!subUpdateSuccess) {
        console.log("No existing subscription row found to update. Inserting new subscription row...");
        const { error: subErr } = await adminClient
          .from("subscriptions")
          .insert({
            ...updatePayload,
            organization_id: notesOrgId
          });

        if (subErr) throw subErr;
      }

      subscriptionStatus = "active";
      console.log(`Successfully activated Kaeo subscription to plan: ${notesPlanId}`);

      // Extract payment ID if available
      let razorpayPaymentId = null;
      if (linkData.payments && linkData.payments.length > 0) {
        const successfulPayment = linkData.payments.find((p: any) => p.status === "captured" || p.status === "failed") || linkData.payments[0];
        if (successfulPayment) {
          razorpayPaymentId = successfulPayment.payment_id;
        }
      }

      // Update billing_payments audit trail
      console.log(`Updating billing_payments audit trail to status=paid for payment link: ${paymentLinkId}`);
      const { data: updateData, error: payUpdateErr } = await adminClient
        .from("billing_payments")
        .update({
          status: "paid",
          razorpay_payment_id: razorpayPaymentId,
          payload_json: linkData,
          updated_at: new Date().toISOString()
        })
        .eq("razorpay_payment_link_id", paymentLinkId)
        .select();

      if (payUpdateErr) {
        console.error("Error updating billing_payments during sync-razorpay-payment-link:", payUpdateErr);
      } else if (!updateData || updateData.length === 0) {
        // Fallback: If no existing audit row is found for this link, insert one
        console.log("No existing audit row found during sync, inserting new paid record in billing_payments...");
        const amountINR = Math.round((linkData.amount || 0) / 100);
        
        const insertPayload = {
          organization_id: notesOrgId,
          subscription_id: notesKaeoSubId || null,
          plan_id: notesPlanId,
          amount_inr: amountINR,
          status: "paid",
          provider: "razorpay",
          razorpay_payment_link_id: paymentLinkId,
          razorpay_payment_id: razorpayPaymentId,
          payload_json: linkData,
          updated_at: new Date().toISOString()
        };

        let payInsertErr;
        if (razorpayPaymentId) {
          const { error } = await adminClient
            .from("billing_payments")
            .upsert(insertPayload, { onConflict: "razorpay_payment_id" });
          payInsertErr = error;
        } else {
          const { error } = await adminClient
            .from("billing_payments")
            .insert(insertPayload);
          payInsertErr = error;
        }

        if (payInsertErr) {
          console.error("Failed to insert new billing_payments record:", payInsertErr);
        }
      }

      synced = true;
    } else {
      // Get current status of subscription from DB to return
      const { data: currentSub } = await adminClient
        .from("subscriptions")
        .select("status, plan_id")
        .eq("organization_id", organization_id)
        .maybeSingle();

      if (currentSub) {
        subscriptionStatus = currentSub.status;
        planId = currentSub.plan_id;
      }
    }

    return new Response(
      JSON.stringify({
        synced,
        razorpay_status: razorpayStatus,
        subscription_status: subscriptionStatus,
        plan_id: planId
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Unhandled sync-razorpay-payment-link error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to sync Razorpay payment link status." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
