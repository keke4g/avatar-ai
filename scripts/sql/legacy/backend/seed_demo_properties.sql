-- AuraSwap Seeding Script for Demo Properties
-- Inserts exactly 9 official properties: 3 Venta, 3 Renta, 3 Swap
-- This script is safe and idempotent (uses fixed UUIDs and ON CONFLICT).

-- 1. Ensure Columns Exist
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS is_demo boolean NOT NULL DEFAULT false;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS desired_exchange text;

DO $$
DECLARE
    v_host_id uuid;
    
    -- UUID definitions for 9 properties
    v_prop_sale_1 uuid := 'e0018acf-92d9-4077-8764-b5d57909cfe5'; -- Casa Residencial Tres Ríos
    v_prop_sale_2 uuid := 'e002aa0c-9c69-4c49-9bc8-b3f328d714ed'; -- Depa Marina Mazatlán
    v_prop_sale_3 uuid := 'e003df7c-f339-457e-9ff1-c236c8a8bd85'; -- Casa La Primavera
    
    v_prop_rent_1 uuid := 'e004b6bc-a260-4b3c-bb8b-8537e95701a0'; -- Depa Zona Dorada
    v_prop_rent_2 uuid := 'e005b30e-a9cb-45bf-aeb9-5e39ffe58f91'; -- Casa Montebello
    v_prop_rent_3 uuid := 'e006092b-2cc8-4246-ad4c-6250cff59f30'; -- Depa Malecón Mazatlán
    
    v_prop_swap_1 uuid := 'e007584a-b8f7-4a03-8ebb-d49b72b95605'; -- Casa Campestre La Primavera
    v_prop_swap_2 uuid := 'e008aa0d-9c69-4c49-9bc8-b3f328d714ee'; -- Depa Vista Marina
    v_prop_swap_3 uuid := 'e009df7d-f339-457e-9ff1-c236c8a8bd86'; -- Terreno Residencial Altata
    
    -- Offering UUIDs
    v_off_sale_1 uuid := 'd0018acf-92d9-4077-8764-b5d57909cfe5';
    v_off_sale_2 uuid := 'd002aa0c-9c69-4c49-9bc8-b3f328d714ed';
    v_off_sale_3 uuid := 'd003df7c-f339-457e-9ff1-c236c8a8bd85';
    
    v_off_rent_1 uuid := 'd004b6bc-a260-4b3c-bb8b-8537e95701a0';
    v_off_rent_2 uuid := 'd005b30e-a9cb-45bf-aeb9-5e39ffe58f91';
    v_off_rent_3 uuid := 'd006092b-2cc8-4246-ad4c-6250cff59f30';
    
    v_off_swap_1 uuid := 'd007584a-b8f7-4a03-8ebb-d49b72b95605';
    v_off_swap_2 uuid := 'd008aa0d-9c69-4c49-9bc8-b3f328d714ee';
    v_off_swap_3 uuid := 'd009df7d-f339-457e-9ff1-c236c8a8bd86';
BEGIN
    -- Get host ID dynamically
    SELECT id INTO v_host_id FROM public.profiles WHERE email = 'lbold14@gmail.com';
    IF v_host_id IS NULL THEN
        SELECT id INTO v_host_id FROM public.profiles LIMIT 1;
    END IF;

    IF v_host_id IS NULL THEN
        RAISE EXCEPTION 'No profiles found in the database. Please register a user first before seeding properties.';
    END IF;

    -- =========================================================================
    -- A. PROPERTIES SEED
    -- =========================================================================
    
    -- 1. Casa Tres Ríos (Venta)
    INSERT INTO public.properties (
        id, host_id, title, description, type, value_rating, location, country, address,
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules,
        is_published, is_demo, desired_exchange
    ) VALUES (
        v_prop_sale_1, v_host_id, 'Casa Residencial — Tres Ríos',
        'Hermosa casa residencial en la exclusiva zona de Tres Ríos con acabados de primera y espacios ideales para toda la familia.',
        'Villa', 'Premium', 'Tres Ríos, Culiacán', 'México', 'Tres Ríos, Culiacán, Sinaloa, México',
        24.8053, -107.3940, 3, 3.5, 6, 95.0, 
        ARRAY['Cocina con isla', 'Jardín', 'Cuarto de lavado', 'Sala', 'Comedor'],
        ARRAY['Respetar reglamento vecinal.', 'No eventos ruidosos.'],
        true, true, NULL
    ) ON CONFLICT (id) DO UPDATE SET 
        title = EXCLUDED.title, description = EXCLUDED.description, location = EXCLUDED.location,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, value_rating = EXCLUDED.value_rating,
        bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms, max_guests = EXCLUDED.max_guests,
        amenities = EXCLUDED.amenities, rules = EXCLUDED.rules;

    -- 2. Departamento Marina Mazatlán (Venta)
    INSERT INTO public.properties (
        id, host_id, title, description, type, value_rating, location, country, address,
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules,
        is_published, is_demo, desired_exchange
    ) VALUES (
        v_prop_sale_2, v_host_id, 'Departamento Marina Mazatlán',
        'Espectacular departamento en Marina Mazatlán con amenidades premium y una vista inigualable.',
        'Apartment', 'Exclusive', 'Marina Mazatlán, Mazatlán', 'México', 'Marina Mazatlán, Mazatlán, Sinaloa, México',
        23.2694, -106.4211, 2, 2.0, 4, 94.0,
        ARRAY['Vista al mar', 'Terraza', 'Alberca', 'Gimnasio', 'Seguridad 24/7'],
        ARRAY['Prohibido fumar.', 'Mantener el orden en áreas comunes.'],
        true, true, NULL
    ) ON CONFLICT (id) DO UPDATE SET 
        title = EXCLUDED.title, description = EXCLUDED.description, location = EXCLUDED.location,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, value_rating = EXCLUDED.value_rating,
        bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms, max_guests = EXCLUDED.max_guests,
        amenities = EXCLUDED.amenities, rules = EXCLUDED.rules;

    -- 3. Casa La Primavera Venta (Venta)
    INSERT INTO public.properties (
        id, host_id, title, description, type, value_rating, location, country, address,
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules,
        is_published, is_demo, desired_exchange
    ) VALUES (
        v_prop_sale_3, v_host_id, 'Casa La Primavera',
        'Exclusiva residencia premium en La Primavera con amplios espacios, cochera techada para tres autos y áreas recreativas.',
        'Villa', 'Premium', 'La Primavera, Culiacán', 'México', 'La Primavera, Culiacán, Sinaloa, México',
        24.7553, -107.3540, 4, 4.5, 8, 97.0,
        ARRAY['Alberca', 'Roof Garden', 'Oficina', 'Jardín', 'Cochera 3 autos'],
        ARRAY['Acceso controlado.', 'Respetar áreas verdes.'],
        true, true, NULL
    ) ON CONFLICT (id) DO UPDATE SET 
        title = EXCLUDED.title, description = EXCLUDED.description, location = EXCLUDED.location,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, value_rating = EXCLUDED.value_rating,
        bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms, max_guests = EXCLUDED.max_guests,
        amenities = EXCLUDED.amenities, rules = EXCLUDED.rules;

    -- 4. Departamento Zona Dorada (Renta)
    INSERT INTO public.properties (
        id, host_id, title, description, type, value_rating, location, country, address,
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules,
        is_published, is_demo, desired_exchange
    ) VALUES (
        v_prop_rent_1, v_host_id, 'Departamento Zona Dorada',
        'Acogedor departamento amueblado en la Zona Dorada de Mazatlán con alberca y seguridad permanente.',
        'Apartment', 'Curated', 'Zona Dorada, Mazatlán', 'México', 'Zona Dorada, Mazatlán, Sinaloa, México',
        23.2494, -106.4111, 2, 2.0, 4, 93.0,
        ARRAY['Amueblado', 'Alberca', 'Balcón', 'Elevador', 'Seguridad'],
        ARRAY['No se permiten mascotas.', 'Límite de 4 huéspedes.'],
        true, true, NULL
    ) ON CONFLICT (id) DO UPDATE SET 
        title = EXCLUDED.title, description = EXCLUDED.description, location = EXCLUDED.location,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, value_rating = EXCLUDED.value_rating,
        bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms, max_guests = EXCLUDED.max_guests,
        amenities = EXCLUDED.amenities, rules = EXCLUDED.rules;

    -- 5. Casa Montebello (Renta)
    INSERT INTO public.properties (
        id, host_id, title, description, type, value_rating, location, country, address,
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules,
        is_published, is_demo, desired_exchange
    ) VALUES (
        v_prop_rent_2, v_host_id, 'Casa Montebello',
        'Excelente residencia de renta en Montebello ubicada en una privada muy tranquila con cochera cerrada y cocina integral.',
        'Villa', 'Curated', 'Montebello, Culiacán', 'México', 'Montebello, Culiacán, Sinaloa, México',
        24.7853, -107.3740, 3, 3.0, 6, 92.0,
        ARRAY['Estudio', 'Jardín', 'Privada', 'Cochera', 'Cocina integral'],
        ARRAY['Se solicita depósito en garantía.', 'Contrato mínimo de 6 meses.'],
        true, true, NULL
    ) ON CONFLICT (id) DO UPDATE SET 
        title = EXCLUDED.title, description = EXCLUDED.description, location = EXCLUDED.location,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, value_rating = EXCLUDED.value_rating,
        bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms, max_guests = EXCLUDED.max_guests,
        amenities = EXCLUDED.amenities, rules = EXCLUDED.rules;

    -- 6. Departamento Malecón Mazatlán (Renta)
    INSERT INTO public.properties (
        id, host_id, title, description, type, value_rating, location, country, address,
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules,
        is_published, is_demo, desired_exchange
    ) VALUES (
        v_prop_rent_3, v_host_id, 'Departamento Malecón Mazatlán',
        'Premium departamento frente al malecón de Mazatlán con alberca infinity, gimnasio y vistas espectaculares al océano.',
        'Apartment', 'Luxury', 'Malecón, Mazatlán', 'México', 'Malecón, Mazatlán, Sinaloa, México',
        23.2394, -106.4011, 3, 2.0, 6, 96.0,
        ARRAY['Vista al mar', 'Terraza', 'Alberca Infinity', 'Gimnasio', 'Estacionamiento techado'],
        ARRAY['Reglamento condominal estricto.', 'No ruido molesto después de las 10 PM.'],
        true, true, NULL
    ) ON CONFLICT (id) DO UPDATE SET 
        title = EXCLUDED.title, description = EXCLUDED.description, location = EXCLUDED.location,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, value_rating = EXCLUDED.value_rating,
        bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms, max_guests = EXCLUDED.max_guests,
        amenities = EXCLUDED.amenities, rules = EXCLUDED.rules;

    -- 7. Casa Campestre — La Primavera (Swap)
    INSERT INTO public.properties (
        id, host_id, title, description, type, value_rating, location, country, address,
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules,
        is_published, is_demo, desired_exchange
    ) VALUES (
        v_prop_swap_1, v_host_id, 'Casa Campestre — La Primavera',
        'Hermosa casa campestre en La Primavera con alberca, amplio jardín, terraza de concreto aparente y acabados premium. Excelente espacio familiar y de descanso.',
        'Villa', 'Exclusive', 'La Primavera, Culiacán', 'México', 'La Primavera, Culiacán, Sinaloa, México',
        24.7653, -107.3640, 4, 4.5, 8, 96.0,
        ARRAY['Alberca', 'Jardín', 'Terraza', 'Cocina integral', 'Oficina', 'Family Room'],
        ARRAY['Cuidar las instalaciones.', 'Respetar el reglamento del fraccionamiento.'],
        true, true, 'Departamento en Mazatlán, Casa en Querétaro o Propiedad Comercial'
    ) ON CONFLICT (id) DO UPDATE SET 
        title = EXCLUDED.title, description = EXCLUDED.description, location = EXCLUDED.location,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, value_rating = EXCLUDED.value_rating,
        bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms, max_guests = EXCLUDED.max_guests,
        amenities = EXCLUDED.amenities, rules = EXCLUDED.rules, desired_exchange = EXCLUDED.desired_exchange;

    -- 8. Departamento Vista Marina (Swap)
    INSERT INTO public.properties (
        id, host_id, title, description, type, value_rating, location, country, address,
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules,
        is_published, is_demo, desired_exchange
    ) VALUES (
        v_prop_swap_2, v_host_id, 'Departamento Vista Marina',
        'Espectacular departamento en Marina Mazatlán con vista panorámica al canal navegable y al mar. Amenidades de lujo, gimnasio equipado y piscina infinity.',
        'Apartment', 'Exclusive', 'Marina Mazatlán, Mazatlán', 'México', 'Marina Mazatlán, Mazatlán, Sinaloa, México',
        23.2794, -106.4311, 3, 2.0, 6, 95.0,
        ARRAY['Vista al mar', 'Roof Garden', 'Alberca', 'Gimnasio', 'Seguridad 24 horas'],
        ARRAY['No fumar.', 'Seguir las normas del edificio.'],
        true, true, 'Casa en Culiacán, Terreno residencial o Propiedad en Guadalajara'
    ) ON CONFLICT (id) DO UPDATE SET 
        title = EXCLUDED.title, description = EXCLUDED.description, location = EXCLUDED.location,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, value_rating = EXCLUDED.value_rating,
        bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms, max_guests = EXCLUDED.max_guests,
        amenities = EXCLUDED.amenities, rules = EXCLUDED.rules, desired_exchange = EXCLUDED.desired_exchange;

    -- 9. Terreno Residencial Altata (Swap)
    INSERT INTO public.properties (
        id, host_id, title, description, type, value_rating, location, country, address,
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules,
        is_published, is_demo, desired_exchange
    ) VALUES (
        v_prop_swap_3, v_host_id, 'Terreno Residencial Altata',
        'Excelente terreno residencial en Altata ubicado a pocos minutos de la playa. Cuenta con frente pavimentado, servicios al pie del lote y alta plusvalía. Ideal para construir casa de descanso o cabaña.',
        'Beach House', 'Curated', 'Altata, Navolato', 'México', 'Altata, Navolato, Sinaloa, México',
        24.6333, -107.9333, 1, 1.0, 2, 91.0,
        ARRAY['Servicios', 'Frente pavimentado', 'Excelente plusvalía'],
        ARRAY['Mantener limpio.', 'No tirar basura.'],
        true, true, 'Departamento en Mazatlán, Casa en Culiacán o Local comercial'
    ) ON CONFLICT (id) DO UPDATE SET 
        title = EXCLUDED.title, description = EXCLUDED.description, location = EXCLUDED.location,
        latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, value_rating = EXCLUDED.value_rating,
        bedrooms = EXCLUDED.bedrooms, bathrooms = EXCLUDED.bathrooms, max_guests = EXCLUDED.max_guests,
        amenities = EXCLUDED.amenities, rules = EXCLUDED.rules, desired_exchange = EXCLUDED.desired_exchange;

    -- =========================================================================
    -- B. OFFERINGS SEED
    -- =========================================================================
    
    -- 1. Tres Ríos (Venta: 5.95M MXN)
    INSERT INTO public.property_offerings (
        id, property_id, mode, status, visibility, title, description, price_amount, currency, billing_period,
        is_price_negotiable, accepts_offers, requires_approval, allow_instant_request
    ) VALUES (
        v_off_sale_1, v_prop_sale_1, 'SALE', 'ACTIVE', 'PUBLIC', 
        'Casa Residencial — Tres Ríos', 'Venta directa en Tres Ríos', 5950000.00, 'MXN', 'TOTAL',
        true, true, false, true
    ) ON CONFLICT (property_id, mode) DO UPDATE SET
        price_amount = EXCLUDED.price_amount, currency = EXCLUDED.currency, billing_period = EXCLUDED.billing_period, status = EXCLUDED.status;

    -- 2. Marina Mazatlán (Venta: 6.75M MXN)
    INSERT INTO public.property_offerings (
        id, property_id, mode, status, visibility, title, description, price_amount, currency, billing_period,
        is_price_negotiable, accepts_offers, requires_approval, allow_instant_request
    ) VALUES (
        v_off_sale_2, v_prop_sale_2, 'SALE', 'ACTIVE', 'PUBLIC', 
        'Departamento Marina Mazatlán', 'Venta en Marina Mazatlán', 6750000.00, 'MXN', 'TOTAL',
        true, true, false, true
    ) ON CONFLICT (property_id, mode) DO UPDATE SET
        price_amount = EXCLUDED.price_amount, currency = EXCLUDED.currency, billing_period = EXCLUDED.billing_period, status = EXCLUDED.status;

    -- 3. La Primavera Venta (Venta: 8.45M MXN)
    INSERT INTO public.property_offerings (
        id, property_id, mode, status, visibility, title, description, price_amount, currency, billing_period,
        is_price_negotiable, accepts_offers, requires_approval, allow_instant_request
    ) VALUES (
        v_off_sale_3, v_prop_sale_3, 'SALE', 'ACTIVE', 'PUBLIC', 
        'Casa La Primavera', 'Residencia premium en venta', 8450000.00, 'MXN', 'TOTAL',
        true, true, false, true
    ) ON CONFLICT (property_id, mode) DO UPDATE SET
        price_amount = EXCLUDED.price_amount, currency = EXCLUDED.currency, billing_period = EXCLUDED.billing_period, status = EXCLUDED.status;

    -- 4. Zona Dorada (Renta: 24,500 MXN / mes)
    INSERT INTO public.property_offerings (
        id, property_id, mode, status, visibility, title, description, price_amount, currency, billing_period,
        is_price_negotiable, accepts_offers, requires_approval, allow_instant_request
    ) VALUES (
        v_off_rent_1, v_prop_rent_1, 'MONTHLY_RENT', 'ACTIVE', 'PUBLIC', 
        'Departamento Zona Dorada', 'Renta amueblada mensual', 24500.00, 'MXN', 'MONTH',
        true, true, false, true
    ) ON CONFLICT (property_id, mode) DO UPDATE SET
        price_amount = EXCLUDED.price_amount, currency = EXCLUDED.currency, billing_period = EXCLUDED.billing_period, status = EXCLUDED.status;

    -- 5. Montebello (Renta: 32,000 MXN / mes)
    INSERT INTO public.property_offerings (
        id, property_id, mode, status, visibility, title, description, price_amount, currency, billing_period,
        is_price_negotiable, accepts_offers, requires_approval, allow_instant_request
    ) VALUES (
        v_off_rent_2, v_prop_rent_2, 'MONTHLY_RENT', 'ACTIVE', 'PUBLIC', 
        'Casa Montebello', 'Casa en privada mensual', 32000.00, 'MXN', 'MONTH',
        true, true, false, true
    ) ON CONFLICT (property_id, mode) DO UPDATE SET
        price_amount = EXCLUDED.price_amount, currency = EXCLUDED.currency, billing_period = EXCLUDED.billing_period, status = EXCLUDED.status;

    -- 6. Malecón Mazatlán (Renta: 38,000 MXN / mes)
    INSERT INTO public.property_offerings (
        id, property_id, mode, status, visibility, title, description, price_amount, currency, billing_period,
        is_price_negotiable, accepts_offers, requires_approval, allow_instant_request
    ) VALUES (
        v_off_rent_3, v_prop_rent_3, 'MONTHLY_RENT', 'ACTIVE', 'PUBLIC', 
        'Departamento Malecón Mazatlán', 'Renta mensual frente al mar', 38000.00, 'MXN', 'MONTH',
        true, true, false, true
    ) ON CONFLICT (property_id, mode) DO UPDATE SET
        price_amount = EXCLUDED.price_amount, currency = EXCLUDED.currency, billing_period = EXCLUDED.billing_period, status = EXCLUDED.status;

    -- 7. Casa Campestre — La Primavera (Swap)
    INSERT INTO public.property_offerings (
        id, property_id, mode, status, visibility, title, description, price_amount, currency, billing_period,
        is_price_negotiable, accepts_offers, requires_approval, allow_instant_request, swap_value_tier
    ) VALUES (
        v_off_swap_1, v_prop_swap_1, 'SWAP', 'ACTIVE', 'PUBLIC', 
        'Casa Campestre — La Primavera', 'Intercambio residencial premium', NULL, 'USD', 'NONE',
        false, true, true, false, 'Exclusive'
    ) ON CONFLICT (property_id, mode) DO UPDATE SET
        price_amount = EXCLUDED.price_amount, currency = EXCLUDED.currency, billing_period = EXCLUDED.billing_period, status = EXCLUDED.status;

    -- 8. Departamento Vista Marina (Swap)
    INSERT INTO public.property_offerings (
        id, property_id, mode, status, visibility, title, description, price_amount, currency, billing_period,
        is_price_negotiable, accepts_offers, requires_approval, allow_instant_request, swap_value_tier
    ) VALUES (
        v_off_swap_2, v_prop_swap_2, 'SWAP', 'ACTIVE', 'PUBLIC', 
        'Departamento Vista Marina', 'Intercambio de departamento en Mazatlán', NULL, 'USD', 'NONE',
        false, true, true, false, 'Exclusive'
    ) ON CONFLICT (property_id, mode) DO UPDATE SET
        price_amount = EXCLUDED.price_amount, currency = EXCLUDED.currency, billing_period = EXCLUDED.billing_period, status = EXCLUDED.status;

    -- 9. Terreno Residencial Altata (Swap)
    INSERT INTO public.property_offerings (
        id, property_id, mode, status, visibility, title, description, price_amount, currency, billing_period,
        is_price_negotiable, accepts_offers, requires_approval, allow_instant_request, swap_value_tier
    ) VALUES (
        v_off_swap_3, v_prop_swap_3, 'SWAP', 'ACTIVE', 'PUBLIC', 
        'Terreno Residencial Altata', 'Intercambio de lote residencial', NULL, 'USD', 'NONE',
        false, true, true, false, 'Curated'
    ) ON CONFLICT (property_id, mode) DO UPDATE SET
        price_amount = EXCLUDED.price_amount, currency = EXCLUDED.currency, billing_period = EXCLUDED.billing_period, status = EXCLUDED.status;

    -- =========================================================================
    -- C. IMAGES SEED (Exactly 5 permanent premium images per property)
    -- =========================================================================
    
    -- Ensure clean start for images of these specific properties to prevent duplicates on re-runs
    DELETE FROM public.property_images WHERE property_id IN (
        v_prop_sale_1, v_prop_sale_2, v_prop_sale_3,
        v_prop_rent_1, v_prop_rent_2, v_prop_rent_3,
        v_prop_swap_1, v_prop_swap_2, v_prop_swap_3
    );

    -- 1. Tres Ríos (5 images)
    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (v_prop_sale_1, 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80', 0),
    (v_prop_sale_1, 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80', 1),
    (v_prop_sale_1, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', 2),
    (v_prop_sale_1, 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80', 3),
    (v_prop_sale_1, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80', 4);

    -- 2. Marina Mazatlán (5 images)
    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (v_prop_sale_2, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80', 0),
    (v_prop_sale_2, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80', 1),
    (v_prop_sale_2, 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80', 2),
    (v_prop_sale_2, 'https://images.unsplash.com/photo-1499955085172-a104c9463ece?auto=format&fit=crop&w=1200&q=80', 3),
    (v_prop_sale_2, 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80', 4);

    -- 3. La Primavera Venta (5 images)
    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (v_prop_sale_3, 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80', 0),
    (v_prop_sale_3, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', 1),
    (v_prop_sale_3, 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80', 2),
    (v_prop_sale_3, 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1200&q=80', 3),
    (v_prop_sale_3, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80', 4);

    -- 4. Zona Dorada (5 images)
    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (v_prop_rent_1, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80', 0),
    (v_prop_rent_1, 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80', 1),
    (v_prop_rent_1, 'https://images.unsplash.com/photo-1499955085172-a104c9463ece?auto=format&fit=crop&w=1200&q=80', 2),
    (v_prop_rent_1, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80', 3),
    (v_prop_rent_1, 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1200&q=80', 4);

    -- 5. Montebello (5 images)
    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (v_prop_rent_2, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', 0),
    (v_prop_rent_2, 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80', 1),
    (v_prop_rent_2, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80', 2),
    (v_prop_rent_2, 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80', 3),
    (v_prop_rent_2, 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1200&q=80', 4);

    -- 6. Malecón Mazatlán (5 images)
    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (v_prop_rent_3, 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80', 0),
    (v_prop_rent_3, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80', 1),
    (v_prop_rent_3, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80', 2),
    (v_prop_rent_3, 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80', 3),
    (v_prop_rent_3, 'https://images.unsplash.com/photo-1499955085172-a104c9463ece?auto=format&fit=crop&w=1200&q=80', 4);

    -- 7. Casa Campestre — La Primavera (5 images)
    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (v_prop_swap_1, 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1200&q=80', 0),
    (v_prop_swap_1, 'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1200&q=80', 1),
    (v_prop_swap_1, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', 2),
    (v_prop_swap_1, 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1200&q=80', 3),
    (v_prop_swap_1, 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80', 4);

    -- 8. Departamento Vista Marina (5 images)
    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (v_prop_swap_2, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80', 0),
    (v_prop_swap_2, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80', 1),
    (v_prop_swap_2, 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80', 2),
    (v_prop_swap_2, 'https://images.unsplash.com/photo-1499955085172-a104c9463ece?auto=format&fit=crop&w=1200&q=80', 3),
    (v_prop_swap_2, 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80', 4);

    -- 9. Terreno Residencial Altata (5 images)
    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (v_prop_swap_3, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80', 0),
    (v_prop_swap_3, 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&w=1200&q=80', 1),
    (v_prop_swap_3, 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1200&q=80', 2),
    (v_prop_swap_3, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', 3),
    (v_prop_swap_3, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80', 4);

    RAISE NOTICE 'Demo properties and offerings seeded successfully.';
END
$$;
