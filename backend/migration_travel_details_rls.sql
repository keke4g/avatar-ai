-- =========================================================================
-- AuraSwap SQL Migration — FASE 4G.2: Travel Details RLS Refinements
-- =========================================================================
-- Execute this script inside the Supabase SQL Editor to apply strict,
-- recursion-free policies for the swap_travel_details table.
-- =========================================================================

-- 1. Asegurar que la seguridad RLS está habilitada
ALTER TABLE public.swap_travel_details ENABLE ROW LEVEL SECURITY;

-- 2. Eliminar políticas anteriores para evitar colisiones de nombres
DROP POLICY IF EXISTS "Secure access to swap travel details" ON public.swap_travel_details;
DROP POLICY IF EXISTS "Hosts can manage swap travel details" ON public.swap_travel_details;
DROP POLICY IF EXISTS "Secure select access for participants and admins" ON public.swap_travel_details;
DROP POLICY IF EXISTS "Hosts and admins can manage travel details" ON public.swap_travel_details;

-- 3. Crear política para SELECT (Permite a: Viajero, Host propietario de la propiedad, y Administradores)
CREATE POLICY "Secure select access for participants and admins" 
  ON public.swap_travel_details
  FOR SELECT 
  USING (
    auth.uid() = traveler_id 
    OR 
    auth.uid() = (SELECT host_id FROM public.properties WHERE id = property_id)
    OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
  );

-- 4. Crear política para ALL (Insert/Update/Delete) (Permite a: Host propietario y Administradores)
CREATE POLICY "Hosts and admins can manage travel details" 
  ON public.swap_travel_details
  FOR ALL 
  USING (
    auth.uid() = (SELECT host_id FROM public.properties WHERE id = property_id)
    OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'ADMIN'
  );

COMMENT ON TABLE public.swap_travel_details IS 'Secure logistics table recording check-in credentials per swap traveler with strict participant and admin RLS rules';
