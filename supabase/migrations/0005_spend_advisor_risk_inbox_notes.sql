-- Spend Advisor, Risk Inbox, and Notes Migration

-- Types for Risk Events
DO $$ BEGIN
    CREATE TYPE public.risk_severity AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.risk_status AS ENUM ('open', 'reviewed', 'confirmed', 'false_positive', 'ignored');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Vendors Table
CREATE TABLE IF NOT EXISTS public.vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    total_spend NUMERIC(20, 2) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    monthly_average NUMERIC(20, 2) DEFAULT 0,
    recurrence_pattern TEXT, -- e.g., 'monthly', 'weekly', 'irregular'
    trend TEXT, -- e.g., 'increasing', 'decreasing', 'stable'
    category TEXT,
    recommendation TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, name)
);

-- Risk Events Table
CREATE TABLE IF NOT EXISTS public.risk_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    severity public.risk_severity DEFAULT 'low',
    risk_type TEXT NOT NULL,
    amount_at_risk NUMERIC(20, 2) DEFAULT 0,
    evidence JSONB DEFAULT '{}'::jsonb,
    suggested_action TEXT,
    status public.risk_status DEFAULT 'open',
    related_transaction_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    parent_type TEXT NOT NULL, -- 'risk_event', 'vendor', etc.
    parent_id UUID NOT NULL,
    content TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendors_select" ON public.vendors;
CREATE POLICY "vendors_select" ON public.vendors FOR SELECT USING (user_id_is_member(organization_id));
DROP POLICY IF EXISTS "vendors_insert" ON public.vendors;
CREATE POLICY "vendors_insert" ON public.vendors FOR INSERT WITH CHECK (user_id_is_member(organization_id));
DROP POLICY IF EXISTS "vendors_update" ON public.vendors;
CREATE POLICY "vendors_update" ON public.vendors FOR UPDATE USING (user_id_is_member(organization_id));
DROP POLICY IF EXISTS "vendors_delete" ON public.vendors;
CREATE POLICY "vendors_delete" ON public.vendors FOR DELETE USING (user_id_is_member(organization_id));

ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "risk_select" ON public.risk_events;
CREATE POLICY "risk_select" ON public.risk_events FOR SELECT USING (user_id_is_member(organization_id));
DROP POLICY IF EXISTS "risk_insert" ON public.risk_events;
CREATE POLICY "risk_insert" ON public.risk_events FOR INSERT WITH CHECK (user_id_is_member(organization_id));
DROP POLICY IF EXISTS "risk_update" ON public.risk_events;
CREATE POLICY "risk_update" ON public.risk_events FOR UPDATE USING (user_id_is_member(organization_id));
DROP POLICY IF EXISTS "risk_delete" ON public.risk_events;
CREATE POLICY "risk_delete" ON public.risk_events FOR DELETE USING (user_id_is_member(organization_id));

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notes_select" ON public.notes;
CREATE POLICY "notes_select" ON public.notes FOR SELECT USING (user_id_is_member(organization_id));
DROP POLICY IF EXISTS "notes_insert" ON public.notes;
CREATE POLICY "notes_insert" ON public.notes FOR INSERT WITH CHECK (user_id_is_member(organization_id));
DROP POLICY IF EXISTS "notes_update" ON public.notes;
CREATE POLICY "notes_update" ON public.notes FOR UPDATE USING (user_id_is_member(organization_id));
DROP POLICY IF EXISTS "notes_delete" ON public.notes;
CREATE POLICY "notes_delete" ON public.notes FOR DELETE USING (user_id_is_member(organization_id));

-- Indices
CREATE INDEX IF NOT EXISTS idx_vendors_client ON public.vendors(client_id);
CREATE INDEX IF NOT EXISTS idx_risk_client ON public.risk_events(client_id);
CREATE INDEX IF NOT EXISTS idx_notes_parent ON public.notes(parent_id);
