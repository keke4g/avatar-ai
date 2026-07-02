-- AuraSwap Definitive Professional Property & Offering Model Migration (v3)
-- Run this script in the Supabase SQL Editor.

-- =========================================================================
-- 1. MULTI-COMPANY AND ORGANIZATION SCHEMA
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    tax_id text, -- RFC / TIN
    logo_url text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.offices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name text NOT NULL,
    address text,
    city text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teams (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    office_id uuid NOT NULL REFERENCES public.offices(id) ON DELETE CASCADE,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- 2. SYSTEM USER ROLES & PROFILES ENHANCEMENT
-- =========================================================================

-- Add company and office references to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS office_id uuid REFERENCES public.offices(id) ON DELETE SET NULL;

-- Profile commercial types (Fase 0)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_type text CHECK (profile_type IN ('OWNER', 'AGENT', 'PROPERTY_MANAGER'));

-- =========================================================================
-- 3. DICTIONARY & CATALOG TABLES
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.catalog_property_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name_es text NOT NULL,
    name_en text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalog_conservation_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name_es text NOT NULL,
    name_en text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalog_construction_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name_es text NOT NULL,
    name_en text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalog_view_types (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name_es text NOT NULL,
    name_en text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalog_orientations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name_es text NOT NULL,
    name_en text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalog_commercial_states (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name_es text NOT NULL,
    name_en text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalog_amenities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name_es text NOT NULL,
    name_en text NOT NULL,
    category text NOT NULL CHECK (category IN ('Interior', 'Exterior', 'Technology')),
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.catalog_translations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    locale text NOT NULL CHECK (locale IN ('es', 'en', 'fr', 'pt')),
    field_name text NOT NULL,
    translation text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(table_name, record_id, locale, field_name)
);

-- =========================================================================
-- 4. DYNAMIC CUSTOM FIELDS SYSTEM (NO-CODE READY)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.property_custom_fields (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'select')),
    options text[] DEFAULT '{}',
    default_value text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- 5. PHYSICAL PROPERTY ENTITY (properties)
-- =========================================================================

-- Sequence for properties internal codes
CREATE SEQUENCE IF NOT EXISTS public.properties_internal_code_seq START WITH 1;

-- Alter properties table to support professional physical properties schema
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS internal_code text UNIQUE;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS primary_operation text CHECK (primary_operation IN ('SALE', 'RENT', 'SWAP'));
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

-- Development info
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS development_name text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS subdivision_name text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS private_neighborhood text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS phase_stage text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS lot_number text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS block_number text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS condominium_regime boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS maintenance_fee_amount numeric(14,2) DEFAULT 0;

-- Additional locations
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS neighborhood text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS postal_code text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS street_name text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS street_number text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS location_reference text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS show_public_address boolean NOT NULL DEFAULT true;

-- Geolocation
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS search_radius_meters integer DEFAULT 1000;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS nearby_schools text[] DEFAULT '{}';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS nearby_hospitals text[] DEFAULT '{}';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS nearby_malls text[] DEFAULT '{}';

-- Extra features
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS half_bathrooms integer DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS parking_spaces integer DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS levels_count integer DEFAULT 1;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS construction_age integer;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS conservation_state_id uuid REFERENCES public.catalog_conservation_states(id) ON DELETE SET NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS construction_type_id uuid REFERENCES public.catalog_construction_types(id) ON DELETE SET NULL;

-- Surfaces
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS surface_total numeric(10,2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS surface_built numeric(10,2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS surface_front numeric(8,2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS surface_depth numeric(8,2);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS surface_garden numeric(8,2) DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS surface_terrace numeric(8,2) DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS surface_roof_garden numeric(8,2) DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS surface_patio numeric(8,2) DEFAULT 0;

-- Legal Info
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS legal_debt_free boolean DEFAULT true;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS legal_public_deed boolean DEFAULT true;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS legal_tax_current boolean DEFAULT true;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS legal_services_paid boolean DEFAULT true;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS legal_owner_type text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS legal_is_mortgaged boolean DEFAULT false;

-- Services
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS services_water boolean DEFAULT true;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS services_electricity boolean DEFAULT true;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS services_sewerage boolean DEFAULT true;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS services_nat_gas boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS services_lp_gas boolean DEFAULT true;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS services_internet text DEFAULT 'Fiber Optic';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS services_garbage boolean DEFAULT true;

-- Security
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS security_cctv boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS security_guardhouse boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS security_24_7 boolean DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS security_biometric boolean DEFAULT false;

-- Views and Orientations
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS view_type_id uuid REFERENCES public.catalog_view_types(id) ON DELETE SET NULL;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS orientation_id uuid REFERENCES public.catalog_orientations(id) ON DELETE SET NULL;

-- IA Ready Placeholders
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS ai_summary text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS ai_description text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS ai_tags text[] DEFAULT '{}';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS ai_keywords text[] DEFAULT '{}';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS ai_score_override numeric(3,1);
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS ai_recommendations text[] DEFAULT '{}';

-- Folder / Workflow State
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS folder_status text DEFAULT 'DRAFT' CHECK (folder_status IN ('DRAFT', 'PENDING_DOCUMENTS', 'UNDER_REVIEW', 'PUBLISHED', 'PAUSED', 'SOLD', 'RENTED', 'ARCHIVED'));

-- Owner contact info (private)
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_private_name text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_private_phone text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_private_email text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_contact_time text;

-- SEO
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS meta_title text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS meta_description text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS meta_keywords text[] DEFAULT '{}';

-- Extra IDs
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS qr_code_url text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS short_code text UNIQUE;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS short_link text;

-- updated_at
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- =========================================================================
-- 6. INTERMEDIATE RELATION TABLES
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.property_amenities (
    property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    amenity_id uuid NOT NULL REFERENCES public.catalog_amenities(id) ON DELETE CASCADE,
    PRIMARY KEY (property_id, amenity_id)
);

CREATE TABLE IF NOT EXISTS public.property_custom_values (
    property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    field_id uuid NOT NULL REFERENCES public.property_custom_fields(id) ON DELETE CASCADE,
    value text NOT NULL,
    PRIMARY KEY (property_id, field_id)
);

CREATE TABLE IF NOT EXISTS public.property_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    document_type text NOT NULL CHECK (document_type IN ('DEED', 'TAX_RECIPET', 'APPRAISAL', 'CONDO_REGIME', 'PLAN', 'CONTRACT', 'ID_PROPRIETOR')),
    file_url text NOT NULL,
    status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- 7. PROPERTY OFFERINGS SCHEMA (EXPLICIT FOR TRANSACTIONS)
-- =========================================================================

-- Sequence for offerings commercial code
CREATE SEQUENCE IF NOT EXISTS public.property_offerings_code_seq START WITH 1;

-- Alter offerings table to reflect definitive commercial details
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS commercial_code text UNIQUE;

-- Financial specifics
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS accepts_bank_credit boolean DEFAULT true;
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS accepts_infonavit boolean DEFAULT true;
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS accepts_fovissste boolean DEFAULT true;
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS accepts_cash boolean DEFAULT true;
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS developer_financing boolean DEFAULT false;

-- Rental specifics
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS deposit_amount numeric(14,2);
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS advance_months integer DEFAULT 1;
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS requires_guarantor boolean DEFAULT false;
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS requires_legal_policy boolean DEFAULT false;

-- Swap specifics
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS swap_min_value numeric(14,2);
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS swap_max_value numeric(14,2);
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS swap_cash_difference_allowed boolean DEFAULT false;

-- Maintenance and costs
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS annual_property_tax numeric(14,2) DEFAULT 0;
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS water_monthly_avg numeric(14,2) DEFAULT 0;
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS electricity_monthly_avg numeric(14,2) DEFAULT 0;
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS gas_monthly_avg numeric(14,2) DEFAULT 0;

-- Agent/Broker comms
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS commission_total_pct numeric(5,2);
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS commission_shared_pct numeric(5,2);
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS agent_responsible_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Dates
ALTER TABLE public.property_offerings ADD COLUMN IF NOT EXISTS estimated_delivery_date date;

-- =========================================================================
-- 8. COMMERCIAL LOG HISTORY TABLES
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.property_commercial_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    price_change_log jsonb DEFAULT '[]'::jsonb,
    status_change_log jsonb DEFAULT '[]'::jsonb,
    views_count integer DEFAULT 0,
    favorites_count integer DEFAULT 0,
    leads_count integer DEFAULT 0,
    shares_count integer DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action_type text NOT NULL CHECK (action_type IN ('INSERT', 'UPDATE', 'DELETE')),
    old_value jsonb,
    new_value jsonb,
    ip_address text,
    user_agent text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================================
-- 9. TRIGGERS AND SEQUENCES FUNCTIONAL IMPLEMENTATION
-- =========================================================================

-- Trigger to generate AS-P-000001 code automatically on properties
CREATE OR REPLACE FUNCTION public.generate_property_internal_code()
RETURNS TRIGGER AS $$
DECLARE
    seq_num integer;
    prefix text;
BEGIN
    IF NEW.internal_code IS NULL THEN
        SELECT nextval('public.properties_internal_code_seq') INTO seq_num;
        prefix := CASE NEW.primary_operation
            WHEN 'SALE' THEN 'AS-V-'
            WHEN 'RENT' THEN 'AS-R-'
            WHEN 'SWAP' THEN 'AS-S-'
            ELSE 'AS-P-'
        END;
        NEW.internal_code := prefix || lpad(seq_num::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_properties_internal_code ON public.properties;
CREATE TRIGGER trigger_properties_internal_code
BEFORE INSERT ON public.properties
FOR EACH ROW
EXECUTE FUNCTION public.generate_property_internal_code();

-- Trigger to generate AS-[V|R|S]-000001 code automatically on offerings
CREATE OR REPLACE FUNCTION public.generate_offering_commercial_code()
RETURNS TRIGGER AS $$
DECLARE
    seq_num integer;
    prefix text;
BEGIN
    IF NEW.commercial_code IS NULL THEN
        SELECT nextval('public.property_offerings_code_seq') INTO seq_num;
        prefix := CASE NEW.mode::text
            WHEN 'SALE' THEN 'AS-V-'
            WHEN 'RENT' THEN 'AS-R-'
            WHEN 'MONTHLY_RENT' THEN 'AS-R-'
            WHEN 'SHORT_RENT' THEN 'AS-R-'
            WHEN 'SWAP' THEN 'AS-S-'
            ELSE 'AS-O-'
        END;
        NEW.commercial_code := prefix || lpad(seq_num::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_offerings_commercial_code ON public.property_offerings;
CREATE TRIGGER trigger_offerings_commercial_code
BEFORE INSERT ON public.property_offerings
FOR EACH ROW
EXECUTE FUNCTION public.generate_offering_commercial_code();
