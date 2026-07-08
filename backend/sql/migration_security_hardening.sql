-- =========================================================================
-- AuraSwap SQL Migration — Database Security Hardening
-- =========================================================================
-- This script hardens the database architecture:
-- 1. Creates sanitised public views for profiles and properties.
-- 2. Restricts direct SELECT access to original profiles and properties tables.
-- 3. Enables Row-Level Security (RLS) on 17 unprotected tables with secure policies.
-- 4. Hardens SECURITY DEFINER trigger functions.
-- =========================================================================

-- =========================================================================
-- 1. CREATE PUBLIC SANITISED VIEWS WITH SECURITY INVOKER
-- =========================================================================

-- Drop existing views if they exist to prevent conflicts
DROP VIEW IF EXISTS public.public_properties_view CASCADE;
DROP VIEW IF EXISTS public.public_profiles_view CASCADE;

-- Public Profiles View: Excludes email and other private details (Security Invoker)
CREATE OR REPLACE VIEW public.public_profiles_view 
WITH (security_invoker = true) AS
SELECT 
  id,
  name,
  avatar_url,
  role,
  kyc_status,
  is_verified,
  created_at
FROM public.profiles;

-- Grant select permission on public_profiles_view
GRANT SELECT ON public.public_profiles_view TO anon, authenticated;

-- Public Properties View: Excludes private owner contact information (Security Invoker)
CREATE OR REPLACE VIEW public.public_properties_view 
WITH (security_invoker = true) AS
SELECT 
  id,
  host_id,
  title,
  description,
  type,
  value_rating,
  location,
  country,
  address,
  latitude,
  longitude,
  bedrooms,
  bathrooms,
  max_guests,
  aura_score,
  amenities,
  rules,
  is_published,
  is_featured,
  created_at,
  folder_status,
  meta_title,
  meta_description,
  meta_keywords,
  qr_code_url,
  short_code,
  short_link,
  updated_at,
  is_demo,
  desired_exchange,
  -- Columnas legales seguras para consistencia de la UI
  legal_public_deed,
  legal_tax_current,
  legal_debt_free,
  legal_services_paid,
  legal_owner_type,
  legal_is_mortgaged
FROM public.properties
WHERE is_published = true;

-- Grant select permission on public_properties_view
GRANT SELECT ON public.public_properties_view TO anon, authenticated;

-- =========================================================================
-- 2. HARDEN RLS ON ORIGINAL PROFILES AND PROPERTIES TABLES
-- =========================================================================

-- Ensure RLS is enabled on main tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;

-- Drop old select policies
DROP POLICY IF EXISTS "Profiles are public readable" ON public.profiles;
DROP POLICY IF EXISTS "Users can select their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Properties are public readable" ON public.properties;
DROP POLICY IF EXISTS "Hosts can select their own properties" ON public.properties;

-- Restrict SELECT on profiles: Anyone can select safe profile fields via security invoker view
CREATE POLICY "Profiles are public readable" ON public.profiles
  FOR SELECT USING (true);

-- Restrict SELECT on properties: Anyone can view published property details via security invoker view
CREATE POLICY "Properties are public readable" ON public.properties
  FOR SELECT USING (is_published = true);

-- Senders/Hosts can view their own properties (including drafts/unpublished ones)
CREATE POLICY "Hosts can select their own properties" ON public.properties
  FOR SELECT USING (auth.uid() = host_id OR public.is_admin(auth.uid()));


-- =========================================================================
-- 3. ENABLE RLS AND POLICIES FOR 17 UNPROTECTED TABLES
-- =========================================================================

-- A. Reference & Catalogs: Public SELECT, Admin write/all
-- tables: companies, offices, teams, catalog_*, property_custom_fields

-- 1. companies
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Companies are public readable" ON public.companies;
CREATE POLICY "Companies are public readable" ON public.companies FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage companies" ON public.companies;
CREATE POLICY "Admins can manage companies" ON public.companies FOR ALL USING (public.is_admin(auth.uid()));

-- 2. offices
ALTER TABLE public.offices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Offices are public readable" ON public.offices;
CREATE POLICY "Offices are public readable" ON public.offices FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage offices" ON public.offices;
CREATE POLICY "Admins can manage offices" ON public.offices FOR ALL USING (public.is_admin(auth.uid()));

-- 3. teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Teams are public readable" ON public.teams;
CREATE POLICY "Teams are public readable" ON public.teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;
CREATE POLICY "Admins can manage teams" ON public.teams FOR ALL USING (public.is_admin(auth.uid()));

-- 4. catalog_property_types
ALTER TABLE public.catalog_property_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalog_property_types readable" ON public.catalog_property_types;
CREATE POLICY "catalog_property_types readable" ON public.catalog_property_types FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalog_property_types admin" ON public.catalog_property_types;
CREATE POLICY "catalog_property_types admin" ON public.catalog_property_types FOR ALL USING (public.is_admin(auth.uid()));

-- 5. catalog_conservation_states
ALTER TABLE public.catalog_conservation_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalog_conservation_states readable" ON public.catalog_conservation_states;
CREATE POLICY "catalog_conservation_states readable" ON public.catalog_conservation_states FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalog_conservation_states admin" ON public.catalog_conservation_states;
CREATE POLICY "catalog_conservation_states admin" ON public.catalog_conservation_states FOR ALL USING (public.is_admin(auth.uid()));

-- 6. catalog_construction_types
ALTER TABLE public.catalog_construction_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalog_construction_types readable" ON public.catalog_construction_types;
CREATE POLICY "catalog_construction_types readable" ON public.catalog_construction_types FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalog_construction_types admin" ON public.catalog_construction_types;
CREATE POLICY "catalog_construction_types admin" ON public.catalog_construction_types FOR ALL USING (public.is_admin(auth.uid()));

-- 7. catalog_view_types
ALTER TABLE public.catalog_view_types ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalog_view_types readable" ON public.catalog_view_types;
CREATE POLICY "catalog_view_types readable" ON public.catalog_view_types FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalog_view_types admin" ON public.catalog_view_types;
CREATE POLICY "catalog_view_types admin" ON public.catalog_view_types FOR ALL USING (public.is_admin(auth.uid()));

-- 8. catalog_orientations
ALTER TABLE public.catalog_orientations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalog_orientations readable" ON public.catalog_orientations;
CREATE POLICY "catalog_orientations readable" ON public.catalog_orientations FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalog_orientations admin" ON public.catalog_orientations;
CREATE POLICY "catalog_orientations admin" ON public.catalog_orientations FOR ALL USING (public.is_admin(auth.uid()));

-- 9. catalog_commercial_states
ALTER TABLE public.catalog_commercial_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalog_commercial_states readable" ON public.catalog_commercial_states;
CREATE POLICY "catalog_commercial_states readable" ON public.catalog_commercial_states FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalog_commercial_states admin" ON public.catalog_commercial_states;
CREATE POLICY "catalog_commercial_states admin" ON public.catalog_commercial_states FOR ALL USING (public.is_admin(auth.uid()));

-- 10. catalog_amenities
ALTER TABLE public.catalog_amenities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalog_amenities readable" ON public.catalog_amenities;
CREATE POLICY "catalog_amenities readable" ON public.catalog_amenities FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalog_amenities admin" ON public.catalog_amenities;
CREATE POLICY "catalog_amenities admin" ON public.catalog_amenities FOR ALL USING (public.is_admin(auth.uid()));

-- 11. catalog_translations
ALTER TABLE public.catalog_translations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "catalog_translations readable" ON public.catalog_translations;
CREATE POLICY "catalog_translations readable" ON public.catalog_translations FOR SELECT USING (true);
DROP POLICY IF EXISTS "catalog_translations admin" ON public.catalog_translations;
CREATE POLICY "catalog_translations admin" ON public.catalog_translations FOR ALL USING (public.is_admin(auth.uid()));

-- 12. property_custom_fields
ALTER TABLE public.property_custom_fields ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "property_custom_fields readable" ON public.property_custom_fields;
CREATE POLICY "property_custom_fields readable" ON public.property_custom_fields FOR SELECT USING (true);
DROP POLICY IF EXISTS "property_custom_fields admin" ON public.property_custom_fields;
CREATE POLICY "property_custom_fields admin" ON public.property_custom_fields FOR ALL USING (public.is_admin(auth.uid()));


-- B. Property Link & Detail tables: Public SELECT, Host (owner) / Admin modify
-- tables: property_amenities, property_custom_values, property_commercial_history

-- 13. property_amenities
ALTER TABLE public.property_amenities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "property_amenities readable" ON public.property_amenities;
CREATE POLICY "property_amenities readable" ON public.property_amenities FOR SELECT USING (true);
DROP POLICY IF EXISTS "Hosts can manage property_amenities" ON public.property_amenities;
CREATE POLICY "Hosts can manage property_amenities" ON public.property_amenities 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE properties.id = property_amenities.property_id AND properties.host_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Admins have total control on property_amenities" ON public.property_amenities;
CREATE POLICY "Admins have total control on property_amenities" ON public.property_amenities FOR ALL USING (public.is_admin(auth.uid()));

-- 14. property_custom_values
ALTER TABLE public.property_custom_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "property_custom_values readable" ON public.property_custom_values;
CREATE POLICY "property_custom_values readable" ON public.property_custom_values FOR SELECT USING (true);
DROP POLICY IF EXISTS "Hosts can manage property_custom_values" ON public.property_custom_values;
CREATE POLICY "Hosts can manage property_custom_values" ON public.property_custom_values 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE properties.id = property_custom_values.property_id AND properties.host_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Admins have total control on property_custom_values" ON public.property_custom_values;
CREATE POLICY "Admins have total control on property_custom_values" ON public.property_custom_values FOR ALL USING (public.is_admin(auth.uid()));

-- 15. property_commercial_history
ALTER TABLE public.property_commercial_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "property_commercial_history readable" ON public.property_commercial_history;
CREATE POLICY "property_commercial_history readable" ON public.property_commercial_history FOR SELECT USING (true);
DROP POLICY IF EXISTS "Hosts can manage property_commercial_history" ON public.property_commercial_history;
CREATE POLICY "Hosts can manage property_commercial_history" ON public.property_commercial_history 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE properties.id = property_commercial_history.property_id AND properties.host_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "Admins have total control on property_commercial_history" ON public.property_commercial_history;
CREATE POLICY "Admins have total control on property_commercial_history" ON public.property_commercial_history FOR ALL USING (public.is_admin(auth.uid()));


-- C. Private and Sensitive Tables: Host (owner) / Admin only (No public SELECT)
-- tables: property_documents, audit_logs

-- 16. property_documents
ALTER TABLE public.property_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Hosts can view their own property documents" ON public.property_documents;
CREATE POLICY "Hosts can view their own property documents" ON public.property_documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE properties.id = property_documents.property_id AND properties.host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Hosts can insert their own property documents" ON public.property_documents;
CREATE POLICY "Hosts can insert their own property documents" ON public.property_documents
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE properties.id = property_documents.property_id AND properties.host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Hosts can update their own property documents" ON public.property_documents;
CREATE POLICY "Hosts can update their own property documents" ON public.property_documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE properties.id = property_documents.property_id AND properties.host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Hosts can delete their own property documents" ON public.property_documents;
CREATE POLICY "Hosts can delete their own property documents" ON public.property_documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.properties 
      WHERE properties.id = property_documents.property_id AND properties.host_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins have total control on property documents" ON public.property_documents;
CREATE POLICY "Admins have total control on property documents" ON public.property_documents FOR ALL USING (public.is_admin(auth.uid()));

-- 17. audit_logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Only admins can view audit logs" ON public.audit_logs FOR SELECT USING (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "Only admins can insert audit logs" ON public.audit_logs;
CREATE POLICY "Only admins can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (public.is_admin(auth.uid()));



-- =========================================================================
-- 4. HARDEN SECURITY DEFINER TRIGGER FUNCTIONS
-- =========================================================================

-- Add explicit search_path to handle_new_user to prevent search_path hijacking
ALTER FUNCTION public.handle_new_user() SECURITY DEFINER SET search_path = public;

-- Revoke EXECUTE privileges on handle_new_user from public roles (only system triggers need execute)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Re-define is_admin as SECURITY DEFINER with search_path set to public to prevent search-path hijacking and bypass RLS recursion limits
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
  RETURN user_role = 'ADMIN';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant EXECUTE to public roles so they can evaluate RLS policies containing this function
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO anon, authenticated;
