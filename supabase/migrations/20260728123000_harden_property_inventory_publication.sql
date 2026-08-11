-- Inventory integrity, moderation workflow and residential location privacy.
-- Idempotent: safe to re-run after the earlier moderation migrations.

alter table public.properties
  alter column legal_debt_free drop default,
  alter column legal_public_deed drop default,
  alter column legal_tax_current drop default,
  alter column legal_services_paid drop default,
  alter column legal_is_mortgaged drop default,
  alter column show_public_address set default false;

alter table public.properties
  drop constraint if exists properties_valid_coordinates;
alter table public.properties
  add constraint properties_valid_coordinates check (
    latitude is null
    or longitude is null
    or (
      latitude between -90 and 90
      and longitude between -180 and 180
    )
  ) not valid;

create or replace function public.enforce_property_publication_workflow()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_is_admin boolean := false;
  sensitive_change boolean := false;
  image_count integer := 0;
begin
  actor_is_admin := coalesce(public.is_admin(actor_id), false);

  if tg_op = 'UPDATE' then
    new.internal_code := old.internal_code;
    new.host_id := old.host_id;
    new.published_at := old.published_at;

    sensitive_change :=
      new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.type is distinct from old.type
      or new.location is distinct from old.location
      or new.country is distinct from old.country
      or new.address is distinct from old.address
      or new.latitude is distinct from old.latitude
      or new.longitude is distinct from old.longitude
      or new.bedrooms is distinct from old.bedrooms
      or new.bathrooms is distinct from old.bathrooms
      or new.parking_spaces is distinct from old.parking_spaces
      or new.surface_total is distinct from old.surface_total
      or new.surface_built is distinct from old.surface_built
      or new.legal_debt_free is distinct from old.legal_debt_free
      or new.legal_public_deed is distinct from old.legal_public_deed
      or new.legal_tax_current is distinct from old.legal_tax_current
      or new.legal_services_paid is distinct from old.legal_services_paid;

    -- A public listing is immutable from the public catalog perspective:
    -- sensitive edits always return it to moderation, including admin edits.
    if old.is_published = true and sensitive_change then
      new.is_published := false;
      new.folder_status := 'UNDER_REVIEW';
      return new;
    end if;
  end if;

  if actor_id is not null and not actor_is_admin then
    new.host_id := coalesce(case when tg_op = 'UPDATE' then old.host_id end, actor_id);
    new.is_published := false;
    new.folder_status := 'UNDER_REVIEW';
    new.published_at := case when tg_op = 'UPDATE' then old.published_at else null end;
    return new;
  end if;

  if new.is_published = true then
    if coalesce(new.is_demo, false) then
      raise exception 'Demo properties cannot be published to the production catalog';
    end if;
    if new.latitude is null or new.longitude is null
      or new.latitude not between -90 and 90
      or new.longitude not between -180 and 180 then
      raise exception 'A published property requires valid coordinates';
    end if;
    if length(trim(coalesce(new.title, ''))) < 10
      or length(trim(coalesce(new.description, ''))) < 30 then
      raise exception 'A published property requires a complete title and description';
    end if;

    if tg_op = 'UPDATE' then
      select count(*)
      into image_count
      from public.property_media media
      where media.property_id = new.id
        and media.media_type = 'IMAGE'
        and media.deleted_at is null;
      if image_count < 5 then
        raise exception 'A published property requires at least five photos';
      end if;
    else
      raise exception 'Create the property as a draft/review record before publishing';
    end if;

    new.folder_status := 'PUBLISHED';
    new.published_at := coalesce(old.published_at, now());
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

create or replace function public.return_property_to_review_on_media_change()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected_property_id uuid;
begin
  affected_property_id := case when tg_op = 'DELETE' then old.property_id else new.property_id end;
  update public.properties
  set is_published = false,
      folder_status = 'UNDER_REVIEW'
  where id = affected_property_id
    and is_published = true;
  return null;
end;
$$;

drop trigger if exists zz_property_media_requires_review on public.property_media;
create trigger zz_property_media_requires_review
after insert or update or delete on public.property_media
for each row execute function public.return_property_to_review_on_media_change();

create or replace view public.public_properties_view
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
  case when coalesce(show_public_address, false) then address else null end as address,
  case
    when coalesce(show_public_address, false) then latitude
    else round(latitude::numeric, 2)::double precision
  end as latitude,
  case
    when coalesce(show_public_address, false) then longitude
    else round(longitude::numeric, 2)::double precision
  end as longitude,
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
  published_at,
  show_public_address
from public.properties
where is_published = true
  and folder_status = 'PUBLISHED'
  and coalesce(is_demo, false) = false;

create or replace view public.public_property_media_view
with (security_invoker = false)
as
select
  media.id,
  media.property_id,
  media.media_type,
  media.url,
  media.thumbnail_url,
  media.title,
  media.description,
  media.display_order,
  media.is_primary,
  media.mime_type,
  media.duration_seconds,
  media.width,
  media.height,
  media.created_at,
  media.updated_at
from public.property_media media
join public.properties property on property.id = media.property_id
where property.is_published = true
  and property.folder_status = 'PUBLISHED'
  and coalesce(property.is_demo, false) = false
  and media.deleted_at is null;

create or replace view public.public_property_offerings_view
with (security_invoker = false)
as
select
  offering.id,
  offering.property_id,
  offering.commercial_code,
  offering.mode,
  offering.status,
  offering.visibility,
  offering.title,
  offering.description,
  offering.price_amount,
  offering.currency,
  offering.billing_period,
  offering.security_deposit_amount,
  offering.cleaning_fee_amount,
  offering.service_fee_percent,
  offering.min_nights,
  offering.max_nights,
  offering.min_months,
  offering.max_months,
  offering.is_price_negotiable,
  offering.accepts_offers,
  offering.requires_approval,
  offering.allow_instant_request,
  offering.swap_preferences,
  offering.swap_value_tier,
  offering.aura_score_override,
  offering.available_from,
  offering.available_until,
  offering.is_featured,
  offering.featured_until,
  offering.featured_rank,
  offering.accepts_bank_credit,
  offering.accepts_infonavit,
  offering.accepts_fovissste,
  offering.accepts_cash,
  offering.developer_financing,
  offering.deposit_amount,
  offering.advance_months,
  offering.requires_guarantor,
  offering.requires_legal_policy,
  offering.swap_min_value,
  offering.swap_max_value,
  offering.swap_cash_difference_allowed,
  offering.annual_property_tax,
  offering.water_monthly_avg,
  offering.electricity_monthly_avg,
  offering.gas_monthly_avg,
  offering.estimated_delivery_date,
  offering.created_at,
  offering.updated_at
from public.property_offerings offering
join public.properties property on property.id = offering.property_id
where property.is_published = true
  and property.folder_status = 'PUBLISHED'
  and coalesce(property.is_demo, false) = false
  and offering.status = 'ACTIVE'::public.property_offering_status
  and offering.visibility = 'PUBLIC'::public.property_offering_visibility;

grant select on public.public_properties_view to anon, authenticated;
grant select on public.public_property_media_view to anon, authenticated;
grant select on public.public_property_offerings_view to anon, authenticated;
