-- migration_featured.sql
-- Injects database columns for premium featured property visibility support

ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS featured_until timestamp with time zone,
ADD COLUMN IF NOT EXISTS featured_rank integer default 0;

COMMENT ON COLUMN public.properties.featured_until IS 'The timestamp when a property highlight visibility tier expires';
COMMENT ON COLUMN public.properties.featured_rank IS 'Sorting priority rank to boost search ranking order for featured properties';
