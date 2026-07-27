-- Internal advisors are operational staff, but they are not administrators.
-- Keep admin-only moderation and role management separate from this role.
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role = any (array[
    'MEMBER'::text,
    'HOST'::text,
    'INTERNAL_ADVISOR'::text,
    'ADMIN'::text
  ]));

-- Keep the existing admin predicate strict. Internal advisors must never
-- inherit publication approval, role assignment, or destructive admin rights.
create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = user_id
      and profile.role = 'ADMIN'
  );
$$;

revoke execute on function public.is_admin(uuid)
from public, anon;

grant execute on function public.is_admin(uuid)
to authenticated, service_role;

-- A user may edit their public profile, but authorization and verification
-- fields can only be changed by an administrator (or trusted server-side SQL).
create or replace function public.protect_profile_access_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
begin
  if new.role is distinct from old.role
     or new.kyc_status is distinct from old.kyc_status
     or new.is_verified is distinct from old.is_verified then
    if actor_id is not null and not public.is_admin(actor_id) then
      raise insufficient_privilege
        using message = 'Only administrators can change access or verification fields.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_access_fields
on public.profiles;

create trigger protect_profile_access_fields
before update of role, kyc_status, is_verified
on public.profiles
for each row
execute function public.protect_profile_access_fields();

revoke execute on function public.protect_profile_access_fields()
from public, anon, authenticated;

-- Minimal staff-only payload for the property operations panel. It deliberately
-- excludes owner contact details and does not widen base-table RLS policies.
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
      coalesce(offering.price_amount, offering.swap_estimated_value),
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
