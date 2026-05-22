-- Phase 14: Spend Control Workspace Core

-- 1. ADDITIVE COLUMNS FOR TRANSACTIONS
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS review_status text DEFAULT 'new', -- 'new', 'needs_review', 'reviewed', 'ignored', 'resolved'
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_note text;

-- 2. SPEND RULES TABLE
CREATE TABLE IF NOT EXISTS public.spend_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    rule_type TEXT NOT NULL, -- e.g., 'duplicate_payment', 'high_value_payment', 'subscription_threshold', 'unknown_vendor', 'uncategorized_transaction'
    name TEXT,
    enabled BOOLEAN DEFAULT true,
    threshold_amount NUMERIC,
    threshold_days INT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE RLS for spend_rules
ALTER TABLE public.spend_rules ENABLE ROW LEVEL SECURITY;

-- POLICIES for spend_rules
CREATE POLICY "spend_rules_select" ON public.spend_rules
    FOR SELECT USING (user_id_is_member(organization_id));

CREATE POLICY "spend_rules_insert" ON public.spend_rules
    FOR INSERT WITH CHECK (user_id_is_member(organization_id));

CREATE POLICY "spend_rules_update" ON public.spend_rules
    FOR UPDATE USING (user_id_is_member(organization_id));

CREATE POLICY "spend_rules_delete" ON public.spend_rules
    FOR DELETE USING (user_id_is_member(organization_id));

-- Updated At trigger for spend_rules
CREATE TRIGGER on_spend_rules_updated
    BEFORE UPDATE ON public.spend_rules
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add default rules for new organizations or allow frontend to seed them
-- We will handle defaults in application code.

-- 3. AUDIT EVENTS TABLE
CREATE TABLE IF NOT EXISTS public.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- 'transaction_marked_reviewed', 'risk_resolved', 'report_generated', etc.
    entity_type TEXT, -- 'transaction', 'risk', 'rule', 'report'
    entity_id UUID,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE RLS for audit_events
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- POLICIES for audit_events
CREATE POLICY "audit_events_select" ON public.audit_events
    FOR SELECT USING (user_id_is_member(organization_id));

CREATE POLICY "audit_events_insert" ON public.audit_events
    FOR INSERT WITH CHECK (user_id_is_member(organization_id));

-- (Audit events should be immutable, no update/delete policies by default)
