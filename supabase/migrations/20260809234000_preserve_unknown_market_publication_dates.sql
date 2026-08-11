-- A successful capture proves that an asking price was active on the
-- verification date.  It does not prove when the portal first published the
-- listing.  Preserve that distinction while still allowing current verified
-- observations to participate in the private quality gate.

create or replace function valuation.preserve_unknown_market_publication_date()
returns trigger
language plpgsql
set search_path = pg_catalog, valuation
as $$
begin
  if coalesce(new.attributes ->> 'publicationDateKnown', 'true') = 'false' then
    new.published_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists preserve_unknown_market_publication_date
  on valuation.market_observations;
create trigger preserve_unknown_market_publication_date
before insert or update of published_at, attributes
on valuation.market_observations
for each row execute function valuation.preserve_unknown_market_publication_date();

update valuation.market_observations
set published_at = null
where coalesce(attributes ->> 'publicationDateKnown', 'true') = 'false'
  and published_at is not null;

create or replace function public.get_market_observations_for_valuation(
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
    and (
      observation.published_at is null
      or observation.published_at >= now() - interval '180 days'
    )
    and observation.last_verified_at >= now() - interval '30 days'
    and observation.last_verified_at <= now() + interval '1 day'
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

revoke all on function public.get_market_observations_for_valuation(date, text, text)
  from public, anon, authenticated;
grant execute on function public.get_market_observations_for_valuation(date, text, text)
  to service_role;

comment on function public.get_market_observations_for_valuation(date, text, text) is
  'Latest authorized/research asking-price observations. Unknown publication dates stay null; current activity is determined from last_verified_at.';
