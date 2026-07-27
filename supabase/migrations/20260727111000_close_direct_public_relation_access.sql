-- Public clients use the curated relation views above. Direct base-relation
-- reads remain unavailable; owner/admin policies are preserved.
drop policy if exists "Public can view media for published properties"
on public.property_media;

drop policy if exists "Public can view active published property offerings"
on public.property_offerings;
