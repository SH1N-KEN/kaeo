-- Additive Ingestion Hardening columns
-- Idempotent script using ALTER TABLE IF NOT EXISTS

ALTER TABLE public.uploaded_files 
ADD COLUMN IF NOT EXISTS parser_version TEXT DEFAULT '12A';

ALTER TABLE public.imports
ADD COLUMN IF NOT EXISTS selected_sheet_name TEXT,
ADD COLUMN IF NOT EXISTS detected_header_row INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS skipped_rows_json JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ingestion_confidence NUMERIC DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS ingestion_warnings_json JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS source_row_hash TEXT,
ADD COLUMN IF NOT EXISTS source_sheet_name TEXT;

-- Create an index on transaction fingerprints to optimize duplicate checks
CREATE INDEX IF NOT EXISTS idx_transactions_source_row_hash 
ON public.transactions (client_id, source_row_hash);
