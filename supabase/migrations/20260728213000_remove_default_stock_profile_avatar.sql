-- New accounts must start without a photograph. The UI derives a profile
-- avatar from the first letter of the user's name until they upload one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := nullif(btrim(new.raw_user_meta_data ->> 'name'), '');
  requested_avatar_url text := nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), '');
begin
  insert into public.profiles (id, email, name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(requested_name, 'AuraSwap Member'),
    requested_avatar_url,
    'MEMBER'
  );

  return new;
end;
$$;

-- Repair accounts created after the previous cleanup migration but before this
-- trigger fix. User-uploaded profile photographs are left untouched.
update public.profiles
set avatar_url = null
where avatar_url like '%photo-1535713875002-d1d0cf377fde%';
