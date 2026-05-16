-- Fix import_mappings: add organization_id and client_id if missing and backfill from imports

-- Step 1: Add columns if they don't already exist
ALTER TABLE public.import_mappings
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE public.import_mappings
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE public.import_mappings
  ADD COLUMN IF NOT EXISTS file_id UUID REFERENCES public.uploaded_files(id) ON DELETE SET NULL;

ALTER TABLE public.import_mappings
  ADD COLUMN IF NOT EXISTS raw_columns_json JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.import_mappings
  ADD COLUMN IF NOT EXISTS suggested_mapping_json JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.import_mappings
  ADD COLUMN IF NOT EXISTS confidence NUMERIC(5, 2) DEFAULT 0;

ALTER TABLE public.import_mappings
  ADD COLUMN IF NOT EXISTS warnings_json JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.import_mappings
  ADD COLUMN IF NOT EXISTS mapping_status TEXT DEFAULT 'confirmed';

ALTER TABLE public.import_mappings
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

ALTER TABLE public.import_mappings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Step 2: Backfill organization_id and client_id from the parent imports table
UPDATE public.import_mappings im
SET
  organization_id = i.organization_id,
  client_id       = i.client_id,
  file_id         = i.file_id
FROM public.imports i
WHERE im.import_id = i.id
  AND (im.organization_id IS NULL OR im.client_id IS NULL);

-- Step 3: Replace RLS policies to use direct column checks (no JOIN needed)
ALTER TABLE public.import_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mappings_select" ON public.import_mappings;
CREATE POLICY "mappings_select" ON public.import_mappings
  FOR SELECT USING (user_id_is_member(organization_id));

DROP POLICY IF EXISTS "mappings_insert" ON public.import_mappings;
CREATE POLICY "mappings_insert" ON public.import_mappings
  FOR INSERT WITH CHECK (user_id_is_member(organization_id));

DROP POLICY IF EXISTS "mappings_update" ON public.import_mappings;
CREATE POLICY "mappings_update" ON public.import_mappings
  FOR UPDATE USING (user_id_is_member(organization_id));

DROP POLICY IF EXISTS "mappings_delete" ON public.import_mappings;
CREATE POLICY "mappings_delete" ON public.import_mappings
  FOR DELETE USING (user_id_is_member(organization_id));

-- Step 4: Indices
CREATE INDEX IF NOT EXISTS idx_mappings_org_client ON public.import_mappings(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_mappings_import_id  ON public.import_mappings(import_id);
