-- SQL DIAGNOSTIC QUERY: LIST ALL RLS POLICIES ACROSS ALL TABLES IN THE PUBLIC SCHEMA
-- Run this query inside your Supabase SQL editor to see the full set of installed policies
-- and identify any legacy recursive expressions referencing the "profiles" relation directly.

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS using_expression,
  with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
