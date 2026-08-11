export const PROPERTY_SPACE_OPTIONS = [
  'Cocina integral',
  'Cocina equipada',
  'Cocina con isla',
  'Desayunador',
  'Sala',
  'Comedor',
  'Sala doble altura',
  'Family Room',
  'Sala TV',
  'Biblioteca',
  'Oficina',
  'Estudio',
  'Cuarto de servicio',
  'Cuarto de lavado',
  'Vestidor',
  'Bodega',
  'Bar',
  'Cava',
  'Terraza',
  'Roof Garden',
  'Jardín',
  'Patio',
  'Balcón',
] as const;

export const PRIVATE_AMENITY_OPTIONS = [
  'Alberca',
  'Jacuzzi',
  'Sauna',
  'Asador',
  'Huerto',
  'Cancha',
  'Domótica',
  'Alexa',
  'Cerradura inteligente',
  'Paneles solares',
  'Cargador vehículo eléctrico',
  'Internet fibra óptica',
] as const;

export const SHARED_AMENITY_OPTIONS = [
  'Alberca compartida',
  'Gimnasio',
  'Roof Garden compartido',
  'Terraza común',
  'Jardín común',
  'Salón de usos múltiples',
  'Coworking',
  'Business center',
  'Cinema room',
  'Sports room',
  'Yoga room',
  'Social room',
  'Ludoteca',
  'Game room',
  'Área de juegos infantiles',
  'Pet center',
  'Fire pit',
  'Cancha deportiva compartida',
  'Spa compartido',
  'Estacionamiento para visitas',
  'Elevador',
  'Lobby / recepción',
] as const;

export const PROPERTY_FEATURE_GROUPS = [
  {
    key: 'spaces',
    titleEs: 'Espacios del inmueble',
    titleEn: 'Property spaces',
    descriptionEs: 'Ambientes y áreas que forman parte de la casa o departamento.',
    descriptionEn: 'Rooms and areas that are part of the home or apartment.',
    options: PROPERTY_SPACE_OPTIONS,
  },
  {
    key: 'private',
    titleEs: 'Amenidades privadas y equipamiento',
    titleEn: 'Private amenities & equipment',
    descriptionEs: 'Beneficios de uso exclusivo y tecnología instalada en la propiedad.',
    descriptionEn: 'Exclusive-use features and technology installed in the property.',
    options: PRIVATE_AMENITY_OPTIONS,
  },
  {
    key: 'shared',
    titleEs: 'Amenidades compartidas',
    titleEn: 'Shared amenities',
    descriptionEs: 'Servicios comunes del condominio, edificio o desarrollo.',
    descriptionEn: 'Common facilities provided by the building, community, or development.',
    options: SHARED_AMENITY_OPTIONS,
  },
] as const;

export const AMENITY_OPTIONS = PROPERTY_FEATURE_GROUPS.flatMap((group) => [...group.options]);

export function groupPropertyFeatures(features: string[]) {
  const remaining = new Set(features);
  const groups = PROPERTY_FEATURE_GROUPS.map((group) => {
    const options = new Set<string>(group.options);
    const values = features.filter((feature) => options.has(feature));
    values.forEach((value) => remaining.delete(value));
    return { ...group, values };
  });

  return {
    groups,
    other: Array.from(remaining),
  };
}
