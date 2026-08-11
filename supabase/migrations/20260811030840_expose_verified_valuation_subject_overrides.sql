-- Keep the valuation schema private while allowing server-side recalculation
-- to read only verified subject corrections through PostgREST.

create or replace function public.get_verified_property_subject_overrides()
returns table (
  property_id uuid,
  surface_built_m2 numeric,
  surface_total_m2 numeric,
  neighborhood text,
  city text,
  state text
)
language sql
stable
security definer
set search_path = pg_catalog, public, valuation
as $$
  select
    override.property_id,
    override.surface_built_m2,
    override.surface_total_m2,
    override.neighborhood,
    override.city,
    override.state
  from valuation.property_subject_overrides override
  where override.review_status = 'VERIFIED';
$$;

revoke all on function public.get_verified_property_subject_overrides()
  from public, anon, authenticated;
grant execute on function public.get_verified_property_subject_overrides()
  to service_role;

comment on function public.get_verified_property_subject_overrides() is
  'Service-role-only bridge for verified private valuation subject corrections.';
