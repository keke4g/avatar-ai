-- AuraSwap AI Hybrid - Leads MVP
-- Captures initial intent for rent and sale offerings without CRM, payments, or conversations.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  offering_id uuid not null references public.property_offerings(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  lead_type text not null check (lead_type in ('SHORT_RENT', 'MONTHLY_RENT', 'SALE')),
  message text not null,
  status text not null default 'NEW' check (status in ('NEW', 'READ', 'ARCHIVED')),
  created_at timestamptz not null default now()
);

create index if not exists leads_property_id_idx on public.leads(property_id);
create index if not exists leads_offering_id_idx on public.leads(offering_id);
create index if not exists leads_user_id_idx on public.leads(user_id);
create index if not exists leads_created_at_idx on public.leads(created_at desc);

alter table public.leads enable row level security;

drop policy if exists "Lead creators can insert own leads" on public.leads;
create policy "Lead creators can insert own leads"
on public.leads
for insert
with check (auth.uid() = user_id);

drop policy if exists "Lead creators can view own leads" on public.leads;
create policy "Lead creators can view own leads"
on public.leads
for select
using (auth.uid() = user_id);

drop policy if exists "Property owners can view received leads" on public.leads;
create policy "Property owners can view received leads"
on public.leads
for select
using (
  exists (
    select 1
    from public.properties p
    where p.id = leads.property_id
      and p.host_id = auth.uid()
  )
);

drop policy if exists "Property owners can update received lead status" on public.leads;
create policy "Property owners can update received lead status"
on public.leads
for update
using (
  exists (
    select 1
    from public.properties p
    where p.id = leads.property_id
      and p.host_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.properties p
    where p.id = leads.property_id
      and p.host_id = auth.uid()
  )
);
