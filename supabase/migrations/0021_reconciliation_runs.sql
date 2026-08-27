-- Migration: 0021_reconciliation_runs.sql
-- Goal: Create reconciliation_runs and reconciliation_records tables with proper constraints, indices, RLS policies, and atomic insertion helper.

-- 1. Create reconciliation_runs table
CREATE TABLE IF NOT EXISTS public.reconciliation_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    bank_file_id UUID REFERENCES public.uploaded_files(id) ON DELETE SET NULL,
    processor_file_id UUID REFERENCES public.uploaded_files(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'completed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    summary JSONB NOT NULL,
    source_metadata JSONB NOT NULL
);

-- 2. Create reconciliation_records table
CREATE TABLE IF NOT EXISTS public.reconciliation_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES public.reconciliation_runs(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    processor_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    bank_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    processor_amount NUMERIC,
    bank_amount NUMERIC,
    normalized_amount NUMERIC,
    processor_date DATE,
    bank_date DATE,
    processor_description TEXT,
    bank_description TEXT,
    processor_reference TEXT,
    bank_reference TEXT,
    confidence NUMERIC,
    evidence JSONB,
    reason TEXT,
    audit_log JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ENABLE RLS
ALTER TABLE public.reconciliation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_records ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES

-- reconciliation_runs
DROP POLICY IF EXISTS "reconciliation_runs_select" ON public.reconciliation_runs;
CREATE POLICY "reconciliation_runs_select" ON public.reconciliation_runs
    FOR SELECT TO authenticated USING (public.user_id_is_member(workspace_id));

DROP POLICY IF EXISTS "reconciliation_runs_insert" ON public.reconciliation_runs;
CREATE POLICY "reconciliation_runs_insert" ON public.reconciliation_runs
    FOR INSERT TO authenticated WITH CHECK (public.user_id_is_member(workspace_id));

-- reconciliation_records
DROP POLICY IF EXISTS "reconciliation_records_select" ON public.reconciliation_records;
CREATE POLICY "reconciliation_records_select" ON public.reconciliation_records
    FOR SELECT TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.reconciliation_runs r
            WHERE r.id = run_id
            AND public.user_id_is_member(r.workspace_id)
        )
    );

DROP POLICY IF EXISTS "reconciliation_records_insert" ON public.reconciliation_records;
CREATE POLICY "reconciliation_records_insert" ON public.reconciliation_records
    FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.reconciliation_runs r
            WHERE r.id = run_id
            AND public.user_id_is_member(r.workspace_id)
        )
    );

-- 5. INDICES for performance
CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_workspace_client ON public.reconciliation_runs(workspace_id, client_id);
CREATE INDEX IF NOT EXISTS idx_reconciliation_records_run ON public.reconciliation_records(run_id);

-- 6. ATOMIC CREATION HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.create_reconciliation_run_atomic(
    p_workspace_id UUID,
    p_client_id UUID,
    p_bank_file_id UUID,
    p_processor_file_id UUID,
    p_summary JSONB,
    p_source_metadata JSONB,
    p_records JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_run_id UUID;
    v_record JSONB;
BEGIN
    -- Check permissions
    IF NOT public.user_id_is_member(p_workspace_id) THEN
        RAISE EXCEPTION 'Unauthorized: User is not a member of the target workspace';
    END IF;

    -- Insert the run
    INSERT INTO public.reconciliation_runs (
        workspace_id,
        client_id,
        bank_file_id,
        processor_file_id,
        status,
        summary,
        source_metadata
    )
    VALUES (
        p_workspace_id,
        p_client_id,
        p_bank_file_id,
        p_processor_file_id,
        'completed',
        p_summary,
        p_source_metadata
    )
    RETURNING id INTO v_run_id;

    -- Insert records
    FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
    LOOP
        INSERT INTO public.reconciliation_records (
            run_id,
            status,
            processor_transaction_id,
            bank_transaction_id,
            processor_amount,
            bank_amount,
            normalized_amount,
            processor_date,
            bank_date,
            processor_description,
            bank_description,
            processor_reference,
            bank_reference,
            confidence,
            evidence,
            reason,
            audit_log
        )
        VALUES (
            v_run_id,
            (v_record->>'status'),
            CASE WHEN (v_record->>'processor_transaction_id') IS NOT NULL AND (v_record->>'processor_transaction_id') <> '' THEN (v_record->>'processor_transaction_id')::UUID ELSE NULL END,
            CASE WHEN (v_record->>'bank_transaction_id') IS NOT NULL AND (v_record->>'bank_transaction_id') <> '' THEN (v_record->>'bank_transaction_id')::UUID ELSE NULL END,
            CASE WHEN (v_record->>'processor_amount') IS NOT NULL AND (v_record->>'processor_amount') <> '' THEN (v_record->>'processor_amount')::NUMERIC ELSE NULL END,
            CASE WHEN (v_record->>'bank_amount') IS NOT NULL AND (v_record->>'bank_amount') <> '' THEN (v_record->>'bank_amount')::NUMERIC ELSE NULL END,
            CASE WHEN (v_record->>'normalized_amount') IS NOT NULL AND (v_record->>'normalized_amount') <> '' THEN (v_record->>'normalized_amount')::NUMERIC ELSE NULL END,
            CASE WHEN (v_record->>'processor_date') IS NOT NULL AND (v_record->>'processor_date') <> '' THEN (v_record->>'processor_date')::DATE ELSE NULL END,
            CASE WHEN (v_record->>'bank_date') IS NOT NULL AND (v_record->>'bank_date') <> '' THEN (v_record->>'bank_date')::DATE ELSE NULL END,
            (v_record->>'processor_description'),
            (v_record->>'bank_description'),
            (v_record->>'processor_reference'),
            (v_record->>'bank_reference'),
            CASE WHEN (v_record->>'confidence') IS NOT NULL AND (v_record->>'confidence') <> '' THEN (v_record->>'confidence')::NUMERIC ELSE NULL END,
            (v_record->'evidence'),
            (v_record->>'reason'),
            (v_record->'audit_log')
        );
    END LOOP;

    RETURN v_run_id;
END;
$$;
