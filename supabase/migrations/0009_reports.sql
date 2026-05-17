-- 0009_reports.sql
-- Create reports table to store accountant-ready CFO outputs

CREATE TABLE IF NOT EXISTS public.reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    title text NOT NULL,
    report_type text DEFAULT 'monthly_cfo',
    period_start date,
    period_end date,
    status text DEFAULT 'generated',
    summary_json jsonb DEFAULT '{}'::jsonb,
    sections_json jsonb DEFAULT '[]'::jsonb,
    source_json jsonb DEFAULT '{}'::jsonb,
    generated_by uuid REFERENCES auth.users(id),
    generated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policy: Select (Organization Members)
CREATE POLICY "Users can view reports for their organization"
    ON public.reports FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Policy: Insert (Organization Members)
CREATE POLICY "Users can insert reports for their organization"
    ON public.reports FOR INSERT
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Policy: Update (Organization Members)
CREATE POLICY "Users can update reports for their organization"
    ON public.reports FOR UPDATE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Policy: Delete (Organization Members)
CREATE POLICY "Users can delete reports for their organization"
    ON public.reports FOR DELETE
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members
            WHERE user_id = auth.uid()
        )
    );

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS reports_client_id_idx ON public.reports(client_id);
CREATE INDEX IF NOT EXISTS reports_organization_id_idx ON public.reports(organization_id);
