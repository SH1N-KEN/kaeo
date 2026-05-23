-- Phase 15B: AI Review Suggestions Schema

-- 1. CREATE AI REVIEW SUGGESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.ai_review_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL, -- 'transaction' | 'risk' | 'vendor' | 'invoice'
    entity_id UUID NOT NULL,
    suggestion_type TEXT NOT NULL, -- 'categorize_transaction' | 'mark_reviewed' | 'mark_needs_review' | 'resolve_risk' | 'ignore_risk' | 'flag_vendor' | 'match_invoice' | 'mark_invoice_needs_review'
    proposed_value JSONB DEFAULT '{}'::jsonb,
    reason TEXT,
    confidence NUMERIC,
    priority TEXT, -- 'low' | 'medium' | 'high'
    status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'applied' | 'expired'
    requires_approval BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ENABLE ROW LEVEL SECURITY
ALTER TABLE public.ai_review_suggestions ENABLE ROW LEVEL SECURITY;

-- POLICIES
DROP POLICY IF EXISTS "ai_review_suggestions_select" ON public.ai_review_suggestions;
CREATE POLICY "ai_review_suggestions_select" ON public.ai_review_suggestions
    FOR SELECT USING (user_id_is_member(organization_id));

DROP POLICY IF EXISTS "ai_review_suggestions_insert" ON public.ai_review_suggestions;
CREATE POLICY "ai_review_suggestions_insert" ON public.ai_review_suggestions
    FOR INSERT WITH CHECK (user_id_is_member(organization_id));

DROP POLICY IF EXISTS "ai_review_suggestions_update" ON public.ai_review_suggestions;
CREATE POLICY "ai_review_suggestions_update" ON public.ai_review_suggestions
    FOR UPDATE USING (user_id_is_member(organization_id));

DROP POLICY IF EXISTS "ai_review_suggestions_delete" ON public.ai_review_suggestions;
CREATE POLICY "ai_review_suggestions_delete" ON public.ai_review_suggestions
    FOR DELETE USING (user_id_is_member(organization_id));

-- Trigger for handle_updated_at
DROP TRIGGER IF EXISTS on_ai_review_suggestions_updated ON public.ai_review_suggestions;
CREATE TRIGGER on_ai_review_suggestions_updated
    BEFORE UPDATE ON public.ai_review_suggestions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add indices for performance
CREATE INDEX IF NOT EXISTS idx_ai_review_suggestions_client ON public.ai_review_suggestions(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_review_suggestions_status ON public.ai_review_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_ai_review_suggestions_entity ON public.ai_review_suggestions(entity_id, entity_type);
