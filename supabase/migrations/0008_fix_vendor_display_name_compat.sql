-- Fix vendor display_name schema compatibility
-- Safely adds name and normalized_name if missing, backfills data, and handles display_name constraints.

-- 1. Ensure name and normalized_name exist
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS normalized_name TEXT;

-- 2. Backfill name from display_name if display_name exists and name is null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'display_name'
  ) THEN
    UPDATE public.vendors SET name = display_name WHERE name IS NULL OR name = '';
    
    -- Also drop NOT NULL from display_name to ensure future compatibility
    ALTER TABLE public.vendors ALTER COLUMN display_name DROP NOT NULL;
  END IF;
END $$;

-- 3. Backfill display_name from name if name exists and display_name is null
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vendors' AND column_name = 'display_name'
  ) THEN
    UPDATE public.vendors SET display_name = name WHERE display_name IS NULL OR display_name = '';
  END IF;
END $$;

-- 4. Ensure normalized_name is backfilled if null
UPDATE public.vendors SET normalized_name = lower(trim(name)) WHERE normalized_name IS NULL OR normalized_name = '';

-- 5. Ensure name is NOT NULL for our application
UPDATE public.vendors SET name = 'Unknown Vendor' WHERE name IS NULL OR name = '';
ALTER TABLE public.vendors ALTER COLUMN name SET NOT NULL;

-- 6. Ensure normalized_name is NOT NULL for our application
UPDATE public.vendors SET normalized_name = lower(trim(name)) WHERE normalized_name IS NULL OR normalized_name = '';
ALTER TABLE public.vendors ALTER COLUMN normalized_name SET NOT NULL;

-- 7. Add unique constraint if not exists (repair from 0007 if needed)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public' AND table_name = 'vendors' AND constraint_name = 'vendors_client_id_normalized_name_key'
  ) THEN
    ALTER TABLE public.vendors ADD CONSTRAINT vendors_client_id_normalized_name_key UNIQUE (client_id, normalized_name);
  END IF;
END $$;

-- 8. Note: After running this, notify PostgREST to reload schema if issues persist.
-- SELECT pgrst_reload_schema();
