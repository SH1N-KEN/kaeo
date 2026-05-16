-- Add organization_id and client_id to import_mappings for consistent RLS and scoped reset
ALTER TABLE public.import_mappings 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE;

-- Update RLS policies for import_mappings to use direct organization_id check
DROP POLICY IF EXISTS "mappings_select" ON public.import_mappings;
CREATE POLICY "mappings_select" ON public.import_mappings
    FOR SELECT USING (user_id_is_member(organization_id));

DROP POLICY IF EXISTS "mappings_insert" ON public.import_mappings;
CREATE POLICY "mappings_insert" ON public.import_mappings
    FOR INSERT WITH CHECK (user_id_is_member(organization_id));

-- Add index
CREATE INDEX IF NOT EXISTS idx_mappings_org_client ON public.import_mappings(organization_id, client_id);
