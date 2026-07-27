create or replace function public.get_internal_property_marketplace_dossier(
  target_property_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_role text;
  dossier jsonb;
begin
  select profile.role
    into actor_role
  from public.profiles profile
  where profile.id = actor_id;

  if actor_id is null
     or actor_role is null
     or actor_role not in ('ADMIN', 'INTERNAL_ADVISOR') then
    raise insufficient_privilege
      using message = 'Internal property dossier access denied.';
  end if;

  select jsonb_build_object(
    'property_id', property.id,
    'captured_price_amount',
      coalesce(
        offering.price_amount,
        offering.swap_max_value,
        offering.swap_min_value
      ),
    'currency', coalesce(offering.currency, 'MXN'),
    'commission_total_pct', offering.commission_total_pct,
    'commission_shared_pct', offering.commission_shared_pct,
    'operation_mode', offering.mode::text,
    'exact_address',
      coalesce(
        nullif(btrim(concat_ws(
          ', ',
          nullif(btrim(property.address), ''),
          nullif(btrim(property.neighborhood), ''),
          nullif(btrim(property.location), ''),
          nullif(btrim(property.country), '')
        )), ''),
        property.location
      )
  )
    into dossier
  from public.properties property
  left join lateral (
    select candidate.*
    from public.property_offerings candidate
    where candidate.property_id = property.id
      and candidate.status = 'ACTIVE'::public.property_offering_status
    order by
      case candidate.mode
        when 'SALE'::public.property_offering_mode then 1
        when 'MONTHLY_RENT'::public.property_offering_mode then 2
        when 'SHORT_RENT'::public.property_offering_mode then 3
        when 'SWAP'::public.property_offering_mode then 4
        else 5
      end,
      candidate.updated_at desc nulls last
    limit 1
  ) offering on true
  where property.id = target_property_id;

  return dossier;
end;
$$;

revoke execute on function public.get_internal_property_marketplace_dossier(uuid)
from public, anon;

grant execute on function public.get_internal_property_marketplace_dossier(uuid)
to authenticated;;
