-- Migration for Geolocation Columns
-- 1. Add new columns safely if they do not exist
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS place_id TEXT,
ADD COLUMN IF NOT EXISTS formatted_address TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS country TEXT,
ADD COLUMN IF NOT EXISTS geometry_source TEXT;

-- 2. Allow null values in latitude and longitude
ALTER TABLE public.properties
ALTER COLUMN latitude DROP NOT NULL;

ALTER TABLE public.properties
ALTER COLUMN longitude DROP NOT NULL;

-- 3. Create index on place_id if it doesn't already exist
CREATE INDEX IF NOT EXISTS idx_properties_place_id
ON public.properties(place_id);
