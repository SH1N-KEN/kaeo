-- 0011_ask_kaeo_chat.sql

-- Chat Threads Table
CREATE TABLE IF NOT EXISTS public.chat_threads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    title text DEFAULT 'Ask Kaeo conversation',
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
    thread_id uuid REFERENCES public.chat_threads(id) ON DELETE CASCADE,
    role text NOT NULL, -- 'user' or 'assistant'
    content text NOT NULL,
    intent text,
    source_json jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Policies for chat_threads
CREATE POLICY "Users can view chat_threads for their organization" 
    ON public.chat_threads FOR SELECT 
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert chat_threads for their organization" 
    ON public.chat_threads FOR INSERT 
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update chat_threads for their organization" 
    ON public.chat_threads FOR UPDATE 
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

-- Policies for chat_messages
CREATE POLICY "Users can view chat_messages for their organization" 
    ON public.chat_messages FOR SELECT 
    USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert chat_messages for their organization" 
    ON public.chat_messages FOR INSERT 
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
        )
    );

-- Trigger for updated_at on chat_threads
CREATE OR REPLACE FUNCTION update_chat_threads_mod_time()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_chat_threads_mod_time ON public.chat_threads;
CREATE TRIGGER update_chat_threads_mod_time
BEFORE UPDATE ON public.chat_threads
FOR EACH ROW
EXECUTE FUNCTION update_chat_threads_mod_time();
