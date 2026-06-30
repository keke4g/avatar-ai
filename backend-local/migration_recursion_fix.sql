-- MIGRATION SCRIPT TO FIX INFINITE RECURSION (ERROR 42P17)
-- Execute this script inside the Supabase SQL editor to drop the offending policies,
-- install the security definer function, and restore RLS policies safely.

-- 1. DROP ALL OFFENDING ADMIN POLICIES
drop policy if exists "Admins have total control on profiles" on public.profiles;
drop policy if exists "Admins have total control on properties" on public.properties;
drop policy if exists "Admins have total control on property images" on public.property_images;
drop policy if exists "Admins have total control on favorites" on public.favorites;
drop policy if exists "Admins have total control on swaps" on public.swaps;
drop policy if exists "Admins have total control on messages" on public.messages;
drop policy if exists "Admins have total control on reviews" on public.reviews;
drop policy if exists "Admins have total control on disputes" on public.disputes;
drop policy if exists "Admins have total control on notifications" on public.notifications;

-- 2. CREATE SECURITY DEFINER HELPER FUNCTION TO BYPASS RLS RECURSION
create or replace function public.is_admin(user_id uuid)
returns boolean as $$
declare
  user_role text;
begin
  select role into user_role from public.profiles where id = user_id;
  return user_role = 'ADMIN';
end;
$$ language plpgsql security definer set search_path = public;

-- 3. RECREATE SAFE ADMIN POLICIES USING THE HELPER FUNCTION
create policy "Admins have total control on profiles" on public.profiles for all using (
  public.is_admin(auth.uid())
);

create policy "Admins have total control on properties" on public.properties for all using (
  public.is_admin(auth.uid())
);

create policy "Admins have total control on property images" on public.property_images for all using (
  public.is_admin(auth.uid())
);

create policy "Admins have total control on favorites" on public.favorites for all using (
  public.is_admin(auth.uid())
);

create policy "Admins have total control on swaps" on public.swaps for all using (
  public.is_admin(auth.uid())
);

create policy "Admins have total control on messages" on public.messages for all using (
  public.is_admin(auth.uid())
);

create policy "Admins have total control on reviews" on public.reviews for all using (
  public.is_admin(auth.uid())
);

create policy "Admins have total control on disputes" on public.disputes for all using (
  public.is_admin(auth.uid())
);

create policy "Admins have total control on notifications" on public.notifications for all using (
  public.is_admin(auth.uid())
);
