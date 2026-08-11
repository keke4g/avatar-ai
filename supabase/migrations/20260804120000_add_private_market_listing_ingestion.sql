-- Private asking-price observations collected for internal valuation research.
-- Browser roles never receive these rows, source URLs, or comparable identities.

alter table valuation.sources
  drop constraint if exists sources_source_kind_check;

alter table valuation.sources
  add constraint sources_source_kind_check check (source_kind in (
    'SHF_INDEX', 'SNIIV', 'INEGI', 'CATASTRAL', 'CNBV',
    'INTERNAL_LISTING', 'MARKET_LISTING', 'CLOSED_TRANSACTION',
    'OFFICIAL_APPRAISAL', 'OTHER'
  ));

alter table valuation.market_observations
  add column if not exists source_url text,
  add column if not exists listing_status text not null default 'ACTIVE'
    check (listing_status in ('ACTIVE', 'INACTIVE', 'REMOVED', 'UNKNOWN')),
  add column if not exists first_seen_at timestamptz not null default now(),
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists parser_version text,
  add column if not exists content_fingerprint text;

create index if not exists market_observations_external_active_idx
  on valuation.market_observations (source_id, external_reference, last_seen_at desc)
  where listing_status = 'ACTIVE';

create index if not exists market_observations_neighborhood_idx
  on valuation.market_observations (
    state,
    city,
    neighborhood,
    property_type,
    observation_kind,
    observation_date desc
  );

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
begin
  if jsonb_typeof(p_source) <> 'object'
     or nullif(trim(p_source ->> 'source_code'), '') is null
     or nullif(trim(p_source ->> 'official_url'), '') is null then
    raise exception 'A valid market source is required';
  end if;
  if jsonb_typeof(p_observations) <> 'array' then
    raise exception 'p_observations must be a JSON array';
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
    is_active,
    metadata,
    updated_at
  ) values (
    trim(p_source ->> 'source_code'),
    coalesce(nullif(trim(p_source ->> 'organization'), ''), trim(p_source ->> 'source_code')),
    coalesce(nullif(trim(p_source ->> 'name'), ''), trim(p_source ->> 'source_code')),
    trim(p_source ->> 'official_url'),
    'MARKET_LISTING',
    'México; Culiacán durante el piloto',
    'daily',
    'Internal research; source-specific access rules apply',
    true,
    coalesce(p_source -> 'metadata', '{}'::jsonb),
    now()
  )
  on conflict (source_code) do update
  set organization = excluded.organization,
      name = excluded.name,
      official_url = excluded.official_url,
      source_kind = 'MARKET_LISTING',
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
      property_type text,
      title text,
      neighborhood text,
      city text,
      state text,
      country text,
      latitude double precision,
      longitude double precision,
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
      attributes jsonb
    )
  ), valid_rows as (
    select *
    from rows
    where nullif(trim(external_reference), '') is not null
      and nullif(trim(source_url), '') is not null
      and observation_kind in ('ASKING_SALE', 'ASKING_RENT')
      and property_type in ('HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OFFICE', 'LOFT')
      and observation_date is not null
      and nullif(trim(neighborhood), '') is not null
      and nullif(trim(city), '') is not null
      and nullif(trim(state), '') is not null
      and price_amount > 0
      and upper(coalesce(currency, 'MXN')) in ('MXN', 'USD')
      and coalesce(quality_score, 0) >= 55
      and (latitude is null or latitude between 14 and 33.5)
      and (longitude is null or longitude between -118.5 and -86)
  ), upserted as (
    insert into valuation.market_observations (
      source_id,
      external_reference,
      source_url,
      observation_kind,
      observation_date,
      property_type,
      title,
      neighborhood,
      city,
      state,
      country,
      latitude,
      longitude,
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
      attributes
    )
    select
      v_source_id,
      trim(external_reference),
      source_url,
      observation_kind,
      observation_date,
      property_type,
      nullif(trim(title), ''),
      trim(neighborhood),
      trim(city),
      trim(state),
      coalesce(nullif(trim(country), ''), 'México'),
      latitude,
      longitude,
      bedrooms,
      bathrooms,
      parking_spaces,
      construction_age,
      conservation_state,
      surface_total_m2,
      surface_built_m2,
      price_amount,
      upper(coalesce(currency, 'MXN')),
      least(100, greatest(0, coalesce(quality_score, 0))),
      'ACTIVE',
      now(),
      now(),
      parser_version,
      md5(concat_ws('|', external_reference, observation_kind, price_amount, currency,
        neighborhood, surface_total_m2, surface_built_m2, bedrooms, bathrooms)),
      coalesce(attributes, '{}'::jsonb)
    from valid_rows
    on conflict (source_id, external_reference, observation_date) do update
    set source_url = excluded.source_url,
        observation_kind = excluded.observation_kind,
        property_type = excluded.property_type,
        title = excluded.title,
        neighborhood = excluded.neighborhood,
        city = excluded.city,
        state = excluded.state,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        bedrooms = excluded.bedrooms,
        bathrooms = excluded.bathrooms,
        parking_spaces = excluded.parking_spaces,
        construction_age = excluded.construction_age,
        conservation_state = excluded.conservation_state,
        surface_total_m2 = excluded.surface_total_m2,
        surface_built_m2 = excluded.surface_built_m2,
        price_amount = excluded.price_amount,
        currency = excluded.currency,
        quality_score = excluded.quality_score,
        listing_status = 'ACTIVE',
        last_seen_at = now(),
        parser_version = excluded.parser_version,
        content_fingerprint = excluded.content_fingerprint,
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

create or replace function public.get_market_observations_for_valuation(
  p_since date default (current_date - 365),
  p_city text default null,
  p_state text default null
)
returns table (
  id uuid,
  source_code text,
  external_reference text,
  observation_kind text,
  observation_date date,
  property_type text,
  title text,
  neighborhood text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  bedrooms numeric,
  bathrooms numeric,
  parking_spaces integer,
  construction_age integer,
  conservation_state text,
  surface_total_m2 numeric,
  surface_built_m2 numeric,
  price_amount numeric,
  currency text,
  quality_score numeric
)
language sql
stable
security definer
set search_path = pg_catalog, public, valuation
as $$
  select
    observation.id,
    source.source_code,
    observation.external_reference,
    observation.observation_kind,
    observation.observation_date,
    observation.property_type,
    observation.title,
    observation.neighborhood,
    observation.city,
    observation.state,
    observation.latitude,
    observation.longitude,
    observation.bedrooms,
    observation.bathrooms,
    observation.parking_spaces,
    observation.construction_age,
    observation.conservation_state,
    observation.surface_total_m2,
    observation.surface_built_m2,
    observation.price_amount,
    observation.currency,
    observation.quality_score
  from valuation.market_observations observation
  join valuation.sources source on source.id = observation.source_id
  where source.is_active = true
    and source.source_kind = 'MARKET_LISTING'
    and observation.listing_status = 'ACTIVE'
    and observation.observation_date >= coalesce(p_since, current_date - 365)
    and observation.quality_score >= 55
    and (p_city is null or lower(observation.city) = lower(p_city))
    and (p_state is null or lower(observation.state) = lower(p_state));
$$;

create or replace function public.save_market_valuation_run(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, valuation
as $$
declare
  v_run_id uuid;
  v_property_id uuid;
  v_valuation jsonb;
  v_status text;
  v_comparable_count integer := 0;
begin
  v_property_id := nullif(p_payload ->> 'propertyId', '')::uuid;
  v_valuation := coalesce(p_payload -> 'valuation', '{}'::jsonb);
  if not exists (
    select 1 from public.properties property where property.id = v_property_id
  ) then
    raise exception 'Unknown property %', v_property_id;
  end if;
  v_status := case
    when coalesce(v_valuation ->> 'confidence', 'INSUFFICIENT') = 'INSUFFICIENT'
      then 'INSUFFICIENT_DATA'
    else 'COMPLETED'
  end;

  insert into valuation.property_valuation_runs (
    property_id,
    status,
    model_version,
    currency,
    estimated_sale_value,
    sale_range_low,
    sale_range_high,
    sale_price_per_m2,
    estimated_monthly_rent,
    rent_range_low,
    rent_range_high,
    rent_price_per_m2,
    estimated_cap_rate,
    gross_rental_yield,
    listing_price,
    listing_vs_estimate_pct,
    confidence,
    confidence_score,
    comparable_count,
    sale_comparable_count,
    rent_comparable_count,
    data_as_of,
    methodology,
    warnings,
    input_snapshot,
    calculation_details,
    completed_at
  ) values (
    v_property_id,
    v_status,
    coalesce(nullif(v_valuation ->> 'modelVersion', ''), 'towers-market-v3'),
    coalesce(nullif(v_valuation ->> 'currency', ''), 'MXN'),
    nullif(v_valuation ->> 'estimatedSaleValue', '')::numeric,
    nullif(v_valuation ->> 'saleRangeLow', '')::numeric,
    nullif(v_valuation ->> 'saleRangeHigh', '')::numeric,
    nullif(v_valuation ->> 'salePricePerM2', '')::numeric,
    nullif(v_valuation ->> 'estimatedMonthlyRent', '')::numeric,
    nullif(v_valuation ->> 'rentRangeLow', '')::numeric,
    nullif(v_valuation ->> 'rentRangeHigh', '')::numeric,
    nullif(v_valuation ->> 'rentPricePerM2', '')::numeric,
    nullif(v_valuation ->> 'estimatedCapRate', '')::numeric,
    nullif(v_valuation ->> 'grossRentalYield', '')::numeric,
    nullif(v_valuation ->> 'listingPrice', '')::numeric,
    nullif(v_valuation ->> 'listingVsEstimatePct', '')::numeric,
    coalesce(nullif(v_valuation ->> 'confidence', ''), 'INSUFFICIENT'),
    coalesce((v_valuation ->> 'confidenceScore')::integer, 0),
    coalesce((v_valuation ->> 'comparableCount')::integer, 0),
    coalesce((v_valuation ->> 'saleComparableCount')::integer, 0),
    coalesce((v_valuation ->> 'rentComparableCount')::integer, 0),
    coalesce(nullif(v_valuation ->> 'dataAsOf', '')::timestamptz, now()),
    coalesce(nullif(v_valuation ->> 'methodology', ''), 'Modelo Towers Market'),
    coalesce(array(select jsonb_array_elements_text(v_valuation -> 'warnings')), '{}'::text[]),
    jsonb_build_object(
      'propertyId', v_property_id,
      'source', 'market-observations',
      'generatedAt', now()
    ),
    jsonb_build_object(
      'sourceCodes', coalesce(p_payload -> 'sourceCodes', '[]'::jsonb),
      'privateComparables', true
    ),
    case when v_status = 'COMPLETED' then now() else null end
  )
  returning id into v_run_id;

  if v_status = 'COMPLETED' and jsonb_typeof(v_valuation -> 'comparables') = 'array' then
    with comparable_rows as (
      select comparable, ordinality::integer as rank
      from jsonb_array_elements(v_valuation -> 'comparables') with ordinality as rows(comparable, ordinality)
    ), inserted as (
      insert into valuation.property_valuation_comparables (
        valuation_run_id,
        market_observation_id,
        comparable_property_id,
        operation,
        comparable_title,
        comparable_location,
        price_amount,
        currency,
        surface_m2,
        price_per_m2,
        distance_meters,
        weight,
        rank,
        adjustments
      )
      select
        v_run_id,
        case
          when coalesce(comparable ->> 'marketObservationId', '')
            ~ '^[0-9a-fA-F-]{36}$'
          then (comparable ->> 'marketObservationId')::uuid
          else null
        end,
        case
          when coalesce(comparable ->> 'marketObservationId', '') = ''
            and coalesce(comparable ->> 'propertyId', '')
              ~ '^[0-9a-fA-F-]{36}$'
          then (comparable ->> 'propertyId')::uuid
          else null
        end,
        comparable ->> 'operation',
        case
          when coalesce(comparable ->> 'marketObservationId', '') <> ''
            then 'Comparable externo anonimizado'
          else left(coalesce(comparable ->> 'title', 'Comparable interno'), 240)
        end,
        case
          when coalesce(comparable ->> 'marketObservationId', '') <> ''
            then 'Micromercado coincidente'
          else left(coalesce(comparable ->> 'location', 'Ubicación protegida'), 240)
        end,
        (comparable ->> 'price')::numeric,
        coalesce(nullif(comparable ->> 'currency', ''), 'MXN'),
        (comparable ->> 'surfaceM2')::numeric,
        (comparable ->> 'pricePerM2')::numeric,
        greatest(0, (comparable ->> 'distanceMeters')::integer),
        greatest(0.000001, (comparable ->> 'weight')::numeric),
        rank,
        jsonb_build_object(
          'sourceCode', comparable ->> 'sourceCode',
          'external', coalesce(comparable ->> 'marketObservationId', '') <> ''
        )
      from comparable_rows
      where comparable ->> 'operation' in ('SALE', 'MONTHLY_RENT')
        and (comparable ->> 'price')::numeric > 0
        and (comparable ->> 'surfaceM2')::numeric > 0
        and (
          coalesce(comparable ->> 'marketObservationId', '') ~ '^[0-9a-fA-F-]{36}$'
          or coalesce(comparable ->> 'propertyId', '') ~ '^[0-9a-fA-F-]{36}$'
        )
      returning 1
    )
    select count(*) into v_comparable_count from inserted;
  end if;

  return jsonb_build_object(
    'runId', v_run_id,
    'status', v_status,
    'comparablesSaved', v_comparable_count
  );
end;
$$;

revoke all on function public.ingest_market_listing_observations(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.get_market_observations_for_valuation(date, text, text) from public, anon, authenticated;
revoke all on function public.save_market_valuation_run(jsonb) from public, anon, authenticated;
grant execute on function public.ingest_market_listing_observations(jsonb, jsonb) to service_role;
grant execute on function public.get_market_observations_for_valuation(date, text, text) to service_role;
grant execute on function public.save_market_valuation_run(jsonb) to service_role;

comment on function public.ingest_market_listing_observations(jsonb, jsonb) is
  'Service-role-only ingestion of minimal asking-price observations. Contact data, full descriptions and photos are intentionally excluded.';
