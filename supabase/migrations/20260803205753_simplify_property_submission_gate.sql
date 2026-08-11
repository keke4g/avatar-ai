-- Keep moderation strict while allowing owners and advisors to submit incomplete
-- inventory for human review. Only the public essentials remain mandatory.
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
  priced_offering_count integer := 0;
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
    if length(trim(coalesce(new.title, ''))) = 0 then
      raise exception 'A published property requires a title';
    end if;
    if length(trim(coalesce(new.location, ''))) = 0
      or new.latitude is null or new.longitude is null
      or new.latitude not between -90 and 90
      or new.longitude not between -180 and 180 then
      raise exception 'A published property requires a valid location';
    end if;

    if tg_op = 'UPDATE' then
      select count(*)
      into image_count
      from public.property_media media
      where media.property_id = new.id
        and media.media_type = 'IMAGE'
        and media.deleted_at is null;

      if image_count < 1 then
        raise exception 'A published property requires at least one photo';
      end if;

      select count(*)
      into priced_offering_count
      from public.property_offerings offering
      where offering.property_id = new.id
        and (
          (offering.mode::text in ('SALE', 'SHORT_RENT', 'MONTHLY_RENT') and offering.price_amount > 0)
          or (
            offering.mode::text = 'SWAP'
            and greatest(coalesce(offering.swap_min_value, 0), coalesce(offering.swap_max_value, 0)) > 0
          )
        );

      if priced_offering_count < 1 then
        raise exception 'A published property requires a price';
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

comment on function public.enforce_property_publication_workflow()
is 'Moderation workflow: title, location, price and one photo are the only listing-content requirements for publication.';
