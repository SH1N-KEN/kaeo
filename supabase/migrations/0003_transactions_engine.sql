-- PHASE 4: Transaction Engine

-- 1. TRANSACTIONS TABLE
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    import_id UUID REFERENCES public.imports(id) ON DELETE SET NULL,
    file_id UUID REFERENCES public.uploaded_files(id) ON DELETE SET NULL,
    
    transaction_date DATE,
    description TEXT NOT NULL,
    counterparty_name TEXT,
    counterparty_email TEXT,
    
    type TEXT DEFAULT 'unknown', -- 'income', 'expense', 'transfer', 'refund', 'failed_payment', 'unknown'
    status TEXT, -- 'completed', 'pending', 'cancelled', 'failed'
    
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'INR',
    fee_amount NUMERIC,
    net_amount NUMERIC,
    
    category TEXT,
    source_provider TEXT, -- 'Razorpay', 'Stripe', 'Bank Statement', etc.
    reference TEXT, -- UTR, Reference Number
    external_id TEXT, -- ID from source system
    
    raw_row_json JSONB DEFAULT '{}'::jsonb,
    warnings_json JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ENABLE RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- POLICIES (Non-recursive)
CREATE POLICY "transactions_select" ON public.transactions
    FOR SELECT USING (user_id_is_member(organization_id));

CREATE POLICY "transactions_insert" ON public.transactions
    FOR INSERT WITH CHECK (user_id_is_member(organization_id));

CREATE POLICY "transactions_update" ON public.transactions
    FOR UPDATE USING (user_id_is_member(organization_id));

CREATE POLICY "transactions_delete" ON public.transactions
    FOR DELETE USING (user_id_is_member(organization_id));

-- Updated At trigger
DROP TRIGGER IF EXISTS on_transaction_updated ON public.transactions;
CREATE TRIGGER on_transaction_updated
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_transactions_org_client ON public.transactions(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_import ON public.transactions(import_id);
