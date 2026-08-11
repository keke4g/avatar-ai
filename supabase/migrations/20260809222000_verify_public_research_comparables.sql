do $$
declare
  v_propiedades_montebello integer;
  v_inmuebles_montebello integer;
  v_inmuebles_lomas integer;
  v_forbidden_payloads integer;
begin
  select count(distinct observation.external_reference)
  into v_propiedades_montebello
  from valuation.market_observations observation
  join valuation.sources source on source.id = observation.source_id
  where source.source_code = 'propiedades-com'
    and source.is_active = true
    and source.metadata ->> 'usageAuthorization' = 'RESEARCH_ONLY'
    and observation.listing_status = 'ACTIVE'
    and lower(observation.neighborhood) = lower('Montebello');

  select count(distinct observation.external_reference)
  into v_inmuebles_montebello
  from valuation.market_observations observation
  join valuation.sources source on source.id = observation.source_id
  where source.source_code = 'inmuebles24'
    and source.is_active = true
    and source.metadata ->> 'usageAuthorization' = 'RESEARCH_ONLY'
    and observation.listing_status = 'ACTIVE'
    and lower(observation.neighborhood) = lower('Montebello');

  select count(distinct observation.external_reference)
  into v_inmuebles_lomas
  from valuation.market_observations observation
  join valuation.sources source on source.id = observation.source_id
  where source.source_code = 'inmuebles24'
    and source.is_active = true
    and source.metadata ->> 'usageAuthorization' = 'RESEARCH_ONLY'
    and observation.listing_status = 'ACTIVE'
    and lower(observation.neighborhood) = lower('Lomas de Angelópolis')
    and observation.source_url not like '%/propiedades/desarrollo/%';

  select count(*)
  into v_forbidden_payloads
  from valuation.market_observations observation
  join valuation.sources source on source.id = observation.source_id
  where source.source_code in ('propiedades-com', 'inmuebles24', 'mercadolibre-inmuebles')
    and observation.attributes ?| array[
      'phone', 'email', 'fullDescription', 'description', 'photos', 'images', 'contact'
    ];

  if v_propiedades_montebello < 25 then
    raise exception 'Expected at least 25 Propiedades.com Montebello research observations; found %', v_propiedades_montebello;
  end if;
  if v_inmuebles_montebello < 3 then
    raise exception 'Expected at least 3 Inmuebles24 Montebello research observations; found %', v_inmuebles_montebello;
  end if;
  if v_inmuebles_lomas < 4 then
    raise exception 'Expected at least 4 Inmuebles24 Lomas research observations; found %', v_inmuebles_lomas;
  end if;
  if v_forbidden_payloads <> 0 then
    raise exception 'Research observations contain % forbidden rich/contact payloads', v_forbidden_payloads;
  end if;
end;
$$;
