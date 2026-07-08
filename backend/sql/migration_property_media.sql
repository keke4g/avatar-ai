-- AuraSwap SQL Migration — Consolidated Property Media System
-- Run this script in the Supabase SQL Editor.

-- =========================================================================
-- 1. CREATE PROPERTY_MEDIA TABLE
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.property_media (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
    media_type text NOT NULL, -- IMAGE, VIDEO, YOUTUBE, VIMEO, MATTERPORT, VIRTUAL_TOUR, DRONE, FLOORPLAN, DOCUMENT
    storage_bucket text,
    storage_path text,
    url text NOT NULL,
    thumbnail_url text,
    title text,
    description text,
    display_order integer DEFAULT 0,
    is_primary boolean DEFAULT false,
    metadata jsonb DEFAULT '{}',
    mime_type text,
    file_size bigint,
    duration_seconds integer,
    width integer,
    height integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz
);

-- =========================================================================
-- 2. CREATE PERFORMANCE INDEXES
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_property_media_property_id ON public.property_media(property_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_property_media_media_type ON public.property_media(media_type) WHERE deleted_at IS NULL;

-- =========================================================================
-- 3. CREATE UPDATE_AT AUTOMATIC TRIGGER
-- =========================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_property_media_updated_at ON public.property_media;
CREATE TRIGGER trigger_property_media_updated_at
    BEFORE UPDATE ON public.property_media
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- =========================================================================
-- 4. MIGRATE EXISTING IMAGES TO PROPERTY_MEDIA
-- =========================================================================

INSERT INTO public.property_media (property_id, media_type, url, display_order, is_primary)
SELECT property_id, 'IMAGE', image_url, display_order, (display_order = 0)
FROM public.property_images
ON CONFLICT DO NOTHING;

-- =========================================================================
-- 5. DROP OLD PROPERTY_IMAGES TABLE
-- =========================================================================

DROP TABLE IF EXISTS public.property_images CASCADE;

-- =========================================================================
-- 6. ENABLE ROW LEVEL SECURITY (RLS)
-- =========================================================================

ALTER TABLE public.property_media ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- 7. DEFINE SECURITY POLICIES (RLS)
-- =========================================================================

DROP POLICY IF EXISTS "Select policy for property media" ON public.property_media;
CREATE POLICY "Select policy for property media" ON public.property_media
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.properties p 
            WHERE p.id = property_media.property_id 
            AND (
                p.is_published = true 
                OR p.host_id = auth.uid() 
                OR public.is_admin(auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Write policy for property media" ON public.property_media;
CREATE POLICY "Write policy for property media" ON public.property_media
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.properties p 
            WHERE p.id = property_media.property_id 
            AND (
                p.host_id = auth.uid() 
                OR public.is_admin(auth.uid())
                OR (p.company_id IS NOT NULL AND EXISTS (
                    SELECT 1 FROM public.profiles prof 
                    WHERE prof.id = auth.uid() AND prof.company_id = p.company_id
                ))
            )
        )
    );

-- =========================================================================
-- 8. GRANT API ACCESS PERMISSIONS
-- =========================================================================

GRANT SELECT ON public.property_media TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.property_media TO authenticated;
