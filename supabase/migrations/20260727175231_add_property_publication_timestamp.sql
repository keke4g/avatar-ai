-- Track the first time a listing becomes publicly visible. Draft creation and
-- later edits must not make an old listing look newly published.

alter table public.properties
  add column if not exists published_at timestamptz;

update public.properties
set published_at = created_at
where is_published = true
  and published_at is null;

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
  -- SQL migrations and service-role jobs do not carry an end-user identity.
  -- They may change moderation state, but the first publication date remains
  -- immutable once assigned.
  if actor_id is null then
    if tg_op = 'INSERT' then
      if new.is_published then
        new.published_at := coalesce(new.published_at, now());
      end if;
    else
      new.internal_code := old.internal_code;
      if old.published_at is not null then
        new.published_at := old.published_at;
      elsif new.is_published then
        new.published_at := coalesce(new.published_at, now());
      end if;
    end if;
    return new;
  end if;

  actor_is_admin := coalesce(public.is_admin(actor_id), false);

  if tg_op = 'INSERT' then
    if not actor_is_admin then
      new.host_id := actor_id;
      new.is_published := false;
      new.folder_status := 'UNDER_REVIEW';
      new.published_at := null;
    elsif new.is_published then
      new.folder_status := 'PUBLISHED';
      new.published_at := coalesce(new.published_at, now());
    end if;
    return new;
  end if;

  new.internal_code := old.internal_code;
  new.host_id := old.host_id;
  new.published_at := old.published_at;

  if not actor_is_admin then
    new.is_published := false;
    new.folder_status := 'UNDER_REVIEW';
  elsif new.is_published then
    new.folder_status := 'PUBLISHED';
    new.published_at := coalesce(old.published_at, now());
  elsif new.folder_status = 'PUBLISHED' then
    new.folder_status := 'PAUSED';
  end if;

  return new;
end;
$$;

create or replace view public.public_properties_view
-- The base table contains private owner fields and is intentionally not
-- readable by anon. This tightly curated public view therefore retains the
-- existing definer behavior and exposes only the explicit columns below.
with (security_invoker = false)
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
  internal_code,
  published_at
from public.properties
where is_published = true;

grant select on public.public_properties_view to anon, authenticated;;
