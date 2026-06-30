-- DIAGNOSTIC SQL QUERIES FOR SUPABASE RLS INSPECTION
-- Paste and run these queries inside your Supabase SQL editor to inspect the active
-- policies, definitions, and functions, identifying which policy still has recursive checks.

-- =========================================================================
-- QUERY 1: LIST ALL ACTIVE POLICIES ON THE "profiles" TABLE WITH THEIR EXPRESSIONS
-- =========================================================================
SELECT 
  policyname AS policy_name,
  cmd AS operation,
  roles AS target_roles,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'profiles';


-- =========================================================================
-- QUERY 2: LIST ALL ACTIVE RLS POLICIES FOR ALL TABLES IN the "public" SCHEMA
-- =========================================================================
SELECT 
  tablename AS table_name,
  policyname AS policy_name,
  cmd AS operation,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- =========================================================================
-- QUERY 3: DETAIL ACTIVE "is_admin" OR ROLE-BASED FUNCTIONS AND THEIR PRIVILEGES
-- =========================================================================
SELECT 
  p.proname AS function_name,
  p.prosecdef AS is_security_definer,
  pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname IN ('is_admin', 'get_user_role', 'handle_new_user');
