-- Additive migration for Currency and FX Conversion System

-- Add base_currency to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS base_currency TEXT DEFAULT 'INR';

-- Add FX fields to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'INR';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS original_amount NUMERIC;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS original_currency TEXT DEFAULT 'INR';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC DEFAULT 1;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS amount_in_base_currency NUMERIC;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS fx_date DATE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS fx_source TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS fx_metadata JSONB DEFAULT '{}'::jsonb;
