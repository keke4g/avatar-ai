-- migration_offerings_rls_fix.sql
-- 1. Drop the existing subquery-based RLS policies on public.property_offerings
DROP POLICY IF EXISTS "Hosts can view their property offerings" ON public.property_offerings;
DROP POLICY IF EXISTS "Hosts can create their property offerings" ON public.property_offerings;
DROP POLICY IF EXISTS "Hosts can update their property offerings" ON public.property_offerings;
DROP POLICY IF EXISTS "Hosts can delete their property offerings" ON public.property_offerings;

-- 2. Recreate them using a secure EXISTS relationship validation
-- This prevents any cardinality errors, resolves query scoping, and guarantees
-- that only the authenticated user matching the parent property's host_id can manage these offerings.

CREATE POLICY "Hosts can view their property offerings"
  ON public.property_offerings FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE properties.id = property_offerings.property_id
      AND properties.host_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can create their property offerings"
  ON public.property_offerings FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE properties.id = property_offerings.property_id
      AND properties.host_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can update their property offerings"
  ON public.property_offerings FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE properties.id = property_offerings.property_id
      AND properties.host_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE properties.id = property_offerings.property_id
      AND properties.host_id = auth.uid()
    )
  );

CREATE POLICY "Hosts can delete their property offerings"
  ON public.property_offerings FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.properties
      WHERE properties.id = property_offerings.property_id
      AND properties.host_id = auth.uid()
    )
  );
