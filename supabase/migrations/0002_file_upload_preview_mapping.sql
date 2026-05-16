-- PHASE 3: File Upload, Preview, and Mapping (STABILIZED)

-- 1. UPLOADED FILES
CREATE TABLE IF NOT EXISTS public.uploaded_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL, -- 'csv', 'xlsx', 'pdf'
    file_size BIGINT,
    storage_path TEXT NOT NULL,
    status TEXT DEFAULT 'uploaded', -- 'uploaded', 'processing', 'parsed', 'mapped', 'imported', 'failed'
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. IMPORTS (A specific ingestion session)
CREATE TABLE IF NOT EXISTS public.imports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    file_id UUID REFERENCES public.uploaded_files(id) ON DELETE SET NULL,
    provider_detected TEXT, -- 'Razorpay', 'Stripe', etc.
    source_type TEXT, -- 'bank', 'gateway', 'erp'
    row_count INTEGER DEFAULT 0,
    raw_columns_json JSONB DEFAULT '[]',
    preview_rows_json JSONB DEFAULT '[]',
    status TEXT DEFAULT 'pending_mapping', -- 'processing', 'preview_ready', 'mapped', 'imported', 'failed'
    error_message TEXT,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. IMPORT MAPPINGS
CREATE TABLE IF NOT EXISTS public.import_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_id UUID REFERENCES public.imports(id) ON DELETE CASCADE,
    confirmed_mapping_json JSONB NOT NULL, -- { target_field: raw_column_index/name }
    confirmed_by UUID REFERENCES auth.users(id),
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE RLS
ALTER TABLE public.uploaded_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_mappings ENABLE ROW LEVEL SECURITY;

-- POLICIES (Non-recursive)

-- Uploaded Files
CREATE POLICY "files_select" ON public.uploaded_files
    FOR SELECT USING (user_id_is_member(organization_id));

CREATE POLICY "files_insert" ON public.uploaded_files
    FOR INSERT WITH CHECK (user_id_is_member(organization_id));

-- Imports
CREATE POLICY "imports_select" ON public.imports
    FOR SELECT USING (user_id_is_member(organization_id));

CREATE POLICY "imports_insert" ON public.imports
    FOR INSERT WITH CHECK (user_id_is_member(organization_id));

-- Import Mappings
CREATE POLICY "mappings_select" ON public.import_mappings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.imports i 
            WHERE i.id = import_id 
            AND user_id_is_member(i.organization_id)
        )
    );

CREATE POLICY "mappings_insert" ON public.import_mappings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.imports i 
            WHERE i.id = import_id 
            AND user_id_is_member(i.organization_id)
        )
    );

-- Updated At triggers
DROP TRIGGER IF EXISTS on_file_updated ON public.uploaded_files;
CREATE TRIGGER on_file_updated
    BEFORE UPDATE ON public.uploaded_files
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS on_import_updated ON public.imports;
CREATE TRIGGER on_import_updated
    BEFORE UPDATE ON public.imports
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Note: Ensure user_id_is_member function exists from 0001
