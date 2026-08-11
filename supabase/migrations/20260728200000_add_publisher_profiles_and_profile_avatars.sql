-- One-time publisher contact verification and user-owned profile avatars.
-- Publisher contact information is private and never projected through a
-- public view.

create table if not exists public.publisher_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  representative_type text not null,
  full_name text not null,
  organization_name text,
  phone text not null,
  whatsapp text not null,
  contact_email text not null,
  contact_consent_at timestamptz not null,
  completed_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publisher_profiles_representative_type_check check (
    representative_type in (
      'REAL_ESTATE_ADVISOR',
      'INDEPENDENT_ADVISOR',
      'REAL_ESTATE_AGENCY',
      'CONSTRUCTION_COMPANY',
      'DEVELOPER',
      'OWNER',
      'PROPERTY_MANAGER'
    )
  ),
  constraint publisher_profiles_full_name_check
    check (length(btrim(full_name)) between 2 and 120),
  constraint publisher_profiles_organization_name_check
    check (organization_name is null or length(btrim(organization_name)) between 2 and 160),
  constraint publisher_profiles_phone_check
    check (length(regexp_replace(phone, '[^0-9]', '', 'g')) between 10 and 15),
  constraint publisher_profiles_whatsapp_check
    check (length(regexp_replace(whatsapp, '[^0-9]', '', 'g')) between 10 and 15),
  constraint publisher_profiles_email_check
    check (contact_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')
);

create index if not exists publisher_profiles_representative_type_idx
  on public.publisher_profiles (representative_type);

alter table public.publisher_profiles enable row level security;

revoke all on table public.publisher_profiles from public, anon, authenticated;
grant select on table public.publisher_profiles to authenticated;

drop policy if exists "Publisher profile readable by owner or admin"
  on public.publisher_profiles;
create policy "Publisher profile readable by owner or admin"
on public.publisher_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin((select auth.uid()))
);

create or replace function public.upsert_my_publisher_profile(
  publisher_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  parsed_type text := btrim(coalesce(publisher_payload ->> 'representativeType', ''));
  parsed_full_name text := btrim(coalesce(publisher_payload ->> 'fullName', ''));
  parsed_organization text := nullif(btrim(coalesce(publisher_payload ->> 'organizationName', '')), '');
  parsed_phone text := btrim(coalesce(publisher_payload ->> 'phone', ''));
  parsed_whatsapp text := btrim(coalesce(publisher_payload ->> 'whatsapp', ''));
  parsed_email text := lower(btrim(coalesce(publisher_payload ->> 'email', '')));
  result jsonb;
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  if parsed_type not in (
    'REAL_ESTATE_ADVISOR',
    'INDEPENDENT_ADVISOR',
    'REAL_ESTATE_AGENCY',
    'CONSTRUCTION_COMPANY',
    'DEVELOPER',
    'OWNER',
    'PROPERTY_MANAGER'
  ) then
    raise check_violation using message = 'Select a valid publisher type.';
  end if;

  if length(parsed_full_name) not between 2 and 120 then
    raise check_violation using message = 'Enter the responsible person full name.';
  end if;

  if parsed_type in (
    'REAL_ESTATE_ADVISOR',
    'REAL_ESTATE_AGENCY',
    'CONSTRUCTION_COMPANY',
    'DEVELOPER'
  ) and parsed_organization is null then
    raise check_violation using message = 'Organization name is required for this publisher type.';
  end if;

  if length(regexp_replace(parsed_phone, '[^0-9]', '', 'g')) not between 10 and 15
     or length(regexp_replace(parsed_whatsapp, '[^0-9]', '', 'g')) not between 10 and 15 then
    raise check_violation using message = 'Enter valid phone and WhatsApp numbers.';
  end if;

  if parsed_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise check_violation using message = 'Enter a valid contact email.';
  end if;

  insert into public.publisher_profiles (
    user_id,
    representative_type,
    full_name,
    organization_name,
    phone,
    whatsapp,
    contact_email,
    contact_consent_at
  )
  values (
    actor_id,
    parsed_type,
    parsed_full_name,
    parsed_organization,
    parsed_phone,
    parsed_whatsapp,
    parsed_email,
    now()
  )
  on conflict (user_id) do update set
    representative_type = excluded.representative_type,
    full_name = excluded.full_name,
    organization_name = excluded.organization_name,
    phone = excluded.phone,
    whatsapp = excluded.whatsapp,
    contact_email = excluded.contact_email,
    contact_consent_at = excluded.contact_consent_at,
    completed_at = coalesce(public.publisher_profiles.completed_at, now()),
    updated_at = now();

  update public.profiles
  set name = parsed_full_name
  where id = actor_id;

  select jsonb_build_object(
    'userId', profile.user_id,
    'representativeType', profile.representative_type,
    'fullName', profile.full_name,
    'organizationName', profile.organization_name,
    'phone', profile.phone,
    'whatsapp', profile.whatsapp,
    'email', profile.contact_email,
    'completedAt', profile.completed_at
  )
  into result
  from public.publisher_profiles profile
  where profile.user_id = actor_id;

  return result;
end;
$$;

revoke execute on function public.upsert_my_publisher_profile(jsonb)
from public, anon;
grant execute on function public.upsert_my_publisher_profile(jsonb)
to authenticated;

comment on table public.publisher_profiles is
  'Private one-time publisher contact profile. Never expose through a public view.';

-- Public avatar bucket. Only the image is public; profile contact and account
-- data remain protected by their own RLS policies.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-avatars',
  'profile-avatars',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  name = excluded.name,
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Profile avatars are readable by signed-in users" on storage.objects;
create policy "Profile avatars are readable by signed-in users"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_admin((select auth.uid()))
  )
);

drop policy if exists "Users upload their own profile avatar" on storage.objects;
create policy "Users upload their own profile avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users update their own profile avatar" on storage.objects;
create policy "Users update their own profile avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "Users remove their own profile avatar" on storage.objects;
create policy "Users remove their own profile avatar"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create or replace function public.set_my_profile_avatar(
  target_avatar_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_url text := nullif(btrim(target_avatar_url), '');
begin
  if actor_id is null then
    raise insufficient_privilege using message = 'Authentication required.';
  end if;

  if normalized_url is not null and (
    length(normalized_url) > 2048
    or position('/profile-avatars/' || actor_id::text || '/' in normalized_url) = 0
  ) then
    raise check_violation using message = 'Invalid profile avatar URL.';
  end if;

  update public.profiles
  set avatar_url = normalized_url
  where id = actor_id;
end;
$$;

revoke execute on function public.set_my_profile_avatar(text)
from public, anon;
grant execute on function public.set_my_profile_avatar(text)
to authenticated;

-- Remove the former generic stock portrait while preserving user-selected or
-- user-uploaded photographs.
update public.profiles
set avatar_url = null
where avatar_url like '%photo-1535713875002-d1d0cf377fde%';
