create or replace function public.enforce_property_publication_workflow()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_is_admin boolean := false;
begin
  if actor_id is null then
    if tg_op = 'UPDATE' then
      new.internal_code := old.internal_code;
    end if;
    return new;
  end if;

  actor_is_admin := coalesce(public.is_admin(actor_id), false);

  if tg_op = 'INSERT' then
    if not actor_is_admin then
      new.host_id := actor_id;
      new.is_published := false;
      new.folder_status := 'UNDER_REVIEW';
    elsif new.is_published then
      new.folder_status := 'PUBLISHED';
    end if;
    return new;
  end if;

  new.internal_code := old.internal_code;
  new.host_id := old.host_id;

  if not actor_is_admin then
    new.is_published := false;
    new.folder_status := 'UNDER_REVIEW';
  elsif new.is_published then
    new.folder_status := 'PUBLISHED';
  elsif new.folder_status = 'PUBLISHED' then
    new.folder_status := 'PAUSED';
  end if;

  return new;
end;
$$;

create or replace function public.protect_profile_authorization_fields()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
begin
  if actor_id is not null
     and not coalesce(public.is_admin(actor_id), false)
     and (
       new.role is distinct from old.role
       or new.kyc_status is distinct from old.kyc_status
       or new.is_verified is distinct from old.is_verified
     ) then
    raise exception 'Only an administrator can change profile authorization fields';
  end if;

  return new;
end;
$$;;
