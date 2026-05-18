import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cryptographic Web Crypto HMAC signature verification helper
async function verifyRazorpaySignature(
  bodyText: string,
  receivedSignature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyBuf = encoder.encode(secret);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  const bodyBuf = encoder.encode(bodyText);
  const signatureBuf = await crypto.subtle.sign("HMAC", cryptoKey, bodyBuf);

  // Convert buffer to hex string
  const signatureArray = Array.from(new Uint8Array(signatureBuf));
  const expectedSignature = signatureArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return expectedSignature === receivedSignature;
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Webhook is POST only
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const RAZORPAY_WEBHOOK_SECRET = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.error("RAZORPAY_WEBHOOK_SECRET is missing in environment variables.");
      return new Response("Webhook secret not configured.", { status: 500 });
    }

    const receivedSignature = req.headers.get("x-razorpay-signature");
    if (!receivedSignature) {
      console.error("Missing x-razorpay-signature header.");
      return new Response("Missing signature header.", { status: 400 });
    }

    const rawBody = await req.text();

    // 1. Verify Signature
    const isSignatureValid = await verifyRazorpaySignature(
      rawBody,
      receivedSignature,
      RAZORPAY_WEBHOOK_SECRET
    );

    if (!isSignatureValid) {
      console.error("Signature verification failed.");
      return new Response("Invalid signature verification.", { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const eventId = payload.id;
    const eventType = payload.event;
    console.log(`Razorpay Webhook Event Received: ${eventId} - Type: ${eventType}`);

    // Create Admin client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Webhook Idempotency check: Have we processed this event before?
    const { data: existingEvent, error: checkErr } = await adminClient
      .from("razorpay_events")
      .select("id, processed")
      .eq("event_id", eventId)
      .maybeSingle();

    if (checkErr) {
      console.error("Failed to query existing razorpay_events:", checkErr);
    }

    if (existingEvent && existingEvent.processed) {
      console.log(`Event ${eventId} has already been processed successfully. Skipping.`);
      return new Response(JSON.stringify({ status: "skipped", message: "Duplicate event detected." }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 3. Log event initial entry in razorpay_events
    let eventLogId = "";
    if (existingEvent) {
      eventLogId = existingEvent.id;
    } else {
      // Find Organization Id if possible in payload notes
      let eventOrgId: string | null = null;
      const notes = payload.payload?.subscription?.entity?.notes || payload.payload?.payment?.entity?.notes;
      if (notes?.organization_id) {
        eventOrgId = notes.organization_id;
      }

      const { data: newLog, error: logErr } = await adminClient
        .from("razorpay_events")
        .insert({
          organization_id: eventOrgId,
          event_id: eventId,
          event_type: eventType,
          razorpay_entity_id: payload.payload?.subscription?.entity?.id || payload.payload?.payment?.entity?.id,
          payload_json: payload,
          processed: false,
        })
        .select("id")
        .single();

      if (logErr) {
        console.error("Failed to insert razorpay_events record:", logErr);
      } else {
        eventLogId = newLog.id;
      }
    }

    // 4. Handle Event types
    let processingError: string | null = null;
    try {
      if (eventType.startsWith("subscription.")) {
        const subEntity = payload.payload.subscription.entity;
        const razorpaySubscriptionId = subEntity.id;
        const razorpayStatus = subEntity.status;
        const currentStartSec = subEntity.current_start;
        const currentEndSec = subEntity.current_end;
        const notes = subEntity.notes;

        console.log(`Processing Subscription Event: ${razorpaySubscriptionId} status: ${razorpayStatus}`);

        // Try to match org
        let orgId = notes?.organization_id;
        let planId = notes?.plan_id;
        let billingCycle = notes?.billing_cycle;

        const { data: localSub } = await adminClient
          .from("subscriptions")
          .select("id, organization_id, plan_id, billing_cycle")
          .eq("razorpay_subscription_id", razorpaySubscriptionId)
          .maybeSingle();

        if (localSub) {
          orgId = orgId || localSub.organization_id;
          planId = planId || localSub.plan_id;
          billingCycle = billingCycle || localSub.billing_cycle;
        }

        if (!orgId) {
          throw new Error(`Could not resolve Organization for subscription ID ${razorpaySubscriptionId}`);
        }

        // Map Razorpay statuses to Kaeo subscription statuses
        let localStatus = "pending_payment";
        if (["activated", "authenticated", "charged"].includes(razorpayStatus)) {
          localStatus = "active";
        } else if (razorpayStatus === "paused") {
          localStatus = "paused";
        } else if (["cancelled", "expired"].includes(razorpayStatus)) {
          localStatus = "cancelled";
        } else if (razorpayStatus === "halted") {
          localStatus = "failed";
        } else {
          localStatus = razorpayStatus;
        }

        const currentPeriodStart = currentStartSec
          ? new Date(currentStartSec * 1000).toISOString()
          : new Date().toISOString();
        const currentPeriodEnd = currentEndSec
          ? new Date(currentEndSec * 1000).toISOString()
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Fallback 30 days

        // Update subscriptions table
        const updatePayload = {
          plan_id: planId || "starter", // Fallback if missing
          status: localStatus,
          billing_cycle: billingCycle || "monthly",
          current_period_start: currentPeriodStart,
          current_period_end: currentPeriodEnd,
          razorpay_subscription_id: razorpaySubscriptionId,
          updated_at: new Date().toISOString()
        };

        if (localSub) {
          const { error: subErr } = await adminClient
            .from("subscriptions")
            .update(updatePayload)
            .eq("id", localSub.id);
          if (subErr) throw subErr;
        } else {
          const { error: subErr } = await adminClient
            .from("subscriptions")
            .insert({
              ...updatePayload,
              organization_id: orgId
            });
          if (subErr) throw subErr;
        }
        console.log(`Successfully updated Kaeo subscription for org: ${orgId} to: ${localStatus}`);

      } else if (eventType === "payment.captured") {
        const paymentEntity = payload.payload.payment.entity;
        const paymentId = paymentEntity.id;
        const amountPaisa = paymentEntity.amount;
        const currency = paymentEntity.currency;
        const paymentStatus = paymentEntity.status;
        const orderId = paymentEntity.order_id;
        const invoiceId = paymentEntity.invoice_id;
        const subscriptionId = paymentEntity.subscription_id;
        const paymentLinkId = paymentEntity.payment_link_id;
        const notes = paymentEntity.notes;

        console.log(`Processing Payment Captured: ${paymentId} - Subscription: ${subscriptionId}`);

        // Try to match org and client sub
        let orgId = notes?.organization_id;
        let planId = notes?.plan_id;
        let subUUID: string | null = null;

        if (subscriptionId) {
          const { data: matchedSub } = await adminClient
            .from("subscriptions")
            .select("id, organization_id, plan_id")
            .eq("razorpay_subscription_id", subscriptionId)
            .maybeSingle();

          if (matchedSub) {
            subUUID = matchedSub.id;
            orgId = orgId || matchedSub.organization_id;
            planId = planId || matchedSub.plan_id;
          }
        }

        if (!orgId && paymentLinkId) {
          const { data: matchedSub } = await adminClient
            .from("subscriptions")
            .select("id, organization_id, plan_id")
            .eq("razorpay_payment_link_id", paymentLinkId)
            .maybeSingle();

          if (matchedSub) {
            subUUID = matchedSub.id;
            orgId = orgId || matchedSub.organization_id;
            planId = planId || matchedSub.plan_id;
          }
        }

        if (!orgId) {
          throw new Error(`Could not resolve Organization for payment ID ${paymentId}`);
        }

        // Insert payment audit log
        const amountINR = Math.round(amountPaisa / 100);
        const { error: payErr } = await adminClient
          .from("billing_payments")
          .upsert({
            organization_id: orgId,
            subscription_id: subUUID,
            plan_id: planId || "starter",
            amount_inr: amountINR,
            currency: currency,
            status: paymentStatus,
            provider: "razorpay",
            razorpay_payment_id: paymentId,
            razorpay_order_id: orderId,
            razorpay_invoice_id: invoiceId,
            razorpay_subscription_id: subscriptionId,
            razorpay_payment_link_id: paymentLinkId,
            payload_json: paymentEntity,
            updated_at: new Date().toISOString()
          }, { onConflict: "razorpay_payment_id" });

        if (payErr) throw payErr;
        console.log(`Payment successfully logged: ${paymentId} for amount ₹${amountINR}`);
      }
    } catch (err: any) {
      console.error(`Processing error on event ${eventId}:`, err);
      processingError = err.message || "Unknown error occurred.";
    }

    // 5. Mark event as processed (and record processing_error if failed)
    if (eventLogId) {
      const { error: markErr } = await adminClient
        .from("razorpay_events")
        .update({
          processed: processingError ? false : true,
          processing_error: processingError,
          processed_at: new Date().toISOString(),
        })
        .eq("id", eventLogId);

      if (markErr) {
        console.error(`Failed to update processed status of event log ${eventLogId}:`, markErr);
      }
    }

    return new Response(
      JSON.stringify({
        status: processingError ? "error" : "success",
        message: processingError ? `Failed: ${processingError}` : "Event processed successfully.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("Unhandled Razorpay Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
