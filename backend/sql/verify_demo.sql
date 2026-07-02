-- AuraSwap Verification Script
-- Audits that exactly 9 demo properties exist in Supabase database.

-- 1. Print property count by offering mode (Venta, Renta, Swap)
SELECT 
    po.mode AS "Modalidad",
    COUNT(DISTINCT p.id) AS "Cantidad de Propiedades"
FROM public.properties p
JOIN public.property_offerings po ON p.id = po.property_id
WHERE p.is_demo = true
GROUP BY po.mode;

-- 2. Print total count of demo properties
SELECT 
    COUNT(*) AS "Total Propiedades Demo"
FROM public.properties
WHERE is_demo = true;

-- 3. Print detailed list of the 9 official properties
SELECT 
    p.id AS "ID",
    p.title AS "Título",
    p.location AS "Ubicación/Ciudad",
    po.mode AS "Modalidad",
    po.price_amount AS "Precio",
    p.desired_exchange AS "Intercambio Deseado",
    COUNT(pi.id) AS "Cantidad Imágenes"
FROM public.properties p
JOIN public.property_offerings po ON p.id = po.property_id
LEFT JOIN public.property_images pi ON p.id = pi.property_id
WHERE p.is_demo = true
GROUP BY p.id, p.title, p.location, po.mode, po.price_amount, p.desired_exchange
ORDER BY po.mode, p.title;
