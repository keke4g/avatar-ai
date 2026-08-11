import { Property, PropertyOfferingMode } from '../../types';
import { formatCount, formatPropertyLocation } from '../../textHelpers';
import { formatGooglePlaceName } from '../../maps/placeNames';
import type { NearbyPlace, NearbyPlaceCategory } from '../../maps/types';

export interface EternaProperty extends Property {
  price?: number;
  rating?: number;
}

export interface EternaNearbyHighlight {
  category: NearbyPlaceCategory;
  name: string;
  drivingMinutes: number;
}

export interface EternaPropertyPresentation {
  eyebrow: string;
  headline: string;
  speech: string;
  highlights: string[];
}

const ETERNA_NEARBY_CATEGORY_ORDER: NearbyPlaceCategory[] = [
  'hospital',
  'park',
  'supermarket',
  'school',
];

const hashString = (value: string): number => Array.from(value).reduce(
  (hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0,
  0,
);

const normalizePlacePart = (value?: string | null): string => value?.trim().replace(/\s+/g, ' ') || '';

const getPublicLocationParts = (property: EternaProperty): { neighborhood: string; city: string; location: string } => {
  const locationParts = (property.location || '')
    .split(',')
    .map(normalizePlacePart)
    .filter(Boolean);
  const neighborhood = normalizePlacePart(
    property.neighborhood
      || property.privateNeighborhood
      || property.subdivisionName
      || locationParts[0],
  );
  const city = normalizePlacePart(property.city || locationParts[1]);
  const location = [neighborhood, city]
    .filter((part, index, parts) => (
      part && parts.findIndex((candidate) => candidate.toLocaleLowerCase() === part.toLocaleLowerCase()) === index
    ))
    .join(', ') || formatPropertyLocation(property.location, property.country);

  return { neighborhood, city, location };
};

const getPropertyTypeLabel = (type: Property['type'], lang: 'es' | 'en'): string => {
  const labels: Record<Property['type'], { es: string; en: string }> = {
    Apartment: { es: 'departamento', en: 'apartment' },
    'Beach House': { es: 'casa de playa', en: 'beach house' },
    Cabin: { es: 'cabaña', en: 'cabin' },
    Penthouse: { es: 'penthouse', en: 'penthouse' },
    Villa: { es: 'villa', en: 'villa' },
    Loft: { es: 'loft', en: 'loft' },
  };

  return labels[type]?.[lang] || (lang === 'es' ? 'propiedad' : 'property');
};

const formatSurface = (value: number, lang: 'es' | 'en'): string => (
  lang === 'es'
    ? `${new Intl.NumberFormat('es-MX').format(value)} metros cuadrados`
    : `${new Intl.NumberFormat('en-US').format(value)} square meters`
);

const joinNaturally = (items: string[], conjunction: string): string => {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items.at(-1)}`;
};

const getCommercialHighlight = (property: EternaProperty, lang: 'es' | 'en'): string | null => {
  const activeOffering = property.offerings?.find((offering) => (
    offering.status === 'ACTIVE' && offering.visibility === 'PUBLIC'
  ));
  if (!activeOffering) return null;

  if (activeOffering.priceAmount && activeOffering.priceAmount > 0) {
    const formattedPrice = new Intl.NumberFormat(lang === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: activeOffering.currency || 'MXN',
      maximumFractionDigits: 0,
    }).format(activeOffering.priceAmount);
    const priceLabels: Record<PropertyOfferingMode, { es: string; en: string }> = {
      SALE: {
        es: `un precio de venta de ${formattedPrice}`,
        en: `a sale price of ${formattedPrice}`,
      },
      MONTHLY_RENT: {
        es: `una renta mensual de ${formattedPrice}`,
        en: `a monthly rent of ${formattedPrice}`,
      },
      SHORT_RENT: {
        es: `una tarifa por noche de ${formattedPrice}`,
        en: `a nightly rate of ${formattedPrice}`,
      },
      SWAP: {
        es: `un valor de referencia de ${formattedPrice} para intercambio`,
        en: `a reference value of ${formattedPrice} for exchange`,
      },
    };
    return priceLabels[activeOffering.mode][lang];
  }

  const operationLabels: Record<PropertyOfferingMode, { es: string; en: string }> = {
    SALE: { es: 'Disponible para compra', en: 'Available for sale' },
    SHORT_RENT: { es: 'Disponible para estancias', en: 'Available for short stays' },
    MONTHLY_RENT: { es: 'Disponible para renta mensual', en: 'Available for monthly rent' },
    SWAP: { es: 'Disponible para intercambio', en: 'Available for exchange' },
  };
  return operationLabels[activeOffering.mode][lang];
};

/**
 * Creates a short, factual listing introduction for Eterna. The variant is
 * intentionally external so the UI can rotate the wording on each visit while
 * keeping the function deterministic and testable.
 */
export const buildPropertyPresentation = (
  property: EternaProperty,
  lang: 'es' | 'en',
  visitVariant = 0,
): EternaPropertyPresentation => {
  const title = property.title?.trim() || (lang === 'es' ? 'esta propiedad' : 'this property');
  const { neighborhood, city, location } = getPublicLocationParts(property);
  const propertyType = getPropertyTypeLabel(property.type, lang);
  const isFemininePropertyType = ['casa de playa', 'cabaña', 'villa', 'propiedad'].includes(propertyType);
  const propertyArticle = isFemininePropertyType ? 'una' : 'un';
  const locatedAdjective = isFemininePropertyType ? 'ubicada' : 'ubicado';
  const variantIndex = Math.abs(hashString(`${property.id}:${visitVariant}`)) % 4;
  const roomDetails = [
    property.bedrooms > 0
      ? (lang === 'es'
        ? formatCount(property.bedrooms, 'recámara', 'recámaras', 'feminine', true)
        : `${property.bedrooms} ${property.bedrooms === 1 ? 'bedroom' : 'bedrooms'}`)
      : null,
    property.bathrooms > 0
      ? (lang === 'es'
        ? formatCount(property.bathrooms, 'baño completo', 'baños completos', 'masculine', true)
        : `${property.bathrooms} ${property.bathrooms === 1 ? 'full bathroom' : 'full bathrooms'}`)
      : null,
    property.parkingSpaces !== undefined && property.parkingSpaces !== null && property.parkingSpaces > 0
      ? (lang === 'es'
        ? formatCount(property.parkingSpaces, 'lugar de estacionamiento', 'lugares de estacionamiento', 'masculine', true)
        : `${property.parkingSpaces} ${property.parkingSpaces === 1 ? 'parking space' : 'parking spaces'}`)
      : null,
  ].filter((detail): detail is string => Boolean(detail));
  const surfaceValue = property.surfaceBuilt || property.surfaceTotal;
  const surfaceDetail = surfaceValue && surfaceValue > 0 ? formatSurface(surfaceValue, lang) : null;
  const commercialHighlight = getCommercialHighlight(property, lang);

  const highlights = [
    roomDetails.slice(0, 2).join(' · '),
    surfaceDetail,
    commercialHighlight,
  ].filter((detail): detail is string => Boolean(detail)).slice(0, 3);

  if (lang === 'en') {
    const openings = [
      `Welcome. Let me introduce you to “${title}”, a ${propertyType} in ${location}.`,
      `Picture your next chapter at “${title}”. This ${propertyType} is located in ${location}.`,
      `We have arrived at “${title}”, a ${propertyType} in ${location} that deserves a closer look.`,
      `Let me show you “${title}”, a ${propertyType} set in ${location}.`,
    ];
    const keyDetails = [
      roomDetails.slice(0, 2).length ? joinNaturally(roomDetails.slice(0, 2), 'and') : null,
      surfaceDetail,
      commercialHighlight,
    ].filter((detail): detail is string => Boolean(detail)).slice(0, 2);
    const details = keyDetails.length
      ? `The key details are ${joinNaturally(keyDetails, 'and')}.`
      : '';
    const close = [
      'Would you like to review the location, price, or amenities first?',
      'What would you like to explore first: the neighborhood, the terms, or the photos?',
      'Would you prefer to start with the location or the commercial terms?',
      'Which part would you like me to explain first?',
    ][variantIndex];

    return {
      eyebrow: 'Eterna property tour',
      headline: title,
      highlights,
      speech: [openings[variantIndex], details, close].filter(Boolean).join(' '),
    };
  }

  const locationPhrase = neighborhood && city
    ? `en ${neighborhood}, dentro de ${city}`
    : `en ${location}`;
  const openings = [
    `Bienvenido. Quiero presentarte “${title}”, ${propertyArticle} ${propertyType} ${locatedAdjective} ${locationPhrase}.`,
    `Imagina tu siguiente etapa en “${title}”. Se trata de ${propertyArticle} ${propertyType} ${locatedAdjective} ${locationPhrase}.`,
    `Llegamos a “${title}”, ${propertyArticle} ${propertyType} ${locationPhrase} que vale la pena conocer con calma.`,
    `Déjame mostrarte “${title}”, ${propertyArticle} ${propertyType} con ubicación ${locationPhrase}.`,
  ];
  const keyDetails = [
    roomDetails.slice(0, 2).length ? joinNaturally(roomDetails.slice(0, 2), 'y') : null,
    surfaceDetail,
    commercialHighlight,
  ].filter((detail): detail is string => Boolean(detail)).slice(0, 2);
  const details = keyDetails.length
    ? `Lo esencial: ${joinNaturally(keyDetails, 'y')}.`
    : '';
  const close = [
    '¿Quieres revisar primero la ubicación, el precio o las amenidades?',
    '¿Qué prefieres conocer primero: el entorno, las condiciones o las fotografías?',
    '¿Comenzamos por la ubicación o por las condiciones comerciales?',
    '¿Qué parte te gustaría que te explique primero?',
  ][variantIndex];

  return {
    eyebrow: 'Recorrido con Eterna',
    headline: title,
    highlights,
    speech: [openings[variantIndex], details, close].filter(Boolean).join(' '),
  };
};

const getDrivingMinutes = (place: NearbyPlace): number => {
  if (place.durationSeconds && place.durationSeconds > 0) {
    return Math.max(1, Math.round(place.durationSeconds / 60));
  }

  // Google Routes can occasionally omit a route while Places still returns
  // the destination. Keep Eterna's spoken unit consistent without exposing
  // raw meters by using a conservative urban-driving estimate.
  return Math.max(1, Math.round(place.distanceMeters / 450));
};

/**
 * Gives Eterna a concise neighborhood context: the closest useful place in
 * each category, expressed only as driving time.
 */
export const selectEternaNearbyHighlights = (
  places: NearbyPlace[] = [],
): EternaNearbyHighlight[] => ETERNA_NEARBY_CATEGORY_ORDER.flatMap((category) => {
  const closest = places
    .filter((place) => place.category === category)
    .sort((a, b) => {
      const aDuration = a.durationSeconds || Number.POSITIVE_INFINITY;
      const bDuration = b.durationSeconds || Number.POSITIVE_INFINITY;
      return aDuration - bDuration || a.distanceMeters - b.distanceMeters;
    })[0];

  if (!closest) return [];

  return [{
    category,
    name: formatGooglePlaceName(closest.name),
    drivingMinutes: getDrivingMinutes(closest),
  }];
});

export const generatePropertySummary = (property: EternaProperty, lang: 'es' | 'en'): string => {
  const t = property.title || 'Propiedad';
  const loc = property.location || 'Destino';
  const c = property.country || '';
  const location = formatPropertyLocation(loc, c);

  if (lang === 'es') {
    return `Estás viendo "${t}" en ${location}. Pregúntame lo que quieras: puedo explicarte lo más importante, revisar contigo el precio y sus condiciones, o ayudarte a contactar al responsable cuando estés listo.`;
  } else {
    return `You are viewing "${t}" in ${location}. Ask me anything: I can explain the key details, review the price and terms with you, or help you contact the person responsible when you are ready.`;
  }
};

export const resolveLocalPropertyQA = (prompt: string, property: EternaProperty, lang: 'es' | 'en'): string | null => {
  const clean = prompt.toLowerCase().trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!]/g, " ");

  const desc = (property.description || '').toLowerCase();
  const amenities = (property.amenities || []).map(a => a.toLowerCase());

  const asksAboutNearby = ['escuela', 'colegio', 'supermercado', 'super ', 'hospital', 'clinica', 'parque', 'cerca', 'alrededor', 'zona'].some((keyword) => clean.includes(keyword));
  if (asksAboutNearby && property.nearbyPlaces?.length) {
    const categoryNames = lang === 'es'
      ? { school: 'escuela', supermarket: 'supermercado', hospital: 'hospital', park: 'parque' }
      : { school: 'school', supermarket: 'supermarket', hospital: 'hospital', park: 'park' };
    const requestedCategories = (Object.keys(categoryNames) as Array<keyof typeof categoryNames>).filter((category) => {
      if (category === 'school') return /escuela|colegio|school/.test(clean);
      if (category === 'supermarket') return /supermercado|super |tienda|grocery/.test(clean);
      if (category === 'hospital') return /hospital|clinica|salud/.test(clean);
      return /parque|park/.test(clean);
    });
    const categories = requestedCategories.length ? requestedCategories : (Object.keys(categoryNames) as Array<keyof typeof categoryNames>);
    const selectedPlaces = selectEternaNearbyHighlights(property.nearbyPlaces);
    const highlights = categories.flatMap((category) => {
      const place = selectedPlaces.find((item) => item.category === category);
      if (!place) return [];
      const duration = lang === 'es'
        ? `${place.drivingMinutes} ${place.drivingMinutes === 1 ? 'minuto' : 'minutos'} en auto`
        : `${place.drivingMinutes} ${place.drivingMinutes === 1 ? 'minute' : 'minutes'} by car`;
      return [`${categoryNames[category]}: ${place.name}, a ${duration}`];
    });
    if (highlights.length) {
      return lang === 'es'
        ? `Sí. Según Google Maps, cerca tienes ${highlights.join('; ')}. Puedes verlos marcados en la sección “Ubicación y Entorno”.`
        : `Yes. According to Google Maps, nearby you have ${highlights.join('; ')}. You can see them in “Location & Neighborhood”.`;
    }
  }

  // 1. Wifi queries
  if (clean.includes('wifi') || clean.includes('internet') || clean.includes('conexion')) {
    const hasWifi = amenities.some(a => a.includes('wifi') || a.includes('internet')) || desc.includes('wifi') || desc.includes('internet');
    if (lang === 'es') {
      return hasWifi
        ? "Esta propiedad cuenta con conexión Wi-Fi de alta velocidad para todos los huéspedes."
        : "No se especifica conexión Wi-Fi en los detalles de esta propiedad.";
    } else {
      return hasWifi
        ? "This property features high-speed Wi-Fi connection for all guests."
        : "Wi-Fi connection is not specified in the details of this property.";
    }
  }

  // 2. Air Conditioning queries
  if (clean.includes('aire') || clean.includes('clima') || clean.includes('ac ') || clean.includes('air conditioning') || clean.includes('accond')) {
    const hasAC = amenities.some(a => a.includes('aire') || a.includes('ac') || a.includes('air conditioning') || a.includes('clima')) || desc.includes('aire acondicionado') || desc.includes('air conditioning');
    if (lang === 'es') {
      return hasAC
        ? "Sí, la propiedad está equipada con sistema de aire acondicionado."
        : "Esta propiedad cuenta con ventilación natural, pero no especifica aire acondicionado central.";
    } else {
      return hasAC
        ? "Yes, the property is equipped with air conditioning."
        : "This property features natural ventilation but does not specify central air conditioning.";
    }
  }

  // 3. Pool queries
  if (clean.includes('alberca') || clean.includes('piscina') || clean.includes('pool')) {
    const hasPool = amenities.some(a => a.includes('alberca') || a.includes('piscina') || a.includes('pool')) || desc.includes('alberca') || desc.includes('piscina') || desc.includes('pool');
    if (lang === 'es') {
      return hasPool
        ? "Sí, cuenta con una espectacular alberca de uso exclusivo o compartido."
        : "Esta propiedad no incluye alberca en su listado de características.";
    } else {
      return hasPool
        ? "Yes, it features a spectacular private or shared pool."
        : "This property does not include a pool in its amenities list.";
    }
  }

  // 4. Bathrooms queries
  if (clean.includes('baño') || clean.includes('banos') || clean.includes('bathroom') || clean.includes('restroom')) {
    const baths = property.bathrooms || 1;
    if (lang === 'es') {
      return `La propiedad dispone de ${formatCount(baths, 'baño completo', 'baños completos', 'masculine', true)}.`;
    } else {
      return `The property features ${baths} ${baths === 1 ? 'bathroom' : 'bathrooms'}.`;
    }
  }

  // 5. Rooms/Bedrooms queries
  if (clean.includes('habitacion') || clean.includes('cuarto') || clean.includes('recamara') || clean.includes('dormitorio') || clean.includes('bedroom') || clean.includes('room')) {
    const beds = property.bedrooms || 1;
    if (lang === 'es') {
      return `Cuenta con ${formatCount(beds, 'dormitorio registrado', 'dormitorios registrados', 'masculine', true)}.`;
    } else {
      return `It features ${beds} registered ${beds === 1 ? 'bedroom' : 'bedrooms'}.`;
    }
  }

  // 6. Kitchen queries
  if (clean.includes('cocina') || clean.includes('kitchen')) {
    const hasKitchen = amenities.some(a => a.includes('cocina') || a.includes('kitchen')) || desc.includes('cocina') || desc.includes('kitchen');
    if (lang === 'es') {
      return hasKitchen
        ? "Sí, dispone de cocina totalmente equipada con utensilios y electrodomésticos."
        : "No se especifica equipamiento de cocina en el anuncio.";
    } else {
      return hasKitchen
        ? "Yes, it features a fully equipped kitchen with appliances and utensils."
        : "Kitchen equipment is not specified in the listing.";
    }
  }

  // 7. Dynamic Local QA matching general questions about the active property description
  const checkWhy = getReasonWhy(property, lang);
  if (clean.includes('por que') || clean.includes('por qué') || clean.includes('beneficio') || clean.includes('ventaja') || clean.includes('why should') || clean.includes('why choose')) {
    return checkWhy;
  }

  // Check if keywords from description are mentioned to respond contextually
  const matchesDescKeywords = ['ubicacion', 'zona', 'vista', 'terraza', 'beach', 'view', 'location', 'close'].some(kw => clean.includes(kw));
  if (matchesDescKeywords && desc.length > 20) {
    return lang === 'es'
      ? `Esto es lo que destaca en su descripción: "${property.description?.slice(0, 150)}..."`
      : `Here is what stands out in its description: "${property.description?.slice(0, 150)}..."`;
  }

  return null;
};

const getReasonWhy = (property: EternaProperty, lang: 'es' | 'en'): string => {
  const desc = (property.description || '').toLowerCase();
  const title = (property.title || '').toLowerCase();
  const ams = (property.amenities || []).map(a => a.toLowerCase());
  const hasSeaView = desc.includes('mar') || desc.includes('playa') || desc.includes('ocean') || desc.includes('beach') || 
                      title.includes('mar') || title.includes('playa') || title.includes('ocean') || title.includes('beach') ||
                      ams.some(a => a.includes('sea') || a.includes('ocean') || a.includes('beach') || a.includes('playa'));

  const hasSale = property.offerings?.some(o => o.mode === 'SALE' && o.status === 'ACTIVE');

  if (property.auraScore > 90) {
    return lang === 'es' 
      ? `Es una opción excepcional con un Towers Score de ${property.auraScore}%, lo cual garantiza un alto nivel de confort y excelente reputación.`
      : `It is an exceptional choice with an Towers Score of ${property.auraScore}%, which guarantees high comfort and an excellent reputation.`;
  }

  if (hasSeaView) {
    return lang === 'es'
      ? "Te la recomiendo especialmente por sus hermosas vistas al mar y cercanía a la playa, ideales para una estancia inigualable."
      : "I highly recommend it for its beautiful ocean views and proximity to the beach, ideal for an unparalleled stay.";
  }

  if (hasSale) {
    return lang === 'es'
      ? "Es una excelente oportunidad de inversión inmobiliaria directa en venta (SALE) dentro del catálogo."
      : "It represents an excellent direct real estate investment opportunity listed for sale (SALE) in the catalog.";
  }

  return lang === 'es'
    ? `Te recomiendo "${property.title}" por su excelente ubicación en ${property.location} y una calificación sólida de ${property.rating} estrellas.`
    : `I recommend "${property.title}" for its great location in ${property.location} and a solid rating of ${property.rating} stars.`;
};
