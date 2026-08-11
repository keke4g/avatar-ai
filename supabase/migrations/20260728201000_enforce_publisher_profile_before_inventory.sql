-- Activate only after the publisher onboarding interface is deployed.
-- Administrators and trusted server-side imports keep their existing path.

create or replace function public.require_publisher_profile_before_property_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is null or public.is_admin(actor_id) then
    return new;
  end if;

  if not exists (
    select 1
    from public.publisher_profiles publisher
    where publisher.user_id = actor_id
      and publisher.completed_at is not null
  ) then
    raise insufficient_privilege
      using message = 'Complete the one-time publisher contact verification before creating a property.';
  end if;

  return new;
end;
$$;

drop trigger if exists aa_require_publisher_profile_before_property_insert
  on public.properties;
create trigger aa_require_publisher_profile_before_property_insert
before insert on public.properties
for each row execute function public.require_publisher_profile_before_property_insert();
