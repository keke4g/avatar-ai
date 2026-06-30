-- =========================================================================
-- AuraSwap Premium Catalog Seed Script
-- =========================================================================
-- Use this script to manually seed the 10 preset catalog properties and images.
-- Run this inside the Supabase SQL Editor.
-- Associate all demo properties to a specific user by calling the function below.
-- E.g.: SELECT public.seed_demo_data('your-user-uuid-here');
-- =========================================================================

CREATE OR REPLACE FUNCTION public.seed_demo_data(target_host_id uuid)
RETURNS void AS $$
DECLARE
    p1 uuid;
    p2 uuid;
    p3 uuid;
    p4 uuid;
    p5 uuid;
    p6 uuid;
    p7 uuid;
    p8 uuid;
    p9 uuid;
    p10 uuid;
BEGIN
    -- Ensure profiles record exists for safety
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = target_host_id) THEN
        RAISE EXCEPTION 'Target host ID % does not exist in profiles table.', target_host_id;
    END IF;

    -- Clean existing properties/images associated to this target_host_id for clean runs
    DELETE FROM public.properties WHERE host_id = target_host_id;

    -- 1. Villa de Concreto Modernista (Cancún)
    INSERT INTO public.properties (
        host_id, title, description, type, value_rating, location, country, address, 
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules, is_published, is_featured
    ) VALUES (
        target_host_id, 'Villa de Concreto Modernista',
        'Ubicada frente a las aguas color azul turquesa de Cancún, esta impresionante estructura de concreto expuesto presenta líneas brutalistas limpias mezcladas con elegantes detalles tropicales. Enormes paneles de vidrio corredizos eliminan los límites entre el salón interior, la piscina infinita y una playa privada. Totalmente equipada con personal.',
        'Villa', 'Premium', 'Cancún, Quintana Roo', 'México', 'Paseo Kukulcan Km 15.5, Zona Hotelera',
        21.1111, -86.8222, 5, 6, 10, 98.0,
        ARRAY['Infinity Pool', 'Private Beach', 'Chef Kitchen', 'Home Theater', 'Ocean Views', 'Paddleboards', 'Tesla Charger'],
        ARRAY['No se permite música alta en exteriores después de las 11:00 PM.', 'Dúchate para quitarte la arena antes de entrar a la piscina infinita.', 'Solo se permiten huéspedes registrados durante la noche.'],
        true, true
    ) RETURNING id INTO p1;

    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (p1, 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80', 0),
    (p1, 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80', 1);

    -- 2. Loft del Siglo XVII en Le Marais (París)
    INSERT INTO public.properties (
        host_id, title, description, type, value_rating, location, country, address, 
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules, is_published, is_featured
    ) VALUES (
        target_host_id, 'Loft del Siglo XVII en Le Marais',
        'Adéntrate en la elegancia histórica de París. Ubicado en el de moda distrito de Le Marais, este apartamento cuenta con vigas de roble originales talladas a mano, bloques de piedra caliza blanca expuestos y una curaduría de piezas modernas de mediados de siglo. Ventanales inundan el loft de luz romántica del norte, con vistas a los tejados grises de zinc parisinos y patios secretos.',
        'Loft', 'Luxury', 'París, Sena', 'Francia', 'Rue de Rivoli 42, Le Marais',
        48.8566, 2.3522, 2, 2, 4, 96.0,
        ARRAY['Espresso Bar', 'Vintage Record Player', 'Library', 'French Balcony', 'High-Speed Wifi'],
        ARRAY['Por favor respeta a nuestros tranquilos vecinos parisinos; no se permiten fiestas.', 'Usa solo limpiadores seguros para lana en las alfombras persas antiguas.', 'Riega las hortensias del balcón una vez cada tres días.'],
        true, true
    ) RETURNING id INTO p2;

    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (p2, 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1200&q=80', 0),
    (p2, 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80', 1);

    -- 3. Penthouse Bauhaus con Vistas a CDMX
    INSERT INTO public.properties (
        host_id, title, description, type, value_rating, location, country, address, 
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules, is_published, is_featured
    ) VALUES (
        target_host_id, 'Penthouse Bauhaus con Vistas a CDMX',
        'Un espectacular penthouse en la arbolada Roma Norte. Arquitectura industrial impecable inspirada en la escuela Bauhaus, con ventanales de acero personalizados, acabados de concreto oscuro y una terraza privada llena de plantas nativas mexicanas. Un refugio de diseño silencioso en la mejor zona gastronómica.',
        'Penthouse', 'Exclusive', 'CDMX, Roma Norte', 'México', 'Calle Colima 184, Roma Norte',
        19.4143, -99.1620, 3, 3, 6, 97.0,
        ARRAY['Rooftop Garden', 'Dedicated Workspace', 'Espresso Maker', 'Bicycles', 'Art Collection'],
        ARRAY['Usa los ceniceros de la terraza; estrictamente prohibido fumar en el interior.', 'Siéntete libre de tomar prestadas las bicicletas de ruta retro, pero asegúralas bien.', 'Salida antes de las 11:00 AM para permitir la poda del jardín.'],
        true, false
    ) RETURNING id INTO p3;

    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (p3, 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80', 0);

    -- 4. Santuario Tropical en Ubud (Bali)
    INSERT INTO public.properties (
        host_id, title, description, type, value_rating, location, country, address, 
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules, is_published, is_featured
    ) VALUES (
        target_host_id, 'Santuario Tropical en Ubud',
        'Sumérgete en la calma de la selva. Esta impresionante villa de bambú en Ubud cuenta con una estructura de concepto open spaces que se conecta con la selva tropical circundante y una piscina natural privada. Escucha los susurros del río y disfruta de desayunos con vistas a los campos de arroz.',
        'Villa', 'Curated', 'Ubud, Gianyar', 'Indonesia', 'Jalan Raya Ubud Km 3',
        -8.5069, 115.2625, 4, 4, 8, 99.0,
        ARRAY['Infinity Pool', 'Semi-Outdoor Shower', 'Scooters Included', 'Yoga Deck', 'Rice Terrace Views', 'Fully Staffed'],
        ARRAY['Se aplican reglas de eco-resort: minimiza el uso de plástico.', 'Las visitas a templos locales requieren sarong (provisto en el armario).', 'El personal se retira a las 5:00 PM; disfruta de las tranquilas noches en la selva.'],
        true, false
    ) RETURNING id INTO p4;

    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (p4, 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80', 0);

    -- 5. Apartamento Clásico en Salamanca (Madrid)
    INSERT INTO public.properties (
        host_id, title, description, type, value_rating, location, country, address, 
        latitude, longitude, bedrooms, bathrooms, max_guests, aura_score, amenities, rules, is_published, is_featured
    ) VALUES (
        target_host_id, 'Apartamento Clásico en Salamanca',
        'Un hermoso apartamento histórico en el corazón del exclusivo barrio de Salamanca en Madrid. Techos altos con molduras de yeso detalladas, suelos de roble oscuro en espiga y balcones franceses llenos de luz con vistas a una tranquila calle comercial de boutiques. Colección de arte elegantemente seleccionada.',
        'Apartment', 'Premium', 'Madrid, Salamanca', 'España', 'Calle Claudio Coello 72',
        40.4284, -3.6844, 2, 2, 4, 94.0,
        ARRAY['French Balcony', 'High-Speed Wifi', 'Dyson Airwrap', 'Air Conditioning'],
        ARRAY['Horas de silencio de 10:00 PM a 8:00 AM de acuerdo con las ordenanzas de Madrid.', 'No se permiten sesiones de fotos comerciales sin el acuerdo del anfitrión.', 'Apaga las unidades de aire acondicionado al salir del apartamento.'],
        true, false
    ) RETURNING id INTO p5;

    INSERT INTO public.property_images (property_id, image_url, display_order) VALUES
    (p5, 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80', 0);

    RAISE NOTICE 'Demo data successfully seeded for host ID %', target_host_id;
END;
$$ LANGUAGE plpgsql;
