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
    normalized_name TEXT NOT NULL,
    category TEXT,
    total_spend NUMERIC(20, 2) DEFAULT 0,
    monthly_average NUMERIC(20, 2) DEFAULT 0,
    transaction_count INTEGER DEFAULT 0,
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ,
    recurrence_pattern TEXT, -- monthly, weekly, quarterly, annual, irregular, unknown
    trend TEXT, -- rising, falling, flat, unknown
    recommendation TEXT, -- keep, review, downgrade, replace, cancel_candidate
    recommendation_reason TEXT,
    alternatives_json JSONB DEFAULT '[]'::jsonb,
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(client_id, normalized_name)
);

-- Risk Events Table
CREATE TABLE IF NOT EXISTS public.risk_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
    risk_type TEXT NOT NULL,
    severity public.risk_severity DEFAULT 'low',
    title TEXT NOT NULL,
    description TEXT,
    amount_at_risk NUMERIC(20, 2) DEFAULT 0,
    evidence_json JSONB DEFAULT '{}'::jsonb,
    suggested_action TEXT,
    status public.risk_status DEFAULT 'open',
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    assigned_to UUID REFERENCES auth.users(id),
    follow_up_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Notes Table
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- 'risk_event', 'vendor', etc.
    entity_id UUID NOT NULL,
    note TEXT NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
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
CREATE INDEX IF NOT EXISTS idx_notes_parent ON public.notes(entity_id);
