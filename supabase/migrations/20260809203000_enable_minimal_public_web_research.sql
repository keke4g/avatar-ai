-- Minimal public-listing research is kept separate from partner/licensed
-- inventory. Raw observations remain private and only a quality-gated
-- aggregate may reach the public property valuation view.

create or replace function public.ingest_research_market_observations(
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
  v_source_code text;
  v_received integer := 0;
  v_accepted integer := 0;
begin
  if jsonb_typeof(p_source) <> 'object'
     or nullif(trim(p_source ->> 'source_code'), '') is null
     or nullif(trim(p_source ->> 'official_url'), '') is null then
    raise exception 'A valid research source is required';
  end if;
  if jsonb_typeof(p_observations) <> 'array' then
    raise exception 'p_observations must be a JSON array';
  end if;

  v_source_code := trim(p_source ->> 'source_code');
  if v_source_code not in ('mercadolibre-inmuebles', 'inmuebles24', 'propiedades-com') then
    raise exception 'Unsupported public research source: %', v_source_code;
  end if;
  if upper(coalesce(p_source #>> '{metadata,usageAuthorization}', '')) <> 'RESEARCH_ONLY'
     or upper(coalesce(p_source #>> '{metadata,accessMethod}', '')) <> 'PUBLIC_WEB_RESEARCH'
     or coalesce(p_source #>> '{metadata,researchScope}', '') <> 'minimal-asking-price-comparables' then
    raise exception 'The source is not scoped for minimal public web research';
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
    v_source_code,
    coalesce(nullif(trim(p_source ->> 'organization'), ''), v_source_code),
    coalesce(nullif(trim(p_source ->> 'name'), ''), v_source_code),
    trim(p_source ->> 'official_url'),
    'MARKET_LISTING',
    coalesce(nullif(trim(p_source ->> 'geographic_scope'), ''), 'México'),
    'on-demand',
    'Investigación comparativa de anuncios públicos',
    nullif(trim(p_source ->> 'license_url'), ''),
    true,
    coalesce(p_source -> 'metadata', '{}'::jsonb) || jsonb_build_object(
      'usageAuthorization', 'RESEARCH_ONLY',
      'accessMethod', 'PUBLIC_WEB_RESEARCH',
      'visibility', 'internal',
      'storedFieldsExclude', jsonb_build_array(
        'phone', 'email', 'fullDescription', 'description', 'photos', 'images', 'contact'
      )
    ),
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
      coalesce(rows.published_at, rows.observation_date::timestamptz, now()) as first_public_evidence_at
    from rows
    where nullif(trim(external_reference), '') is not null
      and nullif(trim(source_url), '') is not null
      and case v_source_code
        when 'mercadolibre-inmuebles' then source_url ~* '^https://(inmueble|inmuebles)\.mercadolibre\.com\.mx/'
        when 'inmuebles24' then source_url ~* '^https://(www\.)?inmuebles24\.com/'
        when 'propiedades-com' then source_url ~* '^https://(www\.)?propiedades\.com/'
        else false
      end
      and observation_kind in ('ASKING_SALE', 'ASKING_RENT')
      and property_type in ('HOUSE', 'APARTMENT', 'LAND', 'COMMERCIAL', 'OFFICE', 'LOFT')
      and nullif(trim(neighborhood), '') is not null
      and nullif(trim(city), '') is not null
      and nullif(trim(state), '') is not null
      and price_amount > 0
      and upper(coalesce(currency, 'MXN')) = 'MXN'
      and coalesce(quality_score, 0) >= 65
      and coalesce(data_completeness, 0) >= 0.70
      and coalesce(location_precision, 'UNKNOWN') in ('POINT', 'NEIGHBORHOOD', 'POSTAL_CODE')
      and (latitude is null or latitude between 14 and 33.5)
      and (longitude is null or longitude between -118.5 and -86)
      and ((latitude is null and longitude is null) or (latitude is not null and longitude is not null))
      and coalesce(rows.published_at, rows.observation_date::timestamptz, now()) >= now() - interval '180 days'
      and coalesce(rows.last_verified_at, now()) >= now() - interval '30 days'
      and coalesce(rows.last_verified_at, now()) <= now() + interval '1 day'
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
      coalesce(observation_date, verified_at::date),
      first_public_evidence_at,
      verified_at,
      property_type,
      nullif(left(trim(title), 240), ''),
      left(trim(neighborhood), 120),
      left(trim(city), 120),
      left(trim(state), 120),
      coalesce(nullif(left(trim(country), 80), ''), 'México'),
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
      coalesce(nullif(parser_version, ''), 'towers-scrapling-research-v2'),
      md5(concat_ws('|', external_reference, observation_kind, price_amount,
        neighborhood, surface_total_m2, surface_built_m2, bedrooms, bathrooms)),
      nullif(trim(syndication_fingerprint), ''),
      data_completeness,
      (coalesce(attributes, '{}'::jsonb)
        - array['phone', 'email', 'fullDescription', 'description', 'photos', 'images', 'contact'])
        || jsonb_build_object(
          'accessMethod', 'PUBLIC_WEB_RESEARCH',
          'usageAuthorization', 'RESEARCH_ONLY',
          'researchOnly', true,
          'askingPrice', true
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
    'rejected', greatest(0, v_received - v_accepted),
    'usageAuthorization', 'RESEARCH_ONLY'
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
    and source.metadata ->> 'usageAuthorization' in ('AUTHORIZED', 'RESEARCH_ONLY')
    and observation.listing_status = 'ACTIVE'
    and observation.observation_date >= coalesce(p_since, current_date - 180)
    and observation.published_at >= now() - interval '180 days'
    and observation.last_verified_at >= now() - interval '30 days'
    and observation.currency = 'MXN'
    and (
      (source.metadata ->> 'usageAuthorization' = 'AUTHORIZED'
        and observation.quality_score >= 75
        and observation.data_completeness >= 0.80)
      or
      (source.metadata ->> 'usageAuthorization' = 'RESEARCH_ONLY'
        and source.metadata ->> 'researchScope' = 'minimal-asking-price-comparables'
        and observation.quality_score >= 65
        and observation.data_completeness >= 0.70)
    )
    and (p_city is null or lower(observation.city) = lower(p_city))
    and (p_state is null or lower(observation.state) = lower(p_state))
  order by observation.source_id, observation.external_reference, observation.last_verified_at desc;
$$;

revoke all on function public.ingest_research_market_observations(jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.get_market_observations_for_valuation(date, text, text) from public, anon, authenticated;
grant execute on function public.ingest_research_market_observations(jsonb, jsonb) to service_role;
grant execute on function public.get_market_observations_for_valuation(date, text, text) to service_role;

comment on function public.ingest_research_market_observations(jsonb, jsonb) is
  'Private, minimal public-listing observations for comparative market research. Contacts, descriptions and media are excluded. Not a portal content replica.';

comment on function public.get_market_observations_for_valuation(date, text, text) is
  'Current authorized inventory plus private RESEARCH_ONLY asking-price observations; service role only.';
