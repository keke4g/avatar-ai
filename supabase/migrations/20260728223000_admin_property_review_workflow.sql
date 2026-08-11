-- Explicit admin inventory review access and atomic publication approval.

grant select, update on table public.properties to authenticated;
grant select, update on table public.property_offerings to authenticated;
grant select on table public.property_media to authenticated;

drop policy if exists "Administrators can review all properties" on public.properties;
create policy "Administrators can review all properties"
on public.properties
for select
to authenticated
using (coalesce(public.is_admin((select auth.uid())), false));

drop policy if exists "Administrators can moderate all properties" on public.properties;
create policy "Administrators can moderate all properties"
on public.properties
for update
to authenticated
using (coalesce(public.is_admin((select auth.uid())), false))
with check (coalesce(public.is_admin((select auth.uid())), false));

drop policy if exists "Administrators can review all property offerings" on public.property_offerings;
create policy "Administrators can review all property offerings"
on public.property_offerings
for select
to authenticated
using (coalesce(public.is_admin((select auth.uid())), false));

drop policy if exists "Administrators can moderate all property offerings" on public.property_offerings;
create policy "Administrators can moderate all property offerings"
on public.property_offerings
for update
to authenticated
using (coalesce(public.is_admin((select auth.uid())), false))
with check (coalesce(public.is_admin((select auth.uid())), false));

drop policy if exists "Administrators can review all property media" on public.property_media;
create policy "Administrators can review all property media"
on public.property_media
for select
to authenticated
using (coalesce(public.is_admin((select auth.uid())), false));

create or replace function public.approve_property_publication(target_property_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not coalesce(public.is_admin((select auth.uid())), false) then
    raise exception 'Only an administrator can approve a property';
  end if;

  if not exists (
    select 1
    from public.properties
    where id = target_property_id
      and folder_status = 'UNDER_REVIEW'
      and is_published = false
  ) then
    raise exception 'The property is not awaiting review';
  end if;

  update public.property_offerings
  set status = 'ACTIVE'::public.property_offering_status,
      visibility = 'PUBLIC'::public.property_offering_visibility,
      updated_at = now()
  where property_id = target_property_id;

  update public.properties
  set is_published = true,
      folder_status = 'PUBLISHED',
      updated_at = now()
  where id = target_property_id;
end;
$$;

revoke all on function public.approve_property_publication(uuid) from public;
grant execute on function public.approve_property_publication(uuid) to authenticated;
