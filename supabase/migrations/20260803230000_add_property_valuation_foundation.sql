-- Towers México automated valuation foundation.
-- Numerical estimates remain reproducible database records. The public view
-- exposes only completed snapshots for properties already in the public catalog.

create schema if not exists extensions;
create extension if not exists postgis with schema extensions;
create schema if not exists valuation;

revoke all on schema valuation from public, anon, authenticated;

create table if not exists valuation.sources (
  id uuid primary key default gen_random_uuid(),
  source_code text not null unique,
  organization text not null,
  name text not null,
  official_url text not null,
  source_kind text not null check (source_kind in (
    'SHF_INDEX', 'SNIIV', 'INEGI', 'CATASTRAL', 'CNBV',
    'INTERNAL_LISTING', 'CLOSED_TRANSACTION', 'OFFICIAL_APPRAISAL', 'OTHER'
  )),
  geographic_scope text,
  update_frequency text,
  license_name text,
  license_url text,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists valuation.source_files (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references valuation.sources(id) on delete restrict,
  source_url text not null,
  storage_bucket text not null check (storage_bucket in ('valuation-raw', 'valuation-derived')),
  storage_path text not null,
  sha256 text not null,
  mime_type text,
  file_size_bytes bigint check (file_size_bytes is null or file_size_bytes >= 0),
  period_start date,
  period_end date,
  downloaded_at timestamptz not null default now(),
  parser_version text,
  row_count bigint check (row_count is null or row_count >= 0),
  ingestion_status text not null default 'DOWNLOADED' check (
    ingestion_status in ('DOWNLOADED', 'PROCESSING', 'PROCESSED', 'REJECTED', 'FAILED')
  ),
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (source_id, sha256)
);

create table if not exists valuation.market_observations (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references valuation.sources(id) on delete restrict,
  source_file_id uuid references valuation.source_files(id) on delete set null,
  external_reference text,
  observation_kind text not null check (observation_kind in (
    'ASKING_SALE', 'CLOSED_SALE', 'ASKING_RENT', 'CLOSED_RENT',
    'OFFICIAL_APPRAISAL', 'CATASTRAL_VALUE'
  )),
  observation_date date not null,
  property_type text not null,
  title text,
  neighborhood text,
  city text not null,
  state text not null,
  country text not null default 'México',
  latitude double precision,
  longitude double precision,
  geography extensions.geography(point, 4326),
  bedrooms numeric(6,2),
  bathrooms numeric(6,2),
  parking_spaces integer,
  construction_age integer,
  conservation_state text,
  surface_total_m2 numeric(14,2),
  surface_built_m2 numeric(14,2),
  price_amount numeric(16,2) not null check (price_amount > 0),
  currency text not null default 'MXN',
  quality_score numeric(5,2) not null default 50 check (quality_score between 0 and 100),
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint market_observations_valid_coordinates check (
    (latitude is null and longitude is null)
    or (
      latitude between -90 and 90
      and longitude between -180 and 180
    )
  ),
  unique nulls not distinct (source_id, external_reference, observation_date)
);

create index if not exists market_observations_geo_idx
  on valuation.market_observations using gist (geography);
create index if not exists market_observations_market_idx
  on valuation.market_observations (state, city, property_type, observation_kind, observation_date desc);

create table if not exists valuation.property_valuation_runs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'COMPLETED', 'INSUFFICIENT_DATA', 'FAILED')),
  model_version text not null,
  currency text not null default 'MXN',
  estimated_sale_value numeric(16,2),
  sale_range_low numeric(16,2),
  sale_range_high numeric(16,2),
  sale_price_per_m2 numeric(16,2),
  estimated_monthly_rent numeric(16,2),
  rent_range_low numeric(16,2),
  rent_range_high numeric(16,2),
  rent_price_per_m2 numeric(16,2),
  estimated_cap_rate numeric(7,3),
  gross_rental_yield numeric(7,3),
  listing_price numeric(16,2),
  listing_vs_estimate_pct numeric(8,3),
  confidence text not null default 'INSUFFICIENT' check (confidence in ('HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT')),
  confidence_score integer not null default 0 check (confidence_score between 0 and 100),
  comparable_count integer not null default 0 check (comparable_count >= 0),
  sale_comparable_count integer not null default 0 check (sale_comparable_count >= 0),
  rent_comparable_count integer not null default 0 check (rent_comparable_count >= 0),
  data_as_of timestamptz not null,
  methodology text not null,
  warnings text[] not null default '{}',
  input_snapshot jsonb not null default '{}'::jsonb,
  calculation_details jsonb not null default '{}'::jsonb,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint property_valuation_sale_range check (
    sale_range_low is null or sale_range_high is null or sale_range_low <= sale_range_high
  ),
  constraint property_valuation_rent_range check (
    rent_range_low is null or rent_range_high is null or rent_range_low <= rent_range_high
  )
);

create index if not exists property_valuation_runs_latest_idx
  on valuation.property_valuation_runs (property_id, created_at desc)
  where status = 'COMPLETED';

create table if not exists valuation.property_valuation_comparables (
  id uuid primary key default gen_random_uuid(),
  valuation_run_id uuid not null references valuation.property_valuation_runs(id) on delete cascade,
  market_observation_id uuid references valuation.market_observations(id) on delete set null,
  comparable_property_id uuid references public.properties(id) on delete set null,
  operation text not null check (operation in ('SALE', 'MONTHLY_RENT')),
  comparable_title text not null,
  comparable_location text not null,
  price_amount numeric(16,2) not null check (price_amount > 0),
  currency text not null default 'MXN',
  surface_m2 numeric(14,2) not null check (surface_m2 > 0),
  price_per_m2 numeric(16,2) not null check (price_per_m2 > 0),
  distance_meters integer not null check (distance_meters >= 0),
  weight numeric(10,6) not null check (weight > 0),
  rank integer not null check (rank > 0),
  adjustments jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint valuation_comparable_has_source check (
    market_observation_id is not null or comparable_property_id is not null
  ),
  unique (valuation_run_id, operation, rank)
);

alter table valuation.sources enable row level security;
alter table valuation.source_files enable row level security;
alter table valuation.market_observations enable row level security;
alter table valuation.property_valuation_runs enable row level security;
alter table valuation.property_valuation_comparables enable row level security;

-- The valuation schema is deliberately not exposed to browser roles. Service
-- jobs and migrations use privileged roles; public consumers use the view below.
revoke all on all tables in schema valuation from public, anon, authenticated;
revoke all on all sequences in schema valuation from public, anon, authenticated;

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
  ), '[]'::jsonb) as comparables
from valuation.property_valuation_runs run
join public.properties property on property.id = run.property_id
where run.status = 'COMPLETED'
  and property.is_published = true
  and property.folder_status = 'PUBLISHED'
  and coalesce(property.is_demo, false) = false
  and run.id = (
    select latest.id
    from valuation.property_valuation_runs latest
    where latest.property_id = run.property_id
      and latest.status = 'COMPLETED'
    order by latest.created_at desc
    limit 1
  );

revoke all on public.public_property_valuations_view from public;
grant select on public.public_property_valuations_view to anon, authenticated;

-- Physical characteristics required to interpret the public estimate. Exact
-- residential address and precise coordinates remain protected by the existing
-- show_public_address rule.
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
  case when coalesce(show_public_address, false) then latitude else round(latitude::numeric, 2)::double precision end as latitude,
  case when coalesce(show_public_address, false) then longitude else round(longitude::numeric, 2)::double precision end as longitude,
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
  show_public_address,
  neighborhood,
  postal_code,
  development_name,
  subdivision_name,
  private_neighborhood,
  condominium_regime,
  maintenance_fee_amount,
  half_bathrooms,
  parking_spaces,
  levels_count,
  construction_age,
  conservation_state_id,
  construction_type_id,
  surface_total,
  surface_built,
  surface_front,
  surface_depth,
  surface_garden,
  surface_terrace,
  surface_roof_garden,
  surface_patio,
  services_water,
  services_electricity,
  services_sewerage,
  services_nat_gas,
  services_lp_gas,
  services_internet,
  services_garbage,
  security_cctv,
  security_guardhouse,
  security_24_7,
  security_biometric,
  view_type_id,
  orientation_id
from public.properties
where is_published = true
  and folder_status = 'PUBLISHED'
  and coalesce(is_demo, false) = false;

grant select on public.public_properties_view to anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('valuation-raw', 'valuation-raw', false, 262144000),
  ('valuation-derived', 'valuation-derived', false, 262144000)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

drop policy if exists "Valuation admins can read source files" on storage.objects;
create policy "Valuation admins can read source files"
on storage.objects for select
to authenticated
using (
  bucket_id in ('valuation-raw', 'valuation-derived')
  and coalesce(public.is_admin((select auth.uid())), false)
);

drop policy if exists "Valuation admins can upload source files" on storage.objects;
create policy "Valuation admins can upload source files"
on storage.objects for insert
to authenticated
with check (
  bucket_id in ('valuation-raw', 'valuation-derived')
  and coalesce(public.is_admin((select auth.uid())), false)
);

drop policy if exists "Valuation admins can update source files" on storage.objects;
create policy "Valuation admins can update source files"
on storage.objects for update
to authenticated
using (
  bucket_id in ('valuation-raw', 'valuation-derived')
  and coalesce(public.is_admin((select auth.uid())), false)
)
with check (
  bucket_id in ('valuation-raw', 'valuation-derived')
  and coalesce(public.is_admin((select auth.uid())), false)
);

drop policy if exists "Valuation admins can delete source files" on storage.objects;
create policy "Valuation admins can delete source files"
on storage.objects for delete
to authenticated
using (
  bucket_id in ('valuation-raw', 'valuation-derived')
  and coalesce(public.is_admin((select auth.uid())), false)
);

comment on view public.public_property_valuations_view is
  'Latest completed automated valuation for each public production property. Never represents a signed official appraisal.';
