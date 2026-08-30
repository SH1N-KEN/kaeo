-- Migration: 0022_reconciliation_records_update_policy.sql
-- Goal: Add RLS UPDATE policy to reconciliation_records table so client-side actions (AI investigations resolutions) can persist updates.

DROP POLICY IF EXISTS "reconciliation_records_update" ON public.reconciliation_records;
CREATE POLICY "reconciliation_records_update" ON public.reconciliation_records
    FOR UPDATE TO authenticated USING (
        EXISTS (
            SELECT 1 FROM public.reconciliation_runs r
            WHERE r.id = run_id
            AND public.user_id_is_member(r.workspace_id)
        )
    ) WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.reconciliation_runs r
            WHERE r.id = run_id
            AND public.user_id_is_member(r.workspace_id)
        )
    );
