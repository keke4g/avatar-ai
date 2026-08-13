-- Towers Market v5 keeps the strict, distance-verified estimate intact and
-- makes AREA_REFERENCE a lightweight commercial estimate. Three coherent
-- asking-price comparables from the exact micromarket are enough to publish
-- an initial range; the UI communicates sample depth instead of pretending
-- this is a certified appraisal.

-- The public view checks the latest run regardless of status; the older
-- partial index only covers COMPLETED rows and cannot serve that lookup.
create index if not exists property_valuation_runs_property_created_idx
  on valuation.property_valuation_runs (property_id, created_at desc);

create or replace function valuation.enforce_public_valuation_gate()
returns trigger
language plpgsql
set search_path = pg_catalog, valuation
as $$
declare
  v_source_count integer := 0;
  v_strict_valid boolean := false;
  v_area_valid boolean := false;
  v_was_completed boolean := false;
begin
  v_was_completed := new.status = 'COMPLETED';
  if jsonb_typeof(new.calculation_details -> 'sourceCodes') = 'array' then
    v_source_count := jsonb_array_length(new.calculation_details -> 'sourceCodes');
  end if;

  v_strict_valid := (
    new.model_version = 'towers-market-v5'
    and new.evidence_tier = 'STRICT_ESTIMATE'
    and new.confidence in ('MEDIUM', 'HIGH')
    and new.confidence_score >= 65
    and new.comparable_count >= 8
    and v_source_count >= 2
    and (new.estimated_sale_value is not null or new.estimated_monthly_rent is not null)
    and new.area_reference_value is null
  );

  v_area_valid := (
    new.model_version = 'towers-market-v5'
    and new.evidence_tier = 'AREA_REFERENCE'
    and new.confidence = 'LOW'
    and new.confidence_score between 30 and 64
    and new.comparable_count >= 3
    and v_source_count >= 1
    and new.area_reference_value is not null
    and new.area_range_low is not null
    and new.area_range_high is not null
    and new.area_price_per_m2 is not null
    and new.area_reference_operation in ('SALE', 'MONTHLY_RENT')
    and new.area_location_basis = 'NEIGHBORHOOD'
    and new.estimated_sale_value is null
    and new.estimated_monthly_rent is null
    and new.listing_vs_estimate_pct is null
    and new.estimated_cap_rate is null
    and new.gross_rental_yield is null
  );

  if new.status <> 'COMPLETED' or not (v_strict_valid or v_area_valid) then
    new.status := 'INSUFFICIENT_DATA';
    new.confidence := 'INSUFFICIENT';
    new.evidence_tier := 'INSUFFICIENT';
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
    new.area_reference_value := null;
    new.area_range_low := null;
    new.area_range_high := null;
    new.area_price_per_m2 := null;
    new.area_reference_operation := null;
    new.area_location_basis := null;
    new.completed_at := null;
    if v_was_completed then
      new.warnings := array_append(
        coalesce(new.warnings, '{}'::text[]),
        'La corrida no superó la compuerta pública Towers Market v5.'
      );
    end if;
  end if;
  return new;
end;
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
  v_requested_status text;
  v_actual_status text;
  v_comparable_count integer := 0;
  v_source_count integer := 0;
  v_expected_count integer := 0;
  v_required_source_count integer := 0;
begin
  v_property_id := nullif(p_payload ->> 'propertyId', '')::uuid;
  v_valuation := coalesce(p_payload -> 'valuation', '{}'::jsonb);
  if not exists (select 1 from public.properties property where property.id = v_property_id) then
    raise exception 'Unknown property %', v_property_id;
  end if;

  v_requested_status := case
    when coalesce(v_valuation ->> 'confidence', 'INSUFFICIENT') = 'INSUFFICIENT'
      then 'INSUFFICIENT_DATA'
    else 'COMPLETED'
  end;
  v_expected_count := coalesce((v_valuation ->> 'comparableCount')::integer, 0);
  v_required_source_count := case coalesce(v_valuation ->> 'evidenceTier', 'INSUFFICIENT')
    when 'STRICT_ESTIMATE' then 2
    when 'AREA_REFERENCE' then 1
    else 0
  end;

  insert into valuation.property_valuation_runs (
    property_id, status, model_version, currency,
    estimated_sale_value, sale_range_low, sale_range_high, sale_price_per_m2,
    estimated_monthly_rent, rent_range_low, rent_range_high, rent_price_per_m2,
    estimated_cap_rate, gross_rental_yield, listing_price, listing_vs_estimate_pct,
    area_reference_value, area_range_low, area_range_high, area_price_per_m2,
    area_reference_operation, area_location_basis, evidence_tier,
    confidence, confidence_score, comparable_count, sale_comparable_count,
    rent_comparable_count, data_as_of, methodology, warnings, input_snapshot,
    calculation_details, completed_at
  ) values (
    v_property_id,
    v_requested_status,
    coalesce(nullif(v_valuation ->> 'modelVersion', ''), 'towers-market-v5'),
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
    nullif(v_valuation ->> 'areaReferenceValue', '')::numeric,
    nullif(v_valuation ->> 'areaRangeLow', '')::numeric,
    nullif(v_valuation ->> 'areaRangeHigh', '')::numeric,
    nullif(v_valuation ->> 'areaPricePerM2', '')::numeric,
    nullif(v_valuation ->> 'areaReferenceOperation', ''),
    nullif(v_valuation ->> 'areaLocationBasis', ''),
    coalesce(nullif(v_valuation ->> 'evidenceTier', ''), 'INSUFFICIENT'),
    coalesce(nullif(v_valuation ->> 'confidence', ''), 'INSUFFICIENT'),
    coalesce((v_valuation ->> 'confidenceScore')::integer, 0),
    v_expected_count,
    coalesce((v_valuation ->> 'saleComparableCount')::integer, 0),
    coalesce((v_valuation ->> 'rentComparableCount')::integer, 0),
    coalesce(nullif(v_valuation ->> 'dataAsOf', '')::timestamptz, now()),
    coalesce(nullif(v_valuation ->> 'methodology', ''), 'Towers Market v5'),
    coalesce(array(select jsonb_array_elements_text(v_valuation -> 'warnings')), '{}'::text[]),
    jsonb_build_object('propertyId', v_property_id, 'source', 'market-observations', 'generatedAt', now()),
    jsonb_build_object(
      'sourceCodes', coalesce(p_payload -> 'sourceCodes', '[]'::jsonb),
      'evidenceTier', coalesce(v_valuation ->> 'evidenceTier', 'INSUFFICIENT'),
      'privateComparables', true
    ),
    case when v_requested_status = 'COMPLETED' then now() else null end
  ) returning id, status into v_run_id, v_actual_status;

  if v_actual_status = 'COMPLETED' and jsonb_typeof(v_valuation -> 'comparables') = 'array' then
    with comparable_rows as (
      select comparable, ordinality::integer as rank
      from jsonb_array_elements(v_valuation -> 'comparables') with ordinality as rows(comparable, ordinality)
    )
    insert into valuation.property_valuation_comparables (
      valuation_run_id, market_observation_id, comparable_property_id, operation,
      comparable_title, comparable_location, price_amount, currency, surface_m2,
      price_per_m2, distance_meters, weight, rank, adjustments
    )
    select
      v_run_id,
      case when coalesce(comparable ->> 'marketObservationId', '') ~ '^[0-9a-fA-F-]{36}$'
        then (comparable ->> 'marketObservationId')::uuid else null end,
      case when coalesce(comparable ->> 'marketObservationId', '') = ''
          and coalesce(comparable ->> 'propertyId', '') ~ '^[0-9a-fA-F-]{36}$'
        then (comparable ->> 'propertyId')::uuid else null end,
      comparable ->> 'operation',
      case when coalesce(comparable ->> 'marketObservationId', '') <> ''
        then 'Comparable externo anonimizado'
        else left(coalesce(comparable ->> 'title', 'Comparable interno'), 240) end,
      case when coalesce(comparable ->> 'marketObservationId', '') <> ''
        then 'Micromercado coincidente'
        else left(coalesce(comparable ->> 'location', 'Ubicación protegida'), 240) end,
      (comparable ->> 'price')::numeric,
      coalesce(nullif(comparable ->> 'currency', ''), 'MXN'),
      (comparable ->> 'surfaceM2')::numeric,
      (comparable ->> 'pricePerM2')::numeric,
      case when jsonb_typeof(comparable -> 'distanceMeters') = 'number'
        then greatest(0, (comparable ->> 'distanceMeters')::integer) else null end,
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
      );

    select
      count(*)::integer,
      count(distinct nullif(adjustments ->> 'sourceCode', ''))::integer
    into v_comparable_count, v_source_count
    from valuation.property_valuation_comparables
    where valuation_run_id = v_run_id;

    if v_comparable_count <> v_expected_count or v_source_count < v_required_source_count then
      update valuation.property_valuation_runs
      set status = 'INSUFFICIENT_DATA',
          warnings = array_append(
            warnings,
            'Los comparables persistidos no coinciden con la muestra validada o sus fuentes.'
          )
      where id = v_run_id
      returning status into v_actual_status;
      delete from valuation.property_valuation_comparables where valuation_run_id = v_run_id;
      v_comparable_count := 0;
    end if;
  end if;

  return jsonb_build_object(
    'runId', v_run_id,
    'status', v_actual_status,
    'comparablesSaved', v_comparable_count,
    'sourcesSaved', v_source_count
  );
end;
$$;

drop view if exists public.public_property_valuations_view;
create view public.public_property_valuations_view
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
  run.area_reference_value,
  run.area_range_low,
  run.area_range_high,
  run.area_price_per_m2,
  run.area_reference_operation,
  run.area_location_basis,
  run.evidence_tier,
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
      when comparable.market_observation_id is null then 'Inventario verificado de Towers México'
      else coalesce(source.name, 'Fuente pública de mercado')
    end)
    from valuation.property_valuation_comparables comparable
    left join valuation.market_observations observation on observation.id = comparable.market_observation_id
    left join valuation.sources source on source.id = observation.source_id
    where comparable.valuation_run_id = run.id
  ), '{}'::text[]) as source_labels
from valuation.property_valuation_runs run
join public.properties property on property.id = run.property_id
join lateral (
  select
    count(*)::integer as comparable_count,
    count(distinct nullif(saved.adjustments ->> 'sourceCode', ''))::integer as source_count
  from valuation.property_valuation_comparables saved
  where saved.valuation_run_id = run.id
) persisted on true
where run.status = 'COMPLETED'
  and run.model_version = 'towers-market-v5'
  and property.is_published = true
  and property.folder_status = 'PUBLISHED'
  and coalesce(property.is_demo, false) = false
  and run.comparable_count = persisted.comparable_count
  and (
    (
      run.evidence_tier = 'STRICT_ESTIMATE'
      and run.confidence in ('MEDIUM', 'HIGH')
      and run.confidence_score >= 65
      and run.comparable_count >= 8
      and persisted.source_count >= 2
      and (run.estimated_sale_value is not null or run.estimated_monthly_rent is not null)
      and run.area_reference_value is null
    )
    or
    (
      run.evidence_tier = 'AREA_REFERENCE'
      and run.confidence = 'LOW'
      and run.confidence_score between 30 and 64
      and run.comparable_count >= 3
      and persisted.source_count >= 1
      and run.area_reference_value is not null
      and run.area_range_low is not null
      and run.area_range_high is not null
      and run.area_price_per_m2 is not null
      and run.estimated_sale_value is null
      and run.estimated_monthly_rent is null
      and run.listing_vs_estimate_pct is null
      and run.estimated_cap_rate is null
      and run.gross_rental_yield is null
    )
  )
  and run.id = (
    select latest.id
    from valuation.property_valuation_runs latest
    where latest.property_id = run.property_id
    order by latest.created_at desc
    limit 1
  );

revoke all on function public.save_market_valuation_run(jsonb) from public, anon, authenticated;
grant execute on function public.save_market_valuation_run(jsonb) to service_role;
revoke all on public.public_property_valuations_view from public;
grant select on public.public_property_valuations_view to anon, authenticated;

comment on view public.public_property_valuations_view is
  'Newest Towers Market v5 result: strict estimates require eight geolocated comparables; commercial estimates require three coherent micromarket comparables and remain explicitly non-appraisal guidance.';
