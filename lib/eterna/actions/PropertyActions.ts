import { Property } from '../../types';
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

const ETERNA_NEARBY_CATEGORY_ORDER: NearbyPlaceCategory[] = [
  'hospital',
  'park',
  'supermarket',
  'school',
];

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
      ? `Es una opción excepcional con un Aura Score de ${property.auraScore}%, lo cual garantiza un alto nivel de confort y excelente reputación.`
      : `It is an exceptional choice with an Aura Score of ${property.auraScore}%, which guarantees high comfort and an excellent reputation.`;
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
