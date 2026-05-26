alter table public.transactions
add column if not exists review_status text default 'new';

alter table public.transactions
add column if not exists reviewed_at timestamptz;

alter table public.transactions
add column if not exists reviewed_by uuid references auth.users(id);

alter table public.transactions
add column if not exists review_note text;

update public.transactions
set review_status = 'new'
where review_status is null;

create index if not exists idx_transactions_review_status
on public.transactions(review_status);

create index if not exists idx_transactions_client_review_status
on public.transactions(client_id, review_status);
