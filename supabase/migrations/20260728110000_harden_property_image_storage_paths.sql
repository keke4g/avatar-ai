-- Require every new property image to live below the authenticated user's
-- namespace. Existing published objects remain readable for compatibility.

drop policy if exists "Authenticated insert property images" on storage.objects;
create policy "Authenticated insert property images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'property-images'
  and owner = (select auth.uid())
  and name like (select auth.uid())::text || '/%'
);

drop policy if exists "Owner modify property images" on storage.objects;
create policy "Owner modify property images"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'property-images'
  and (
    (
      owner = (select auth.uid())
      and name like (select auth.uid())::text || '/%'
    )
    or public.is_admin((select auth.uid()))
  )
)
with check (
  bucket_id = 'property-images'
  and (
    (
      owner = (select auth.uid())
      and name like (select auth.uid())::text || '/%'
    )
    or public.is_admin((select auth.uid()))
  )
);
