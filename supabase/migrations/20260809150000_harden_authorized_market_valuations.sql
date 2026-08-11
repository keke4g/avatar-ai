-- Only contractually authorized inventory may feed Towers Market v4.
-- Public estimates fail closed when the newest run is insufficient, old, or
-- was produced by an earlier model.

alter table valuation.market_observations
  add column if not exists published_at timestamptz,
  add column if not exists last_verified_at timestamptz,
  add column if not exists location_precision text not null default 'UNKNOWN',
  add column if not exists syndication_fingerprint text,
  add column if not exists data_completeness numeric(5,4);

alter table valuation.market_observations
  drop constraint if exists market_observations_location_precision_check;
alter table valuation.market_observations
  add constraint market_observations_location_precision_check check (
    location_precision in ('POINT', 'NEIGHBORHOOD', 'POSTAL_CODE', 'CITY', 'UNKNOWN')
  );

alter table valuation.market_observations
  drop constraint if exists market_observations_data_completeness_check;
alter table valuation.market_observations
  add constraint market_observations_data_completeness_check check (
    data_completeness is null or data_completeness between 0 and 1
  );

create index if not exists market_observations_current_listing_idx
  on valuation.market_observations (source_id, external_reference, last_verified_at desc);
create index if not exists market_observations_syndication_idx
  on valuation.market_observations (syndication_fingerprint)
  where syndication_fingerprint is not null;

-- These pilot sources were collected through HTML/browser transport without a
-- reusable data license. Keep the private audit rows, but make them ineligible
-- for future calculations.
update valuation.sources
set is_active = false,
    metadata = metadata || jsonb_build_object(
      'usageAuthorization', 'PROHIBITED',
      'disabledReason', 'No reusable AVM data license is recorded',
      'disabledAt', now()
    ),
    updated_at = now()
where source_code in ('mercadolibre-inmuebles', 'inmuebles24', 'propiedades-com');

update valuation.market_observations observation
set listing_status = 'REMOVED',
    last_seen_at = now(),
    attributes = observation.attributes || jsonb_build_object(
      'ineligibleReason', 'SOURCE_USAGE_NOT_AUTHORIZED'
    )
from valuation.sources source
where source.id = observation.source_id
  and source.source_code in ('mercadolibre-inmuebles', 'inmuebles24', 'propiedades-com');

create or replace function public.ingest_market_listing_observations(
  p_source jsonb,
  p_observations jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, valuation
as $$
declare
  v_source_id uuid;
  v_received integer := 0;
  v_accepted integer := 0;
  v_access_method text;
begin
  if jsonb_typeof(p_source) <> 'object'
     or nullif(trim(p_source ->> 'source_code'), '') is null
     or nullif(trim(p_source ->> 'official_url'), '') is null then
    raise exception 'A valid market source is required';
  end if;
  if jsonb_typeof(p_observations) <> 'array' then
    raise exception 'p_observations must be a JSON array';
  end if;

  v_access_method := upper(coalesce(p_source #>> '{metadata,accessMethod}', ''));
  if upper(coalesce(p_source #>> '{metadata,usageAuthorization}', '')) <> 'AUTHORIZED' then
    raise exception 'Market data usage must be explicitly AUTHORIZED';
  end if;
  if v_access_method not in ('API', 'PARTNER_FEED', 'CONTRACTED_FEED', 'OWNER_SUPPLIED', 'INTERNAL') then
    raise exception 'Unsupported or unauthorized access method: %', v_access_method;
  end if;
  if nullif(trim(coalesce(p_source #>> '{metadata,authorizationReference}', '')), '') is null then
    raise exception 'An authorizationReference is required';
  end if;

  insert into valuation.sources (
    source_code,
    organization,
    name,
    official_url,
    source_kind,
    geographic_scope,
    update_frequency,
    license_name,
    license_url,
    is_active,
    metadata,
    updated_at
  ) values (
    trim(p_source ->> 'source_code'),
    coalesce(nullif(trim(p_source ->> 'organization'), ''), trim(p_source ->> 'source_code')),
    coalesce(nullif(trim(p_source ->> 'name'), ''), trim(p_source ->> 'source_code')),
    trim(p_source ->> 'official_url'),
    'MARKET_LISTING',
    coalesce(nullif(trim(p_source ->> 'geographic_scope'), ''), 'México'),
    coalesce(nullif(trim(p_source ->> 'update_frequency'), ''), 'daily'),
    coalesce(nullif(trim(p_source ->> 'license_name'), ''), 'Authorized inventory feed'),
    nullif(trim(p_source ->> 'license_url'), ''),
    true,
    coalesce(p_source -> 'metadata', '{}'::jsonb),
    now()
  )
  on conflict (source_code) do update
  set organization = excluded.organization,
      name = excluded.name,
      official_url = excluded.official_url,
      source_kind = 'MARKET_LISTING',
      geographic_scope = excluded.geographic_scope,
      update_frequency = excluded.update_frequency,
      license_name = excluded.license_name,
      license_url = excluded.license_url,
      is_active = true,
      metadata = valuation.sources.metadata || excluded.metadata,
      updated_at = now()
  returning id into v_source_id;

  select jsonb_array_length(p_observations) into v_received;

  with rows as (
    select *
    from jsonb_to_recordset(p_observations) as item(
      external_reference text,
      source_url text,
      observation_kind text,
      observation_date date,
      published_at timestamptz,
      last_verified_at timestamptz,
      property_type text,
      title text,
      neighborhood text,
      city text,
      state text,
      country text,
      latitude double precision,
      longitude double precision,
      location_precision text,
      bedrooms numeric,
      bathrooms numeric,
      parking_spaces integer,
      construction_age integer,
      conservation_state text,
      surface_total_m2 numeric,
      surface_built_m2 numeric,
      price_amount numeric,
      currency text,
      quality_score numeric,
      parser_version text,
      syndication_fingerprint text,
      data_completeness numeric,
      attributes jsonb
    )
  ), valid_rows as (
    select
      rows.*,
      coalesce(rows.last_verified_at, now()) as verified_at,
      coalesce(rows.published_at, rows.observation_date::timestamptz) as listing_published_at
    from rows
    where nullif(trim(external_reference), '') is not null
      and nullif(trim(source_url), '') is not null
      and observation_kind in ('ASKING_SALE', 'ASKING_RENT')
      and property_type in ('HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OFFICE', 'LOFT')
      and nullif(trim(neighborhood), '') is not null
      and nullif(trim(city), '') is not null
      and nullif(trim(state), '') is not null
      and price_amount > 0
      and upper(coalesce(currency, 'MXN')) = 'MXN'
      and coalesce(quality_score, 0) >= 75
      and coalesce(data_completeness, 0) >= 0.80
      and coalesce(location_precision, 'UNKNOWN') in ('POINT', 'NEIGHBORHOOD', 'POSTAL_CODE')
      and (latitude is null or latitude between 14 and 33.5)
      and (longitude is null or longitude between -118.5 and -86)
      and coalesce(published_at, observation_date::timestamptz) >= now() - interval '180 days'
      and coalesce(last_verified_at, now()) >= now() - interval '30 days'
  ), upserted as (
    insert into valuation.market_observations (
      source_id,
      external_reference,
      source_url,
      observation_kind,
      observation_date,
      published_at,
      last_verified_at,
      property_type,
      title,
      neighborhood,
      city,
      state,
      country,
      latitude,
      longitude,
      location_precision,
      bedrooms,
      bathrooms,
      parking_spaces,
      construction_age,
      conservation_state,
      surface_total_m2,
      surface_built_m2,
      price_amount,
      currency,
      quality_score,
      listing_status,
      first_seen_at,
      last_seen_at,
      parser_version,
      content_fingerprint,
      syndication_fingerprint,
      data_completeness,
      attributes
    )
    select
      v_source_id,
      trim(external_reference),
      source_url,
      observation_kind,
      verified_at::date,
      listing_published_at,
      verified_at,
      property_type,
      nullif(trim(title), ''),
      trim(neighborhood),
      trim(city),
      trim(state),
      coalesce(nullif(trim(country), ''), 'México'),
      latitude,
      longitude,
      coalesce(location_precision, 'UNKNOWN'),
      bedrooms,
      bathrooms,
      parking_spaces,
      construction_age,
      conservation_state,
      surface_total_m2,
      surface_built_m2,
      price_amount,
      'MXN',
      least(100, greatest(0, coalesce(quality_score, 0))),
      'ACTIVE',
      now(),
      verified_at,
      parser_version,
      md5(concat_ws('|', external_reference, observation_kind, price_amount,
        neighborhood, surface_total_m2, surface_built_m2, bedrooms, bathrooms)),
      nullif(trim(syndication_fingerprint), ''),
      data_completeness,
      (coalesce(attributes, '{}'::jsonb)
        - array['phone', 'email', 'fullDescription', 'description', 'photos', 'images', 'contact'])
        || jsonb_build_object(
          'accessMethod', v_access_method,
          'usageAuthorization', 'AUTHORIZED'
        )
    from valid_rows
    on conflict (source_id, external_reference, observation_date) do update
    set source_url = excluded.source_url,
        observation_kind = excluded.observation_kind,
        published_at = excluded.published_at,
        last_verified_at = excluded.last_verified_at,
        property_type = excluded.property_type,
        title = excluded.title,
        neighborhood = excluded.neighborhood,
        city = excluded.city,
        state = excluded.state,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        location_precision = excluded.location_precision,
        bedrooms = excluded.bedrooms,
        bathrooms = excluded.bathrooms,
        parking_spaces = excluded.parking_spaces,
        construction_age = excluded.construction_age,
        conservation_state = excluded.conservation_state,
        surface_total_m2 = excluded.surface_total_m2,
        surface_built_m2 = excluded.surface_built_m2,
        price_amount = excluded.price_amount,
        quality_score = excluded.quality_score,
        listing_status = 'ACTIVE',
        last_seen_at = excluded.last_seen_at,
        parser_version = excluded.parser_version,
        content_fingerprint = excluded.content_fingerprint,
        syndication_fingerprint = excluded.syndication_fingerprint,
        data_completeness = excluded.data_completeness,
        attributes = valuation.market_observations.attributes || excluded.attributes
    returning 1
  )
  select count(*) into v_accepted from upserted;

  return jsonb_build_object(
    'sourceId', v_source_id,
    'received', v_received,
    'accepted', v_accepted,
    'rejected', greatest(0, v_received - v_accepted)
  );
end;
$$;

drop function if exists public.get_market_observations_for_valuation(date, text, text);
create function public.get_market_observations_for_valuation(
  p_since date default (current_date - 180),
  p_city text default null,
  p_state text default null
)
returns table (
  id uuid,
  source_code text,
  external_reference text,
  observation_kind text,
  observation_date date,
  published_at timestamptz,
  last_verified_at timestamptz,
  property_type text,
  title text,
  neighborhood text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  location_precision text,
  bedrooms numeric,
  bathrooms numeric,
  parking_spaces integer,
  construction_age integer,
  conservation_state text,
  surface_total_m2 numeric,
  surface_built_m2 numeric,
  price_amount numeric,
  currency text,
  quality_score numeric,
  syndication_fingerprint text,
  data_completeness numeric,
  usage_authorization text
)
language sql
stable
security definer
set search_path = pg_catalog, public, valuation
as $$
  select distinct on (observation.source_id, observation.external_reference)
    observation.id,
    source.source_code,
    observation.external_reference,
    observation.observation_kind,
    observation.observation_date,
    observation.published_at,
    observation.last_verified_at,
    observation.property_type,
    observation.title,
    observation.neighborhood,
    observation.city,
    observation.state,
    observation.latitude,
    observation.longitude,
    observation.location_precision,
    observation.bedrooms,
    observation.bathrooms,
    observation.parking_spaces,
    observation.construction_age,
    observation.conservation_state,
    observation.surface_total_m2,
    observation.surface_built_m2,
    observation.price_amount,
    observation.currency,
    observation.quality_score,
    observation.syndication_fingerprint,
    observation.data_completeness,
    coalesce(source.metadata ->> 'usageAuthorization', 'UNVERIFIED')
  from valuation.market_observations observation
  join valuation.sources source on source.id = observation.source_id
  where source.is_active = true
    and source.source_kind = 'MARKET_LISTING'
    and source.metadata ->> 'usageAuthorization' = 'AUTHORIZED'
    and observation.listing_status = 'ACTIVE'
    and observation.observation_date >= coalesce(p_since, current_date - 180)
    and observation.published_at >= now() - interval '180 days'
    and observation.last_verified_at >= now() - interval '30 days'
    and observation.quality_score >= 75
    and observation.data_completeness >= 0.80
    and observation.currency = 'MXN'
    and (p_city is null or lower(observation.city) = lower(p_city))
    and (p_state is null or lower(observation.state) = lower(p_state))
  order by observation.source_id, observation.external_reference, observation.last_verified_at desc;
$$;

create or replace function valuation.enforce_public_valuation_gate()
returns trigger
language plpgsql
set search_path = pg_catalog, valuation
as $$
declare
  v_source_count integer := 0;
begin
  if jsonb_typeof(new.calculation_details -> 'sourceCodes') = 'array' then
    v_source_count := jsonb_array_length(new.calculation_details -> 'sourceCodes');
  end if;

  if new.status = 'COMPLETED' and not (
    new.model_version = 'towers-market-v4'
    and new.confidence in ('MEDIUM', 'HIGH')
    and new.confidence_score >= 65
    and new.comparable_count >= 8
    and v_source_count >= 2
    and (new.estimated_sale_value is not null or new.estimated_monthly_rent is not null)
  ) then
    new.status := 'INSUFFICIENT_DATA';
    new.confidence := 'INSUFFICIENT';
    new.estimated_sale_value := null;
    new.sale_range_low := null;
    new.sale_range_high := null;
    new.sale_price_per_m2 := null;
    new.estimated_monthly_rent := null;
    new.rent_range_low := null;
    new.rent_range_high := null;
    new.rent_price_per_m2 := null;
    new.estimated_cap_rate := null;
    new.gross_rental_yield := null;
    new.listing_vs_estimate_pct := null;
    new.completed_at := null;
    new.warnings := array_append(new.warnings, 'La corrida no superó la compuerta pública Towers Market v4.');
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_public_valuation_gate on valuation.property_valuation_runs;
create trigger enforce_public_valuation_gate
before insert or update on valuation.property_valuation_runs
for each row execute function valuation.enforce_public_valuation_gate();

create or replace view public.public_property_valuations_view
with (security_invoker = false)
as
select
  run.id,
  run.property_id,
  run.currency,
  run.estimated_sale_value,
  run.sale_range_low,
  run.sale_range_high,
  run.sale_price_per_m2,
  run.estimated_monthly_rent,
  run.rent_range_low,
  run.rent_range_high,
  run.rent_price_per_m2,
  run.estimated_cap_rate,
  run.gross_rental_yield,
  run.listing_price,
  run.listing_vs_estimate_pct,
  run.confidence,
  run.confidence_score,
  run.comparable_count,
  run.sale_comparable_count,
  run.rent_comparable_count,
  run.data_as_of,
  run.model_version,
  run.methodology,
  run.warnings,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'propertyId', comparable.comparable_property_id,
      'title', comparable.comparable_title,
      'location', comparable.comparable_location,
      'operation', comparable.operation,
      'price', comparable.price_amount,
      'currency', comparable.currency,
      'surfaceM2', comparable.surface_m2,
      'pricePerM2', comparable.price_per_m2,
      'distanceMeters', comparable.distance_meters,
      'weight', comparable.weight
    ) order by comparable.rank)
    from (
      select candidate.*
      from valuation.property_valuation_comparables candidate
      where candidate.valuation_run_id = run.id
      order by candidate.rank
      limit 8
    ) comparable
  ), '[]'::jsonb) as comparables,
  coalesce((
    select array_agg(distinct case
      when comparable.market_observation_id is null then 'Inventario autorizado de Towers México'
      else coalesce(source.name, 'Fuente de mercado autorizada')
    end)
    from valuation.property_valuation_comparables comparable
    left join valuation.market_observations observation on observation.id = comparable.market_observation_id
    left join valuation.sources source on source.id = observation.source_id
    where comparable.valuation_run_id = run.id
  ), '{}'::text[]) as source_labels
from valuation.property_valuation_runs run
join public.properties property on property.id = run.property_id
where run.status = 'COMPLETED'
  and run.model_version = 'towers-market-v4'
  and run.confidence in ('MEDIUM', 'HIGH')
  and run.confidence_score >= 65
  and run.comparable_count >= 8
  and property.is_published = true
  and property.folder_status = 'PUBLISHED'
  and coalesce(property.is_demo, false) = false
  and run.id = (
    select latest.id
    from valuation.property_valuation_runs latest
    where latest.property_id = run.property_id
    order by latest.created_at desc
    limit 1
  );

revoke all on function public.ingest_market_listing_observations(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.get_market_observations_for_valuation(date, text, text) from public, anon, authenticated;
grant execute on function public.ingest_market_listing_observations(jsonb, jsonb) to service_role;
grant execute on function public.get_market_observations_for_valuation(date, text, text) to service_role;
revoke all on public.public_property_valuations_view from public;
grant select on public.public_property_valuations_view to anon, authenticated;

comment on view public.public_property_valuations_view is
  'Only the newest Towers Market v4 run when it passed all public evidence gates. A newer insufficient run immediately hides every older estimate.';
