-- 0012_billing_plans_subscriptions.sql

-- 1. BILLING PLANS TABLE
CREATE TABLE IF NOT EXISTS public.billing_plans (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text,
    price_monthly_inr integer NOT NULL DEFAULT 0,
    price_yearly_inr integer,
    max_clients integer,
    max_transactions_per_month integer,
    max_file_uploads_per_month integer,
    max_ai_messages_per_month integer,
    max_reports_per_month integer,
    features_json jsonb DEFAULT '[]'::jsonb,
    is_active boolean DEFAULT true,
    sort_order integer DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 2. SUBSCRIPTIONS TABLE
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    plan_id text REFERENCES public.billing_plans(id),
    status text DEFAULT 'trialing', -- 'trialing', 'active', 'past_due', 'canceled', 'unpaid'
    billing_cycle text DEFAULT 'monthly', -- 'monthly', 'yearly'
    current_period_start timestamptz DEFAULT now(),
    current_period_end timestamptz,
    trial_ends_at timestamptz,
    cancel_at_period_end boolean DEFAULT false,
    razorpay_customer_id text,
    razorpay_subscription_id text,
    razorpay_plan_id text,
    razorpay_payment_link_id text,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(organization_id)
);

-- 3. USAGE EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.usage_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
    event_type text NOT NULL, -- 'transaction_imported', 'file_uploaded', 'ai_message_sent', 'report_generated', 'client_created'
    quantity integer DEFAULT 1,
    metadata_json jsonb DEFAULT '{}'::jsonb,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.billing_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- POLICIES

-- Billing Plans
CREATE POLICY "Users can view active billing plans"
    ON public.billing_plans FOR SELECT
    TO authenticated
    USING (is_active = true);

-- Subscriptions
CREATE POLICY "Users can view subscriptions for their organization"
    ON public.subscriptions FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT id FROM public.organizations WHERE created_by = auth.uid() OR
            id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Owners and admins can insert subscriptions for their organization"
    ON public.subscriptions FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT id FROM public.organizations WHERE created_by = auth.uid() OR
            id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
        )
    );

CREATE POLICY "Owners and admins can update subscriptions for their organization"
    ON public.subscriptions FOR UPDATE
    TO authenticated
    USING (
        organization_id IN (
            SELECT id FROM public.organizations WHERE created_by = auth.uid() OR
            id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
        )
    );

-- Usage Events
CREATE POLICY "Users can view usage events for their organization"
    ON public.usage_events FOR SELECT
    TO authenticated
    USING (
        organization_id IN (
            SELECT id FROM public.organizations WHERE created_by = auth.uid() OR
            id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert usage events for their organization"
    ON public.usage_events FOR INSERT
    TO authenticated
    WITH CHECK (
        organization_id IN (
            SELECT id FROM public.organizations WHERE created_by = auth.uid() OR
            id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
        )
    );

-- UPDATED AT TRIGGERS
CREATE OR REPLACE FUNCTION update_billing_plans_mod_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_billing_plans_mod_time ON public.billing_plans;
CREATE TRIGGER update_billing_plans_mod_time
BEFORE UPDATE ON public.billing_plans
FOR EACH ROW
EXECUTE FUNCTION update_billing_plans_mod_time();

CREATE OR REPLACE FUNCTION update_subscriptions_mod_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscriptions_mod_time ON public.subscriptions;
CREATE TRIGGER update_subscriptions_mod_time
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_subscriptions_mod_time();

-- SEED PLANS (Idempotent with UPSERT)
INSERT INTO public.billing_plans (
    id, name, description, price_monthly_inr, price_yearly_inr, 
    max_clients, max_transactions_per_month, max_file_uploads_per_month, 
    max_ai_messages_per_month, max_reports_per_month, features_json, sort_order
) VALUES 
(
    'free', 'Free', 'Great for exploring Kaeo and testing files.', 0, 0,
    1, 500, 5, 20, 3, 
    '["1 Active Client", "500 Transactions / mo", "5 File Uploads / mo", "20 AI Advisor Messages / mo", "3 Financial Reports / mo", "Deterministic Calculations", "Standard Risk Scan"]'::jsonb,
    0
),
(
    'starter', 'Starter', 'For small business operators starting clean bookkeeping.', 999, 9990,
    3, 5000, 50, 300, 25,
    '["3 Active Clients", "5,000 Transactions / mo", "50 File Uploads / mo", "300 AI Advisor Messages / mo", "25 Financial Reports / mo", "Real-Time Spend Advisor", "Risk Inbox & Notes", "Live Web Research Access"]'::jsonb,
    1
),
(
    'growth', 'Growth', 'Perfect for growing brands and operators managing scale.', 2999, 29990,
    10, 25000, 200, 1500, 100,
    '["10 Active Clients", "25,000 Transactions / mo", "200 File Uploads / mo", "1,500 AI Advisor Messages / mo", "100 Financial Reports / mo", "Priority AI Advisor Context", "Full Multi-Currency Support", "Advanced CFO Report Pack"]'::jsonb,
    2
),
(
    'accountant', 'Accountant', 'For accounting firms and CFOs managing multiple books.', 7999, 79990,
    50, 100000, 1000, 5000, 500,
    '["50 Active Clients", "100,000 Transactions / mo", "1,000 File Uploads / mo", "5,000 AI Advisor Messages / mo", "500 Financial Reports / mo", "Dedicated Dashboard Settings", "Custom Logo Reports", "Premium Team Permissions"]'::jsonb,
    3
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_monthly_inr = EXCLUDED.price_monthly_inr,
    price_yearly_inr = EXCLUDED.price_yearly_inr,
    max_clients = EXCLUDED.max_clients,
    max_transactions_per_month = EXCLUDED.max_transactions_per_month,
    max_file_uploads_per_month = EXCLUDED.max_file_uploads_per_month,
    max_ai_messages_per_month = EXCLUDED.max_ai_messages_per_month,
    max_reports_per_month = EXCLUDED.max_reports_per_month,
    features_json = EXCLUDED.features_json,
    sort_order = EXCLUDED.sort_order,
    updated_at = now();
