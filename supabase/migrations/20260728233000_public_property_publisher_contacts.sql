-- Public contact channels explicitly supplied during publisher onboarding.
-- The projection is intentionally scoped to live, non-demo inventory so the
-- private publisher_profiles table remains unavailable for bulk discovery.

create or replace view public.public_property_publisher_contacts_view
with (security_invoker = false)
as
select
  property.id as property_id,
  publisher.user_id,
  publisher.representative_type,
  publisher.full_name,
  publisher.organization_name,
  publisher.phone,
  publisher.whatsapp,
  publisher.contact_email,
  publisher.completed_at
from public.properties property
join public.publisher_profiles publisher
  on publisher.user_id = property.host_id
where property.is_published = true
  and property.folder_status = 'PUBLISHED'
  and coalesce(property.is_demo, false) = false
  and publisher.completed_at is not null
  and publisher.contact_consent_at is not null;

revoke all on public.public_property_publisher_contacts_view from public;
grant select on public.public_property_publisher_contacts_view to anon, authenticated;

comment on view public.public_property_publisher_contacts_view is
  'Contact channels consented to by a publisher, exposed only for their live public listings.';
