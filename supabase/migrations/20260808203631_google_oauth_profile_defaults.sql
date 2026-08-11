-- Keep password and Google registrations on the same profile lifecycle.
-- Google commonly provides both `name` and `full_name`; neither value is used
-- for authorization. Profile photographs remain opt-in so the interface uses
-- the user's initial until they explicitly upload one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Miembro Towers México'
  );
begin
  insert into public.profiles (id, email, name, avatar_url, role)
  values (
    new.id,
    new.email,
    requested_name,
    null,
    'MEMBER'
  );

  return new;
end;
$$;

-- The function is a trigger implementation, not a public RPC endpoint.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
