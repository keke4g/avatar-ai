-- =========================================================================
-- SURGICAL MIGRATION TO RESOLVE PROFILES RLS RECURSION (ERROR 42P17)
-- =========================================================================
--
-- ANALYSIS OF THE RECURSION CAUSE:
-- Even with SECURITY DEFINER, if a policy for "ALL" exists on public.profiles
-- that calls public.is_admin(auth.uid()), PostgreSQL evaluates this policy 
-- for SELECT queries. When is_admin() executes its internal SELECT on profiles,
-- it triggers the SELECT policy checks on profiles, which evaluates is_admin(),
-- leading to infinite recursion.
--
-- THE SOLUTION:
-- 1. Everyone can already read profiles via the "Profiles are public readable" (FOR SELECT) policy.
-- 2. Admins do NOT need a policy for SELECT on profiles.
-- 3. We split the admin "ALL" policy on profiles into explicit write-only actions (UPDATE, DELETE).
--    Since these policies do NOT apply to SELECT commands, is_admin()'s internal SELECT will
--    only evaluate the SELECT policy (true) and will NEVER recurse!

-- -------------------------------------------------------------------------
-- PART 1: APPLY DEFINITIVE SURGICAL FIX
-- -------------------------------------------------------------------------

-- A. Drop the recursive ALL policy on profiles
DROP POLICY IF EXISTS "Admins have total control on profiles" ON public.profiles;

-- B. Create specific non-recursive write policies for Admins
CREATE POLICY "Admins can update profiles" ON public.profiles 
  FOR UPDATE USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete profiles" ON public.profiles 
  FOR DELETE USING (public.is_admin(auth.uid()));

-- C. Check if we have standard policies restored
-- "Profiles are public readable" must be: FOR SELECT USING (true)
-- "Owners can update their profiles" must be: FOR UPDATE USING (auth.uid() = id)


-- -------------------------------------------------------------------------
-- PART 2: DIAGNOSTIC QUERIES FOR ROLE & PRIVILEGE VERIFICATION
-- -------------------------------------------------------------------------

-- QUERY 1: Check active policies on public.profiles after fix
SELECT 
  policyname AS policy_name,
  cmd AS operation,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles';

-- QUERY 2: Real Owner of the public.is_admin() function
SELECT 
  p.proname AS function_name,
  r.rolname AS function_owner,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_roles r ON p.proowner = r.oid
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'is_admin';

-- QUERY 3: Full execution privileges of public.is_admin()
SELECT 
  p.proname,
  pg_catalog.pg_get_userbyid(p.proowner) as owner,
  pg_catalog.array_to_string(p.proacl, E'\n') as privileges
FROM pg_catalog.pg_proc p
JOIN pg_catalog.pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' AND p.proname = 'is_admin';

-- QUERY 4: Direct query test on is_admin (does not recurse anymore!)
SELECT public.is_admin(auth.uid()) AS is_admin_check_test;

-- QUERY 5: Direct query test on profiles select (does not recurse anymore!)
SELECT * FROM public.profiles LIMIT 1;
