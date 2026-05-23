-- Phase 15: Invoices and Payment Matching Foundation

-- 1. CREATE INVOICES TABLE
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    file_name TEXT,
    file_path TEXT,
    vendor_name TEXT,
    invoice_number TEXT,
    invoice_date DATE,
    due_date DATE,
    subtotal NUMERIC,
    tax_amount NUMERIC,
    total_amount NUMERIC,
    currency TEXT DEFAULT 'INR',
    gstin TEXT,
    status TEXT DEFAULT 'uploaded', -- 'uploaded', 'extracted', 'needs_review', 'matched', 'paid', 'overdue', 'ignored'
    confidence NUMERIC,
    extracted_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE RLS for invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- POLICIES for invoices
CREATE POLICY "invoices_select" ON public.invoices
    FOR SELECT USING (user_id_is_member(organization_id));

CREATE POLICY "invoices_insert" ON public.invoices
    FOR INSERT WITH CHECK (user_id_is_member(organization_id));

CREATE POLICY "invoices_update" ON public.invoices
    FOR UPDATE USING (user_id_is_member(organization_id));

CREATE POLICY "invoices_delete" ON public.invoices
    FOR DELETE USING (user_id_is_member(organization_id));

-- Trigger for handle_updated_at on invoices
CREATE TRIGGER on_invoices_updated
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. CREATE INVOICE LINE ITEMS TABLE
CREATE TABLE IF NOT EXISTS public.invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    description TEXT,
    quantity NUMERIC,
    unit_price NUMERIC,
    amount NUMERIC,
    tax_rate NUMERIC,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- ENABLE RLS for invoice_line_items
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

-- POLICIES for invoice_line_items (check user member status via parent invoice)
CREATE POLICY "invoice_line_items_select" ON public.invoice_line_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.invoices i 
            WHERE i.id = invoice_id AND user_id_is_member(i.organization_id)
        )
    );

CREATE POLICY "invoice_line_items_insert" ON public.invoice_line_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.invoices i 
            WHERE i.id = invoice_id AND user_id_is_member(i.organization_id)
        )
    );

CREATE POLICY "invoice_line_items_update" ON public.invoice_line_items
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.invoices i 
            WHERE i.id = invoice_id AND user_id_is_member(i.organization_id)
        )
    );

CREATE POLICY "invoice_line_items_delete" ON public.invoice_line_items
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.invoices i 
            WHERE i.id = invoice_id AND user_id_is_member(i.organization_id)
        )
    );

-- 3. CREATE INVOICE MATCHES TABLE
CREATE TABLE IF NOT EXISTS public.invoice_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    match_status TEXT DEFAULT 'suggested', -- 'suggested', 'matched', 'mismatch', 'paid', 'unpaid', 'ignored'
    confidence NUMERIC,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE RLS for invoice_matches
ALTER TABLE public.invoice_matches ENABLE ROW LEVEL SECURITY;

-- POLICIES for invoice_matches (check user member status via parent invoice)
CREATE POLICY "invoice_matches_select" ON public.invoice_matches
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.invoices i 
            WHERE i.id = invoice_id AND user_id_is_member(i.organization_id)
        )
    );

CREATE POLICY "invoice_matches_insert" ON public.invoice_matches
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.invoices i 
            WHERE i.id = invoice_id AND user_id_is_member(i.organization_id)
        )
    );

CREATE POLICY "invoice_matches_update" ON public.invoice_matches
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.invoices i 
            WHERE i.id = invoice_id AND user_id_is_member(i.organization_id)
        )
    );

CREATE POLICY "invoice_matches_delete" ON public.invoice_matches
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.invoices i 
            WHERE i.id = invoice_id AND user_id_is_member(i.organization_id)
        )
    );
