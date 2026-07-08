import { Property } from '../../types';
import { formatCount } from '../../textHelpers';

export interface EternaProperty extends Property {
  price?: number;
  rating?: number;
}

export const generatePropertySummary = (property: EternaProperty, lang: 'es' | 'en'): string => {
  const t = property.title || 'Propiedad';
  const loc = property.location || 'Destino';
  const c = property.country || '';
  const bedrooms = property.bedrooms || 0;
  const bathrooms = property.bathrooms || 0;
  const isDebtFree = property.legalDebtFree !== false;

  if (lang === 'es') {
    const gravamenText = isDebtFree ? 'libre de gravamen' : 'con gravamen activo';
    const bedText = formatCount(bedrooms, 'habitación', 'habitaciones', 'feminine', true);
    const bathText = formatCount(bathrooms, 'baño', 'baños', 'masculine', true);
    
    return `Estamos en "${t}", ubicada en ${loc} (${c}). Esta exclusiva propiedad cuenta con ${bedText}, ${bathText} y se encuentra ${gravamenText}. ¿Deseas que te explique los detalles de sus características, expediente jurídico o modalidades de adquisición?`;
  } else {
    const gravamenText = isDebtFree ? 'free of liens' : 'subject to active liens';
    const bedText = bedrooms === 1 ? '1 bedroom' : `${bedrooms} bedrooms`;
    const bathText = bathrooms === 1 ? '1 bathroom' : `${bathrooms} bathrooms`;

    return `We are viewing "${t}", located in ${loc} (${c}). This exclusive property features ${bedText}, ${bathText} and is ${gravamenText}. Would you like me to explain the details of its features, legal dossier, or acquisition terms?`;
  }
};

export const resolveLocalPropertyQA = (prompt: string, property: EternaProperty, lang: 'es' | 'en'): string | null => {
  const clean = prompt.toLowerCase().trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!]/g, " ");

  const desc = (property.description || '').toLowerCase();
  const amenities = (property.amenities || []).map(a => a.toLowerCase());

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
