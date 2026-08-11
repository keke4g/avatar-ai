-- Internal appointment CRM for Towers México advisors and administrators.
-- Access stays separate from admin moderation privileges: internal advisors
-- can operate appointments without inheriting destructive admin permissions.

create or replace function public.is_appointment_staff(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = user_id
      and profile.role in ('ADMIN', 'INTERNAL_ADVISOR')
  );
$$;

revoke all on function public.is_appointment_staff(uuid) from public, anon;
grant execute on function public.is_appointment_staff(uuid) to authenticated, service_role;

create table if not exists public.appointment_requests (
  id uuid primary key default gen_random_uuid(),
  appointment_number bigint generated always as identity unique,
  client_name text not null check (char_length(btrim(client_name)) between 2 and 160),
  appointment_at timestamptz not null,
  property_reference text not null check (char_length(btrim(property_reference)) between 2 and 240),
  prospector_user_id uuid not null references public.profiles(id) on delete restrict,
  prospector_name text not null check (char_length(btrim(prospector_name)) between 2 and 160),
  payment_method text not null check (char_length(btrim(payment_method)) between 2 and 120),
  client_phone text not null check (char_length(btrim(client_phone)) between 7 and 30),
  status text not null default 'NEW'
    check (status in ('NEW', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  whatsapp_target text not null default '526624739146',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointment_requests_appointment_at_idx
  on public.appointment_requests (appointment_at desc);

create index if not exists appointment_requests_status_idx
  on public.appointment_requests (status, appointment_at desc);

create index if not exists appointment_requests_prospector_idx
  on public.appointment_requests (prospector_user_id, appointment_at desc);

alter table public.appointment_requests enable row level security;

revoke all on table public.appointment_requests from public, anon;
grant select, insert, update on table public.appointment_requests to authenticated;
grant usage, select on sequence public.appointment_requests_appointment_number_seq to authenticated;

drop policy if exists "Appointment staff can read CRM" on public.appointment_requests;
create policy "Appointment staff can read CRM"
on public.appointment_requests
for select
to authenticated
using (public.is_appointment_staff((select auth.uid())));

drop policy if exists "Appointment staff can create CRM records" on public.appointment_requests;
create policy "Appointment staff can create CRM records"
on public.appointment_requests
for insert
to authenticated
with check (
  public.is_appointment_staff((select auth.uid()))
  and created_by = (select auth.uid())
  and prospector_user_id = (select auth.uid())
);

drop policy if exists "Appointment staff can update CRM records" on public.appointment_requests;
create policy "Appointment staff can update CRM records"
on public.appointment_requests
for update
to authenticated
using (public.is_appointment_staff((select auth.uid())))
with check (public.is_appointment_staff((select auth.uid())));

create or replace function public.touch_appointment_request_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_appointment_request_updated_at
on public.appointment_requests;

create trigger touch_appointment_request_updated_at
before update on public.appointment_requests
for each row
execute function public.touch_appointment_request_updated_at();

comment on table public.appointment_requests is
  'Internal appointment CRM. Visible and writable only to ADMIN and INTERNAL_ADVISOR profiles.';
