-- Phase 10: Razorpay Billing Integration Migration

-- 1. Add Razorpay Plan columns to billing_plans
ALTER TABLE public.billing_plans ADD COLUMN IF NOT EXISTS razorpay_plan_monthly_id text;
ALTER TABLE public.billing_plans ADD COLUMN IF NOT EXISTS razorpay_plan_yearly_id text;

-- 2. Create razorpay_events table for webhook idempotency & auditing
CREATE TABLE IF NOT EXISTS public.razorpay_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
    event_id text UNIQUE NOT NULL,
    event_type text NOT NULL,
    razorpay_entity_id text,
    payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
    processed boolean DEFAULT false,
    processing_error text,
    created_at timestamptz DEFAULT now(),
    processed_at timestamptz
);

-- 3. Create billing_payments table to log raw invoices/payments
CREATE TABLE IF NOT EXISTS public.billing_payments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
    plan_id text REFERENCES public.billing_plans(id),
    amount_inr integer NOT NULL, -- amount in Rupees
    currency text DEFAULT 'INR',
    status text DEFAULT 'created', -- 'created', 'captured', 'failed', etc.
    provider text DEFAULT 'razorpay',
    razorpay_payment_id text UNIQUE,
    razorpay_order_id text,
    razorpay_invoice_id text,
    razorpay_subscription_id text,
    razorpay_payment_link_id text,
    payload_json jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 4. Enable automatic timestamp updates on billing_payments
CREATE TRIGGER update_billing_payments_modtime
    BEFORE UPDATE ON public.billing_payments
    FOR EACH ROW
    EXECUTE FUNCTION public.update_modified_column();

-- 5. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_razorpay_events_event_id ON public.razorpay_events(event_id);
CREATE INDEX IF NOT EXISTS idx_razorpay_events_event_type ON public.razorpay_events(event_type);
CREATE INDEX IF NOT EXISTS idx_billing_payments_organization_id ON public.billing_payments(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_razorpay_payment_id ON public.billing_payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_billing_payments_razorpay_sub_id ON public.billing_payments(razorpay_subscription_id);

-- 6. Enable Row Level Security (RLS)
ALTER TABLE public.razorpay_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_payments ENABLE ROW LEVEL SECURITY;

-- 7. Add Policies
-- Only service_role can access or modify razorpay_events (default behavior when RLS is active but no public policy exists).
-- Org members can select billing_payments for their organization.
CREATE POLICY select_billing_payments ON public.billing_payments
    FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );
