-- Migration: 0014_rls_policies_hardening.sql
-- Goal: Standardize and harden security/RLS policies using user_id_is_member(organization_id)
-- Constraint: Avoid breaking active database accesses, secure service-role tables, and prevent loop issues.

-- 1. HARDEN CLIENT ACCESS
-- Restrict selection of clients so profiles can only read clients belonging to organizations they are members of.
DROP POLICY IF EXISTS "clients_select" ON public.clients;
CREATE POLICY "clients_select" ON public.clients
    FOR SELECT USING (public.user_id_is_member(organization_id));

DROP POLICY IF EXISTS "clients_insert" ON public.clients;
CREATE POLICY "clients_insert" ON public.clients
    FOR INSERT WITH CHECK (public.user_id_is_member(organization_id));


-- 2. STANDARDIZE REPORTS
-- Replace subqueries with user_id_is_member helper.
DROP POLICY IF EXISTS "Users can view reports for their organization" ON public.reports;
CREATE POLICY "Users can view reports for their organization" ON public.reports
    FOR SELECT USING (public.user_id_is_member(organization_id));

DROP POLICY IF EXISTS "Users can insert reports for their organization" ON public.reports;
CREATE POLICY "Users can insert reports for their organization" ON public.reports
    FOR INSERT WITH CHECK (public.user_id_is_member(organization_id));

DROP POLICY IF EXISTS "Users can update reports for their organization" ON public.reports;
CREATE POLICY "Users can update reports for their organization" ON public.reports
    FOR UPDATE USING (public.user_id_is_member(organization_id));

DROP POLICY IF EXISTS "Users can delete reports for their organization" ON public.reports;
CREATE POLICY "Users can delete reports for their organization" ON public.reports
    FOR DELETE USING (public.user_id_is_member(organization_id));


-- 3. STANDARDIZE ASK KAEO CHAT THREADS & MESSAGES
DROP POLICY IF EXISTS "Users can view chat_threads for their organization" ON public.chat_threads;
CREATE POLICY "Users can view chat_threads for their organization" ON public.chat_threads
    FOR SELECT USING (public.user_id_is_member(organization_id));

DROP POLICY IF EXISTS "Users can insert chat_threads for their organization" ON public.chat_threads;
CREATE POLICY "Users can insert chat_threads for their organization" ON public.chat_threads
    FOR INSERT WITH CHECK (public.user_id_is_member(organization_id));

DROP POLICY IF EXISTS "Users can update chat_threads for their organization" ON public.chat_threads;
CREATE POLICY "Users can update chat_threads for their organization" ON public.chat_threads
    FOR UPDATE USING (public.user_id_is_member(organization_id));

DROP POLICY IF EXISTS "Users can view chat_messages for their organization" ON public.chat_messages;
CREATE POLICY "Users can view chat_messages for their organization" ON public.chat_messages
    FOR SELECT USING (public.user_id_is_member(organization_id));

DROP POLICY IF EXISTS "Users can insert chat_messages for their organization" ON public.chat_messages;
CREATE POLICY "Users can insert chat_messages for their organization" ON public.chat_messages
    FOR INSERT WITH CHECK (public.user_id_is_member(organization_id));


-- 4. STANDARDIZE SUBSCRIPTIONS & USAGE EVENTS
DROP POLICY IF EXISTS "Users can view subscriptions for their organization" ON public.subscriptions;
CREATE POLICY "Users can view subscriptions for their organization" ON public.subscriptions
    FOR SELECT TO authenticated USING (public.user_id_is_member(organization_id));

DROP POLICY IF EXISTS "Owners and admins can insert subscriptions for their organization" ON public.subscriptions;
CREATE POLICY "Owners and admins can insert subscriptions for their organization" ON public.subscriptions
    FOR INSERT TO authenticated WITH CHECK (public.user_id_is_member(organization_id));

DROP POLICY IF EXISTS "Owners and admins can update subscriptions for their organization" ON public.subscriptions;
CREATE POLICY "Owners and admins can update subscriptions for their organization" ON public.subscriptions
    FOR UPDATE TO authenticated USING (public.user_id_is_member(organization_id));

DROP POLICY IF EXISTS "Users can view usage events for their organization" ON public.usage_events;
CREATE POLICY "Users can view usage events for their organization" ON public.usage_events
    FOR SELECT TO authenticated USING (public.user_id_is_member(organization_id));

DROP POLICY IF EXISTS "Users can insert usage events for their organization" ON public.usage_events;
CREATE POLICY "Users can insert usage events for their organization" ON public.usage_events
    FOR INSERT TO authenticated WITH CHECK (public.user_id_is_member(organization_id));


-- 5. SECURE WEBHOOK EVENTS (SERVICE-ROLE ONLY)
-- Keep razorpay_events service-role-only to prevent client-side leaks.
DROP POLICY IF EXISTS "select_razorpay_events" ON public.razorpay_events;
