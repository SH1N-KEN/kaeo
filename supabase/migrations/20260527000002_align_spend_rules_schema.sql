-- Migration: Align spend_rules schema with application code expectations
--
-- The newer table migration (20260526232717) created spend_rules with:
--   rule_key, rule_name (no name, no threshold_amount, no threshold_days, no rule_type)
--
-- The application code (spendRulesEngine.ts, libbyActions.ts, SpendRules.tsx) uses:
--   rule_type, name, threshold_amount, threshold_days
--
-- This migration adds the missing columns and backfills them from existing values.

-- 1. Add rule_type if missing (the canonical column used by the app engine)
ALTER TABLE public.spend_rules ADD COLUMN IF NOT EXISTS rule_type text;

-- 2. Backfill rule_type from rule_key (newer schema used rule_key)
UPDATE public.spend_rules
SET rule_type = COALESCE(rule_type, rule_key)
WHERE rule_type IS NULL;

-- 3. Add name if missing (the app code uses name for display labels)
ALTER TABLE public.spend_rules ADD COLUMN IF NOT EXISTS name text;

-- 4. Backfill name from rule_name (newer schema used rule_name) or rule_type
UPDATE public.spend_rules
SET name = COALESCE(name, rule_name, rule_key, rule_type)
WHERE name IS NULL;

-- 5. Add threshold_amount if missing (used by high_value_payment and subscription_threshold rules)
ALTER TABLE public.spend_rules ADD COLUMN IF NOT EXISTS threshold_amount numeric;

-- 6. Add threshold_days if missing (used by duplicate_payment rule)
ALTER TABLE public.spend_rules ADD COLUMN IF NOT EXISTS threshold_days integer;

-- 7. Backfill threshold_amount from value column if it exists (newer schema used value)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'spend_rules'
      AND column_name = 'value'
  ) THEN
    UPDATE public.spend_rules
    SET threshold_amount = COALESCE(threshold_amount, value::numeric)
    WHERE threshold_amount IS NULL AND value IS NOT NULL;
  END IF;
END;
$$;
