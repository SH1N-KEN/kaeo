alter table public.imports
add column if not exists parsed_rows_json jsonb default '[]'::jsonb;
