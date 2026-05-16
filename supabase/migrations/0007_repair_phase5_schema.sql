-- Phase 5 Schema Repair Migration
-- Safely adds all missing columns to risk_events, vendors, and notes tables.
-- Safe to run multiple times (uses ADD COLUMN IF NOT EXISTS).

-- =============================================================================
-- RISK EVENTS
-- =============================================================================

ALTER TABLE public.risk_events
  ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

ALTER TABLE public.risk_events
  ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

ALTER TABLE public.risk_events
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE public.risk_events
  ADD COLUMN IF NOT EXISTS evidence_json JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.risk_events
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id);

ALTER TABLE public.risk_events
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE public.risk_events
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

ALTER TABLE public.risk_events
  ADD COLUMN IF NOT EXISTS follow_up_at TIMESTAMPTZ;

ALTER TABLE public.risk_events
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Migrate old evidence column to evidence_json if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'risk_events' AND column_name = 'evidence'
  ) THEN
    UPDATE public.risk_events SET evidence_json = evidence WHERE evidence_json = '{}'::jsonb OR evidence_json IS NULL;
  END IF;
END $$;

-- Ensure delete policy exists for risk_events
DROP POLICY IF EXISTS "risk_delete" ON public.risk_events;
CREATE POLICY "risk_delete" ON public.risk_events
  FOR DELETE USING (user_id_is_member(organization_id));

-- =============================================================================
-- VENDORS
-- =============================================================================

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS normalized_name TEXT;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS recommendation_reason TEXT;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS alternatives_json JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS metadata_json JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Backfill normalized_name from display_name or name if null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'display_name'
  ) THEN
    UPDATE public.vendors SET normalized_name = lower(trim(display_name)) WHERE normalized_name IS NULL;
  END IF;
END $$;

UPDATE public.vendors SET normalized_name = lower(trim(name)) WHERE normalized_name IS NULL OR normalized_name = '';

-- Migrate old metadata column to metadata_json if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'metadata'
  ) THEN
    UPDATE public.vendors SET metadata_json = metadata WHERE metadata_json = '{}'::jsonb OR metadata_json IS NULL;
  END IF;
END $$;

-- Ensure delete policy exists for vendors
DROP POLICY IF EXISTS "vendors_delete" ON public.vendors;
CREATE POLICY "vendors_delete" ON public.vendors
  FOR DELETE USING (user_id_is_member(organization_id));

-- Drop old unique constraint on name, replace with normalized_name
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'vendors' AND constraint_name = 'vendors_client_id_name_key'
  ) THEN
    ALTER TABLE public.vendors DROP CONSTRAINT vendors_client_id_name_key;
  END IF;
END $$;

ALTER TABLE public.vendors
  DROP CONSTRAINT IF EXISTS vendors_client_id_normalized_name_key;

ALTER TABLE public.vendors
  ADD CONSTRAINT vendors_client_id_normalized_name_key UNIQUE (client_id, normalized_name);

-- =============================================================================
-- NOTES
-- =============================================================================

-- Rename parent_type -> entity_type and parent_id -> entity_id if old schema
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notes' AND column_name = 'parent_type'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notes' AND column_name = 'entity_type'
  ) THEN
    ALTER TABLE public.notes RENAME COLUMN parent_type TO entity_type;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notes' AND column_name = 'parent_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notes' AND column_name = 'entity_id'
  ) THEN
    ALTER TABLE public.notes RENAME COLUMN parent_id TO entity_id;
  END IF;
END $$;

-- Rename content -> note if old schema
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notes' AND column_name = 'content'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notes' AND column_name = 'note'
  ) THEN
    ALTER TABLE public.notes RENAME COLUMN content TO note;
  END IF;
END $$;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS entity_type TEXT;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS entity_id UUID;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS note TEXT;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Ensure delete policy exists for notes
DROP POLICY IF EXISTS "notes_delete" ON public.notes;
CREATE POLICY "notes_delete" ON public.notes
  FOR DELETE USING (user_id_is_member(organization_id));

-- =============================================================================
-- INDICES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_risk_events_client   ON public.risk_events(client_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_status   ON public.risk_events(status);
CREATE INDEX IF NOT EXISTS idx_vendors_client        ON public.vendors(client_id);
CREATE INDEX IF NOT EXISTS idx_vendors_normalized   ON public.vendors(normalized_name);
CREATE INDEX IF NOT EXISTS idx_notes_entity         ON public.notes(entity_id, entity_type);
