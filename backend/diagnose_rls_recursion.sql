-- =========================================================================
-- DIAGNOSTIC AND MIGRATION SCRIPT FOR SUPABASE RLS FORCE RECURSION AUDIT
-- Run this script inside your Supabase SQL editor to see the exact statuses
-- of your RLS and apply the definitive "NO FORCE ROW LEVEL SECURITY" fix.
-- =========================================================================

-- QUERY 1: VERIFY ROW-LEVEL SECURITY AND FORCE-RLS STATUS FOR "profiles" TABLE
-- Look closely at the "is_force_rls" column. If true, RLS is evaluated even for the owner!
SELECT 
  c.relname AS table_name,
  c.relrowsecurity AS is_rls_enabled,
  c.relforcersec AS is_force_rls
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' 
  AND c.relname = 'profiles';


-- QUERY 2: CHECK THE CREATOR / OWNER OF THE "is_admin" FUNCTION AND DEFINER SETTINGS
-- It must show "postgres" or a superuser role as the owner.
SELECT 
  p.proname AS function_name,
  r.rolname AS function_owner,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_roles r ON p.proowner = r.oid
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'is_admin';


-- QUERY 3: TEST THE IS_ADMIN FUNCTION DIRECTLY IN THE CONSOLE
-- If it executes without error, the recursion inside the function is clear.
-- Replace auth.uid() with a dummy UUID for the test.
SELECT public.is_admin('00000000-0000-0000-0000-000000000000'::uuid) AS is_dummy_admin;


-- QUERY 4: DIRECT SELECTION FROM PROFILES IN CONSOLE
SELECT * FROM public.profiles LIMIT 1;


-- =========================================================================
-- DEFINITIVE FIX MIGRATION: DISABLE FORCE RLS ON PROFILES
-- =========================================================================
-- If "relforcersec" was true, this command instantly disables RLS evaluation for
-- the table owner / postgres role, allowing the SECURITY DEFINER function to
-- query "profiles" without triggering RLS policies and completely fixing 42P17!

ALTER TABLE public.profiles NO FORCE ROW LEVEL SECURITY;

-- Re-verify RLS Status after applying the fix:
SELECT 
  c.relname AS table_name,
  c.relrowsecurity AS is_rls_enabled,
  c.relforcersec AS is_force_rls
FROM pg_class c
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' 
  AND c.relname = 'profiles';
