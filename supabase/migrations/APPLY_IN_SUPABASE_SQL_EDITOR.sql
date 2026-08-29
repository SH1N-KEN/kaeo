-- ============================================================
-- Run this SQL in the Supabase SQL Editor (Production patch)
-- ============================================================

-- 1. Add 'resolved' to risk_status enum
--    (needed because the app uses 'resolved' to close risk events)
ALTER TYPE public.risk_status ADD VALUE IF NOT EXISTS 'resolved';

-- 2. Align spend_rules table schema with application code
--    The app uses: rule_type, name, threshold_amount, threshold_days
--    A newer migration used: rule_key, rule_name (missing the above columns)

ALTER TABLE public.spend_rules ADD COLUMN IF NOT EXISTS rule_type text;
ALTER TABLE public.spend_rules ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.spend_rules ADD COLUMN IF NOT EXISTS threshold_amount numeric;
ALTER TABLE public.spend_rules ADD COLUMN IF NOT EXISTS threshold_days integer;

-- Backfill rule_type from rule_key
UPDATE public.spend_rules
SET rule_type = COALESCE(rule_type, rule_key)
WHERE rule_type IS NULL;

-- Backfill name from rule_name or rule_key
UPDATE public.spend_rules
SET name = COALESCE(name, rule_name, rule_key, rule_type)
WHERE name IS NULL;

-- 3. Add RLS Delete Policy on reconciliation_runs
--    (needed because resetting client data deletes reconciliation runs)
DROP POLICY IF EXISTS "reconciliation_runs_delete" ON public.reconciliation_runs;
CREATE POLICY "reconciliation_runs_delete" ON public.reconciliation_runs
    FOR DELETE TO authenticated USING (public.user_id_is_member(workspace_id));

-- 4. Reload PostgREST schema cache so changes take effect immediately
NOTIFY pgrst, 'reload schema';
