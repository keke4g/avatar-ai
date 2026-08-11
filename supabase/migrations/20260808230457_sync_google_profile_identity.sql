-- When an existing email/password account is linked to Google, Supabase keeps
-- the existing public profile row. Adopt Google's verified display name once,
-- but only when the Google identity is newer than the last profile edit. This
-- preserves names that a member customized after linking their account.
create or replace function public.sync_google_profile_identity()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  google_name text;
  google_linked_at timestamptz;
  profile_name text;
  profile_updated_at timestamptz;
begin
  if actor_id is null then
    raise exception 'Authentication is required.';
  end if;

  select
    coalesce(
      nullif(btrim(identity.identity_data ->> 'name'), ''),
      nullif(btrim(identity.identity_data ->> 'full_name'), '')
    ),
    identity.created_at
  into google_name, google_linked_at
  from auth.identities as identity
  where identity.user_id = actor_id
    and identity.provider = 'google'
  order by identity.created_at desc
  limit 1;

  if google_name is null then
    return false;
  end if;

  select profile.name, profile.updated_at
  into profile_name, profile_updated_at
  from public.profiles as profile
  where profile.id = actor_id
  for update;

  if not found
     or google_linked_at < profile_updated_at
     or profile_name is not distinct from google_name then
    return false;
  end if;

  update public.profiles
  set name = google_name
  where id = actor_id;

  return true;
end;
$$;

revoke all on function public.sync_google_profile_identity()
from public, anon;

grant execute on function public.sync_google_profile_identity()
to authenticated;

comment on function public.sync_google_profile_identity() is
  'Adopts the authenticated member Google name once when a newly linked Google identity is newer than their last profile edit.';

-- Repair legacy profiles that were linked to Google after their last edit.
-- The same timestamp guard prevents overwriting a newer member-selected name.
with latest_google_identity as (
  select distinct on (identity.user_id)
    identity.user_id,
    coalesce(
      nullif(btrim(identity.identity_data ->> 'name'), ''),
      nullif(btrim(identity.identity_data ->> 'full_name'), '')
    ) as google_name,
    identity.created_at as google_linked_at
  from auth.identities as identity
  where identity.provider = 'google'
  order by identity.user_id, identity.created_at desc
)
update public.profiles as profile
set name = google.google_name
from latest_google_identity as google
where profile.id = google.user_id
  and google.google_name is not null
  and google.google_linked_at >= profile.updated_at
  and profile.name is distinct from google.google_name;
