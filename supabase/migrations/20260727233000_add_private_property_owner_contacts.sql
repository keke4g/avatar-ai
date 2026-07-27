-- Private operational contact captured by administrators and internal advisors.
-- This information is deliberately stored outside the public property payload.
create table if not exists public.property_owner_contacts (
  property_id uuid primary key references public.properties(id) on delete cascade,
  relationship text,
  full_name text,
  phone text,
  email text,
  contact_preference text,
  viewing_days text[] not null default '{}'::text[],
  viewing_start_time time,
  viewing_end_time time,
  has_keys boolean,
  occupancy_status text,
  appointment_notice_hours integer,
  visit_instructions text,
  extra_notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_owner_contacts_notice_check
    check (appointment_notice_hours is null or appointment_notice_hours between 0 and 720)
);

alter table public.property_owner_contacts enable row level security;

revoke all on table public.property_owner_contacts from public, anon, authenticated;

create or replace function public.upsert_internal_property_owner_contact(
  target_property_id uuid,
  owner_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  parsed_has_keys boolean;
  parsed_notice integer;
begin
  select profile.role
    into actor_role
  from public.profiles profile
  where profile.id = actor_id;

  if actor_id is null
     or actor_role is null
     or actor_role not in ('ADMIN', 'INTERNAL_ADVISOR') then
    raise insufficient_privilege
      using message = 'Owner contact capture access denied.';
  end if;

  if not exists (
    select 1
    from public.properties property
    where property.id = target_property_id
  ) then
    raise foreign_key_violation
      using message = 'The target property does not exist.';
  end if;

  parsed_has_keys := case
    when owner_payload ? 'hasKeys'
      and nullif(owner_payload ->> 'hasKeys', '') is not null
      then (owner_payload ->> 'hasKeys')::boolean
    else null
  end;

  parsed_notice := case
    when nullif(owner_payload ->> 'appointmentNoticeHours', '') is not null
      then greatest(0, least(720, (owner_payload ->> 'appointmentNoticeHours')::integer))
    else null
  end;

  insert into public.property_owner_contacts (
    property_id,
    relationship,
    full_name,
    phone,
    email,
    contact_preference,
    viewing_days,
    viewing_start_time,
    viewing_end_time,
    has_keys,
    occupancy_status,
    appointment_notice_hours,
    visit_instructions,
    extra_notes,
    created_by,
    updated_by
  )
  values (
    target_property_id,
    nullif(btrim(owner_payload ->> 'relationship'), ''),
    nullif(btrim(owner_payload ->> 'fullName'), ''),
    nullif(btrim(owner_payload ->> 'phone'), ''),
    nullif(btrim(owner_payload ->> 'email'), ''),
    nullif(btrim(owner_payload ->> 'contactPreference'), ''),
    coalesce(
      array(
        select jsonb_array_elements_text(
          coalesce(owner_payload -> 'viewingDays', '[]'::jsonb)
        )
      ),
      '{}'::text[]
    ),
    nullif(owner_payload ->> 'viewingStartTime', '')::time,
    nullif(owner_payload ->> 'viewingEndTime', '')::time,
    parsed_has_keys,
    nullif(btrim(owner_payload ->> 'occupancyStatus'), ''),
    parsed_notice,
    nullif(btrim(owner_payload ->> 'visitInstructions'), ''),
    nullif(btrim(owner_payload ->> 'extraNotes'), ''),
    actor_id,
    actor_id
  )
  on conflict (property_id) do update set
    relationship = excluded.relationship,
    full_name = excluded.full_name,
    phone = excluded.phone,
    email = excluded.email,
    contact_preference = excluded.contact_preference,
    viewing_days = excluded.viewing_days,
    viewing_start_time = excluded.viewing_start_time,
    viewing_end_time = excluded.viewing_end_time,
    has_keys = excluded.has_keys,
    occupancy_status = excluded.occupancy_status,
    appointment_notice_hours = excluded.appointment_notice_hours,
    visit_instructions = excluded.visit_instructions,
    extra_notes = excluded.extra_notes,
    updated_by = actor_id,
    updated_at = now();
end;
$$;

revoke execute on function public.upsert_internal_property_owner_contact(uuid, jsonb)
from public, anon;

grant execute on function public.upsert_internal_property_owner_contact(uuid, jsonb)
to authenticated;

-- Only administrators may read the captured person's private contact details.
create or replace function public.get_admin_property_owner_contact(
  target_property_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  result jsonb;
begin
  select profile.role
    into actor_role
  from public.profiles profile
  where profile.id = actor_id;

  if actor_id is null or actor_role <> 'ADMIN' then
    raise insufficient_privilege
      using message = 'Administrator owner contact access denied.';
  end if;

  select jsonb_build_object(
    'property_id', contact.property_id,
    'relationship', contact.relationship,
    'full_name', contact.full_name,
    'phone', contact.phone,
    'email', contact.email,
    'contact_preference', contact.contact_preference,
    'viewing_days', contact.viewing_days,
    'viewing_start_time', to_char(contact.viewing_start_time, 'HH24:MI'),
    'viewing_end_time', to_char(contact.viewing_end_time, 'HH24:MI'),
    'has_keys', contact.has_keys,
    'occupancy_status', contact.occupancy_status,
    'appointment_notice_hours', contact.appointment_notice_hours,
    'visit_instructions', contact.visit_instructions,
    'extra_notes', contact.extra_notes
  )
    into result
  from public.property_owner_contacts contact
  where contact.property_id = target_property_id;

  return result;
end;
$$;

revoke execute on function public.get_admin_property_owner_contact(uuid)
from public, anon;

grant execute on function public.get_admin_property_owner_contact(uuid)
to authenticated;
