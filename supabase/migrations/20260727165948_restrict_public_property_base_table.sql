drop policy if exists "Properties are public readable" on public.properties;
revoke select on public.properties from anon;
alter view public.public_properties_view set (security_invoker = false);
grant select on public.public_properties_view to anon, authenticated;;
