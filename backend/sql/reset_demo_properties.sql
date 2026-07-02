-- AuraSwap Database Clean Script (is_demo = true only)
-- Deletes demo data without affecting real user properties.

-- 1. Check if tables exist and add columns if they do not exist (pre-flight check)
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS desired_exchange text;

-- 2. Delete grandchildren records (availability and pricing rules)
DELETE FROM public.property_offering_availability
WHERE offering_id IN (
    SELECT id FROM public.property_offerings 
    WHERE property_id IN (SELECT id FROM public.properties WHERE is_demo = true)
);

DELETE FROM public.property_offering_pricing_rules
WHERE offering_id IN (
    SELECT id FROM public.property_offerings 
    WHERE property_id IN (SELECT id FROM public.properties WHERE is_demo = true)
);

-- 3. Delete CRM / Leads records
DELETE FROM public.leads
WHERE property_id IN (SELECT id FROM public.properties WHERE is_demo = true);

-- 4. Delete child offerings
DELETE FROM public.property_offerings
WHERE property_id IN (SELECT id FROM public.properties WHERE is_demo = true);

-- 5. Delete child images
DELETE FROM public.property_images
WHERE property_id IN (SELECT id FROM public.properties WHERE is_demo = true);

-- 6. Delete child review records
DELETE FROM public.reviews
WHERE target_property_id IN (SELECT id FROM public.properties WHERE is_demo = true);

-- 7. Delete child favorites junction records
DELETE FROM public.favorites
WHERE property_id IN (SELECT id FROM public.properties WHERE is_demo = true);

-- 8. Delete message logs linked to swaps for demo properties
DELETE FROM public.messages
WHERE swap_id IN (
    SELECT id FROM public.swaps
    WHERE sender_property_id IN (SELECT id FROM public.properties WHERE is_demo = true)
       OR receiver_property_id IN (SELECT id FROM public.properties WHERE is_demo = true)
);

-- 9. Delete swap requests involving demo properties
DELETE FROM public.swaps
WHERE sender_property_id IN (SELECT id FROM public.properties WHERE is_demo = true)
   OR receiver_property_id IN (SELECT id FROM public.properties WHERE is_demo = true);

-- 10. Delete main properties marked as demo
DELETE FROM public.properties
WHERE is_demo = true;
