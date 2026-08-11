-- Persist the editable user profile fields and make owner updates explicit.
-- Location and biography remain private in the base table; the sanitized
-- public profile view is intentionally unchanged.

alter table public.profiles
  add column if not exists bio text,
  add column if not exists location text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.profiles
  drop constraint if exists profiles_bio_length_check,
  drop constraint if exists profiles_location_length_check;

alter table public.profiles
  add constraint profiles_bio_length_check
    check (bio is null or char_length(bio) <= 500),
  add constraint profiles_location_length_check
    check (location is null or char_length(location) <= 160);

create or replace function public.set_profile_updated_at()
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

drop trigger if exists set_profile_updated_at on public.profiles;
create trigger set_profile_updated_at
before update on public.profiles
for each row execute function public.set_profile_updated_at();

create or replace function public.update_profile_settings(
  target_user_id uuid,
  target_name text default null,
  target_avatar_url text default null,
  target_bio text default null,
  target_location text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  normalized_name text;
begin
  if actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  if actor_id <> target_user_id
     and not coalesce(public.is_admin(actor_id), false) then
    raise exception 'You can only update your own profile.';
  end if;

  if target_name is not null then
    normalized_name := nullif(btrim(target_name), '');
    if normalized_name is null then
      raise exception 'Profile name is required.';
    end if;
    if char_length(normalized_name) > 120 then
      raise exception 'Profile name is too long.';
    end if;
  end if;

  update public.profiles
  set
    name = case when target_name is null then name else normalized_name end,
    avatar_url = case
      when target_avatar_url is null then avatar_url
      else nullif(btrim(target_avatar_url), '')
    end,
    bio = case
      when target_bio is null then bio
      else nullif(btrim(target_bio), '')
    end,
    location = case
      when target_location is null then location
      else nullif(btrim(target_location), '')
    end
  where id = target_user_id;

  if not found then
    raise exception 'Profile not found.';
  end if;

  return target_user_id;
end;
$$;

revoke all on function public.update_profile_settings(uuid, text, text, text, text)
from public, anon;

grant execute on function public.update_profile_settings(uuid, text, text, text, text)
to authenticated, service_role;

comment on column public.profiles.location is
  'Private user-supplied city or region used in account settings.';

comment on column public.profiles.bio is
  'Private account biography. Public publisher identity is exposed separately.';

comment on function public.update_profile_settings(uuid, text, text, text, text) is
  'Updates only editable profile settings for the owner or an administrator.';
