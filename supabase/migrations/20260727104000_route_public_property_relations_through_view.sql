drop policy if exists "Select policy for property media" on public.property_media;

create policy "Public can view media for published properties"
on public.property_media
for select
to anon
using (
  exists (
    select 1
    from public.public_properties_view published
    where published.id = property_media.property_id
  )
);

create policy "Members can view accessible property media"
on public.property_media
for select
to authenticated
using (
  exists (
    select 1
    from public.public_properties_view published
    where published.id = property_media.property_id
  )
  or exists (
    select 1
    from public.properties owned
    where owned.id = property_media.property_id
      and (owned.host_id = (select auth.uid()) or public.is_admin((select auth.uid())))
  )
);

drop policy if exists "Public can view active public property offerings" on public.property_offerings;

create policy "Public can view active published property offerings"
on public.property_offerings
for select
to anon, authenticated
using (
  status = 'ACTIVE'::public.property_offering_status
  and visibility = 'PUBLIC'::public.property_offering_visibility
  and exists (
    select 1
    from public.public_properties_view published
    where published.id = property_offerings.property_id
  )
);
