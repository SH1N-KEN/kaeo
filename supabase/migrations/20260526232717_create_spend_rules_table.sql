create table if not exists public.spend_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  client_id uuid references public.clients(id) on delete cascade,
  rule_key text not null,
  rule_name text not null,
  description text,
  enabled boolean not null default true,
  value numeric,
  unit text,
  severity text default 'medium',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists idx_spend_rules_client_rule_key
on public.spend_rules(client_id, rule_key);

create index if not exists idx_spend_rules_organization_id
on public.spend_rules(organization_id);

create index if not exists idx_spend_rules_client_id
on public.spend_rules(client_id);

alter table public.spend_rules enable row level security;

drop policy if exists "spend_rules_select_org_members" on public.spend_rules;
create policy "spend_rules_select_org_members"
on public.spend_rules
for select
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = spend_rules.organization_id
    and om.user_id = auth.uid()
  )
);

drop policy if exists "spend_rules_insert_org_members" on public.spend_rules;
create policy "spend_rules_insert_org_members"
on public.spend_rules
for insert
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = spend_rules.organization_id
    and om.user_id = auth.uid()
  )
);

drop policy if exists "spend_rules_update_org_members" on public.spend_rules;
create policy "spend_rules_update_org_members"
on public.spend_rules
for update
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = spend_rules.organization_id
    and om.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = spend_rules.organization_id
    and om.user_id = auth.uid()
  )
);

drop policy if exists "spend_rules_delete_org_members" on public.spend_rules;
create policy "spend_rules_delete_org_members"
on public.spend_rules
for delete
using (
  exists (
    select 1
    from public.organization_members om
    where om.organization_id = spend_rules.organization_id
    and om.user_id = auth.uid()
  )
);