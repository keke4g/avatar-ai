-- Property moderation and public reference workflow.
-- Existing public listings stay public; new member submissions require admin approval.

alter table public.properties
  alter column is_published set default false;

update public.properties
set internal_code = (
  case primary_operation
    when 'SALE' then 'AS-V-'
    when 'RENT' then 'AS-R-'
    when 'SWAP' then 'AS-S-'
    else 'AS-P-'
  end
) || lpad(nextval('public.properties_internal_code_seq')::text, 6, '0')
where internal_code is null;

update public.properties
set folder_status = case
  when is_published then 'PUBLISHED'
  when folder_status = 'PUBLISHED' then 'PAUSED'
  else coalesce(folder_status, 'DRAFT')
end;

create or replace function public.enforce_property_publication_workflow()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_is_admin boolean := false;
begin
  if actor_id is null then
    if tg_op = 'UPDATE' then
      new.internal_code := old.internal_code;
    end if;
    return new;
  end if;

  actor_is_admin := public.is_admin(actor_id);

  if tg_op = 'INSERT' then
    if not actor_is_admin then
      new.host_id := actor_id;
      new.is_published := false;
      new.folder_status := 'UNDER_REVIEW';
    elsif new.is_published then
      new.folder_status := 'PUBLISHED';
    end if;
    return new;
  end if;

  new.internal_code := old.internal_code;
  new.host_id := old.host_id;

  if not actor_is_admin then
    new.is_published := false;
    new.folder_status := 'UNDER_REVIEW';
  elsif new.is_published then
    new.folder_status := 'PUBLISHED';
  elsif new.folder_status = 'PUBLISHED' then
    new.folder_status := 'PAUSED';
  end if;

  return new;
end;
$$;

drop trigger if exists zz_properties_publication_workflow on public.properties;
create trigger zz_properties_publication_workflow
before insert or update on public.properties
for each row execute function public.enforce_property_publication_workflow();

drop policy if exists "Authenticated users can create properties" on public.properties;
create policy "Members can submit their own properties"
on public.properties
for insert
to authenticated
with check ((select auth.uid()) = host_id);

drop policy if exists "Hosts can update their properties" on public.properties;
create policy "Hosts can update their properties"
on public.properties
for update
to authenticated
using ((select auth.uid()) = host_id)
with check ((select auth.uid()) = host_id);

create or replace function public.protect_profile_authorization_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is not null
     and not public.is_admin(actor_id)
     and (
       new.role is distinct from old.role
       or new.kyc_status is distinct from old.kyc_status
       or new.is_verified is distinct from old.is_verified
     ) then
    raise exception 'Only an administrator can change profile authorization fields';
  end if;

  return new;
end;
$$;

drop trigger if exists zz_profiles_protect_authorization_fields on public.profiles;
create trigger zz_profiles_protect_authorization_fields
before update on public.profiles
for each row execute function public.protect_profile_authorization_fields();

create or replace view public.public_properties_view
with (security_invoker = true)
as
select
  id,
  host_id,
  title,
  description,
  type,
  value_rating,
  location,
  country,
  address,
  latitude,
  longitude,
  bedrooms,
  bathrooms,
  max_guests,
  aura_score,
  amenities,
  rules,
  is_published,
  is_featured,
  created_at,
  folder_status,
  meta_title,
  meta_description,
  meta_keywords,
  qr_code_url,
  short_code,
  short_link,
  updated_at,
  is_demo,
  desired_exchange,
  legal_public_deed,
  legal_tax_current,
  legal_debt_free,
  legal_services_paid,
  legal_owner_type,
  legal_is_mortgaged,
  internal_code
from public.properties
where is_published = true;

grant select on public.public_properties_view to anon, authenticated;;
