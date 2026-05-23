-- Migration: 0017_onboarding_and_client_context.sql
-- Goal: Add onboarding metadata, account modes, and client metadata

-- 1. Extend public.profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_mode text CHECK (account_mode IN ('business_owner', 'accountant'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_answers jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS default_organization_id uuid;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'profiles_default_organization_id_fkey'
    ) THEN
        ALTER TABLE public.profiles 
        ADD CONSTRAINT profiles_default_organization_id_fkey 
        FOREIGN KEY (default_organization_id) 
        REFERENCES public.organizations(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Extend public.clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- 3. Add UPDATE policy for public.clients to allow members to edit clients
DROP POLICY IF EXISTS "clients_update" ON public.clients;
CREATE POLICY "clients_update" ON public.clients
    FOR UPDATE USING (public.user_id_is_member(organization_id));
