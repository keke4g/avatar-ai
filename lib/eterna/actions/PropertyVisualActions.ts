import type { EternaPropertyVisualSection } from '../events';
import type { Property, PropertyOffering } from '../../types';
import type { NearbyPlaceCategory } from '../../maps/types';
import { formatBathrooms, formatCount, formatPropertyLocation } from '../../textHelpers';
import {
  buildPropertyPresentation,
  selectEternaNearbyHighlights,
  type EternaProperty,
} from './PropertyActions';

export interface PropertyVisualAnswer {
  reply: string;
  speech: string;
  suggestedReplies: string[];
}

interface ResolvePropertyVisualAnswerOptions {
  language: 'es' | 'en';
  prompt: string;
  property: EternaProperty;
  section: EternaPropertyVisualSection;
}

const getPublishedOfferings = (property: Property): PropertyOffering[] => (
  (property.offerings || []).filter((offering) => (
    offering.status === 'ACTIVE' && offering.visibility === 'PUBLIC'
  ))
);

const formatMoney = (amount: number, currency: string, language: 'es' | 'en'): string => {
  try {
    return new Intl.NumberFormat(language === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency: currency || 'MXN',
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${Math.round(amount).toLocaleString(language === 'es' ? 'es-MX' : 'en-US')} ${currency || 'MXN'}`;
  }
};

const joinNaturally = (items: string[], language: 'es' | 'en'): string => {
  if (items.length <= 1) return items[0] || '';
  const conjunction = language === 'es' ? 'y' : 'and';
  return `${items.slice(0, -1).join(', ')} ${conjunction} ${items.at(-1)}`;
};

const cleanDescription = (value: string | null | undefined): string => {
  const compact = (value || '').replace(/\s+/g, ' ').trim();
  if (compact.length <= 320) return compact;
  const shortened = compact.slice(0, 317);
  const lastBoundary = Math.max(shortened.lastIndexOf('. '), shortened.lastIndexOf(', '), shortened.lastIndexOf(' '));
  return `${shortened.slice(0, Math.max(180, lastBoundary)).trim()}…`;
};

const normalizePrompt = (value: string): string => value
  .toLocaleLowerCase('es-MX')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const NEARBY_CATEGORY_REQUESTS: Array<{
  category: NearbyPlaceCategory;
  pattern: RegExp;
}> = [
  { category: 'school', pattern: /\b(?:escuela|escuelas|colegio|colegios|school|schools)\b/ },
  { category: 'supermarket', pattern: /\b(?:supermercado|supermercados|tienda|tiendas|grocery|groceries|supermarket|supermarkets)\b/ },
  { category: 'hospital', pattern: /\b(?:hospital|hospitales|clinica|clinicas|salud|hospital|hospitals|clinic|clinics|healthcare)\b/ },
  { category: 'park', pattern: /\b(?:parque|parques|areas verdes|park|parks|green areas)\b/ },
];

const getRequestedNearbyCategories = (prompt: string): NearbyPlaceCategory[] => {
  const normalized = normalizePrompt(prompt);
  const explicit = NEARBY_CATEGORY_REQUESTS
    .filter(({ pattern }) => pattern.test(normalized))
    .map(({ category }) => category);

  if (explicit.length > 0) return explicit;
  if (/\b(?:servicios|service|services)\b/.test(normalized)) {
    return ['supermarket', 'hospital'];
  }
  if (/\b(?:que hay cerca|lugares cercanos|alrededores|around here|nearby places)\b/.test(normalized)) {
    return ['school', 'supermarket', 'hospital', 'park'];
  }
  return [];
};

const getNearbyCategoryLabel = (
  category: NearbyPlaceCategory,
  language: 'es' | 'en',
): string => {
  const labels: Record<NearbyPlaceCategory, { es: string; en: string }> = {
    school: { es: 'escuelas', en: 'schools' },
    supermarket: { es: 'supermercados', en: 'supermarkets' },
    hospital: { es: 'hospitales', en: 'hospitals' },
    park: { es: 'parques', en: 'parks' },
  };
  return labels[category][language];
};

const getAmenityExperience = (
  amenity: string,
  language: 'es' | 'en',
): string => {
  const normalized = normalizePrompt(amenity);
  const copy = language === 'es'
    ? [
        { pattern: /\b(?:sala|living|estancia)\b/, text: `${amenity} favorece momentos cómodos de convivencia y descanso` },
        { pattern: /\b(?:comedor|dining)\b/, text: `${amenity} crea un lugar natural para compartir comidas y conversaciones` },
        { pattern: /\b(?:cocina|kitchen|isla)\b/, text: `${amenity} hace más práctica la rutina diaria y puede convertirse en un punto de reunión` },
        { pattern: /\b(?:balcon|terraza|roof garden|azotea|patio)\b/, text: `${amenity} ofrece una pausa al aire libre y una sensación de mayor amplitud` },
        { pattern: /\b(?:jardin|garden)\b/, text: `${amenity} aporta contacto con el exterior y un ambiente más sereno` },
        { pattern: /\b(?:lavado|lavanderia|laundry)\b/, text: `${amenity} ayuda a mantener la rutina doméstica ordenada y fuera de las áreas sociales` },
        { pattern: /\b(?:alberca|piscina|pool)\b/, text: `${amenity} invita a relajarse y disfrutar momentos de recreación sin salir del entorno residencial` },
        { pattern: /\b(?:gimnasio|gym)\b/, text: `${amenity} facilita integrar bienestar y actividad física a la vida diaria` },
        { pattern: /\b(?:seguridad|vigilancia|control de acceso|privada)\b/, text: `${amenity} aporta tranquilidad y mayor control en los accesos` },
        { pattern: /\b(?:estacionamiento|cochera|garage|parking)\b/, text: `${amenity} hace más cómoda y ordenada la llegada a casa` },
        { pattern: /\b(?:estudio|oficina|workspace)\b/, text: `${amenity} brinda un espacio separado para concentrarse, trabajar o estudiar` },
        { pattern: /\b(?:aire acondicionado|minisplit|climatizacion)\b/, text: `${amenity} ayuda a conservar una temperatura agradable durante el día` },
        { pattern: /\b(?:elevador|ascensor|elevator)\b/, text: `${amenity} mejora la accesibilidad y simplifica los desplazamientos cotidianos` },
        { pattern: /\b(?:bodega|almacenamiento|closet|vestidor)\b/, text: `${amenity} facilita mantener los espacios despejados y bien organizados` },
        { pattern: /\b(?:vista|ocean view|city view)\b/, text: `${amenity} suma luz, perspectiva y una experiencia visual más agradable` },
        { pattern: /\b(?:amueblado|amueblada|muebles|furnished)\b/, text: `${amenity} permite imaginar una instalación más sencilla y con menos pendientes iniciales` },
        { pattern: /\b(?:mascota|pet friendly|pets)\b/, text: `${amenity} hace más fácil integrar a las mascotas en la vida cotidiana` },
      ]
    : [
        { pattern: /\b(?:sala|living|estancia)\b/, text: `${amenity} creates a comfortable setting for connection and rest` },
        { pattern: /\b(?:comedor|dining)\b/, text: `${amenity} provides a natural place for shared meals and conversation` },
        { pattern: /\b(?:cocina|kitchen|isla)\b/, text: `${amenity} makes everyday routines easier and can become a social hub` },
        { pattern: /\b(?:balcon|terraza|roof garden|azotea|patio)\b/, text: `${amenity} offers an outdoor pause and a greater sense of openness` },
        { pattern: /\b(?:jardin|garden)\b/, text: `${amenity} adds a calmer connection with the outdoors` },
        { pattern: /\b(?:lavado|lavanderia|laundry)\b/, text: `${amenity} keeps household routines organized and away from social areas` },
        { pattern: /\b(?:alberca|piscina|pool)\b/, text: `${amenity} encourages relaxation and recreation within the residential setting` },
        { pattern: /\b(?:gimnasio|gym)\b/, text: `${amenity} makes daily wellness and exercise more convenient` },
        { pattern: /\b(?:seguridad|vigilancia|control de acceso|privada)\b/, text: `${amenity} adds peace of mind and greater access control` },
        { pattern: /\b(?:estacionamiento|cochera|garage|parking)\b/, text: `${amenity} makes arriving home easier and more orderly` },
        { pattern: /\b(?:estudio|oficina|workspace)\b/, text: `${amenity} provides a dedicated place to focus, work, or study` },
        { pattern: /\b(?:aire acondicionado|minisplit|climatizacion)\b/, text: `${amenity} helps maintain a comfortable indoor temperature` },
        { pattern: /\b(?:elevador|ascensor|elevator)\b/, text: `${amenity} improves accessibility and everyday movement` },
        { pattern: /\b(?:bodega|almacenamiento|closet|vestidor)\b/, text: `${amenity} helps keep living areas clear and organized` },
        { pattern: /\b(?:vista|ocean view|city view)\b/, text: `${amenity} adds light, perspective, and a more enjoyable outlook` },
        { pattern: /\b(?:amueblado|amueblada|muebles|furnished)\b/, text: `${amenity} can make moving in simpler with fewer initial decisions` },
        { pattern: /\b(?:mascota|pet friendly|pets)\b/, text: `${amenity} makes it easier to include pets in everyday life` },
      ];

  return copy.find(({ pattern }) => pattern.test(normalized))?.text
    || (language === 'es'
      ? `${amenity} aporta funcionalidad y hace más cómoda la experiencia cotidiana`
      : `${amenity} adds practical value and makes everyday living more comfortable`);
};

const answer = (
  reply: string,
  suggestedReplies: string[],
  speech = reply,
): PropertyVisualAnswer => ({ reply, speech, suggestedReplies });

const formatSurface = (value: number, language: 'es' | 'en'): string => (
  new Intl.NumberFormat(language === 'es' ? 'es-MX' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(value)
);

const getTechnicalFacts = (property: Property, language: 'es' | 'en'): string[] => {
  if (language === 'en') {
    return [
      property.bedrooms > 0 ? `${property.bedrooms} ${property.bedrooms === 1 ? 'bedroom' : 'bedrooms'}` : null,
      property.bathrooms > 0 || (property.halfBathrooms || 0) > 0
        ? formatBathrooms(property.bathrooms, property.halfBathrooms, language)
        : null,
      property.surfaceBuilt ? `${formatSurface(property.surfaceBuilt, language)} square meters of construction` : null,
      property.surfaceTotal ? `${formatSurface(property.surfaceTotal, language)} square meters of land` : null,
      property.parkingSpaces ? `${property.parkingSpaces} parking ${property.parkingSpaces === 1 ? 'space' : 'spaces'}` : null,
      property.levelsCount ? `${property.levelsCount} ${property.levelsCount === 1 ? 'level' : 'levels'}` : null,
    ].filter((item): item is string => Boolean(item));
  }

  return [
    property.bedrooms > 0 ? formatCount(property.bedrooms, 'recámara', 'recámaras', 'feminine') : null,
    property.bathrooms > 0 || (property.halfBathrooms || 0) > 0
      ? formatBathrooms(property.bathrooms, property.halfBathrooms, language)
      : null,
    property.surfaceBuilt ? `${formatSurface(property.surfaceBuilt, language)} metros cuadrados de construcción` : null,
    property.surfaceTotal ? `${formatSurface(property.surfaceTotal, language)} metros cuadrados de terreno` : null,
    property.parkingSpaces ? formatCount(property.parkingSpaces, 'lugar de estacionamiento', 'lugares de estacionamiento', 'masculine') : null,
    property.levelsCount ? formatCount(property.levelsCount, 'nivel', 'niveles', 'masculine') : null,
  ].filter((item): item is string => Boolean(item));
};

const getFinancingMethods = (offerings: PropertyOffering[], language: 'es' | 'en'): string[] => {
  const methods = new Set<string>();
  offerings.forEach((offering) => {
    if (offering.acceptsCash) methods.add(language === 'es' ? 'recursos propios' : 'cash');
    if (offering.acceptsBankCredit) methods.add(language === 'es' ? 'crédito bancario' : 'bank financing');
    if (offering.acceptsInfonavit) methods.add('Infonavit');
    if (offering.acceptsFovissste) methods.add('Fovissste');
    if (offering.developerFinancing) methods.add(language === 'es' ? 'financiamiento del desarrollador' : 'developer financing');
  });
  return [...methods];
};

const getLegalFacts = (property: Property, language: 'es' | 'en'): string[] => {
  const facts: string[] = [];
  const pushEvidence = (
    value: boolean | null | undefined,
    positiveEs: string,
    negativeEs: string,
    positiveEn: string,
    negativeEn: string,
  ) => {
    if (value === true) facts.push(language === 'es' ? positiveEs : positiveEn);
    if (value === false) facts.push(language === 'es' ? negativeEs : negativeEn);
  };

  pushEvidence(property.legalDebtFree, 'libre de gravamen', 'con gravamen reportado', 'debt-free title', 'an active lien is reported');
  pushEvidence(property.legalPublicDeed, 'escritura pública confirmada', 'escritura pendiente o no confirmada', 'public deed confirmed', 'public deed pending or not confirmed');
  pushEvidence(property.legalTaxCurrent, 'predial al corriente', 'predial pendiente', 'property tax current', 'property tax pending');
  pushEvidence(property.legalServicesPaid, 'servicios al corriente', 'servicios pendientes', 'utilities current', 'utilities pending');
  pushEvidence(property.legalDocumentationComplete, 'expediente documental completo', 'expediente documental incompleto', 'complete document file', 'incomplete document file');
  return facts;
};

const getOfferingDescription = (offering: PropertyOffering, language: 'es' | 'en'): string => {
  const mode = language === 'es'
    ? ({ SALE: 'venta', MONTHLY_RENT: 'renta mensual', SHORT_RENT: 'renta por noche', SWAP: 'intercambio' } as const)[offering.mode]
    : ({ SALE: 'sale', MONTHLY_RENT: 'monthly rent', SHORT_RENT: 'nightly stay', SWAP: 'swap' } as const)[offering.mode];
  const price = offering.priceAmount && offering.priceAmount > 0
    ? formatMoney(offering.priceAmount, offering.currency, language)
    : (language === 'es' ? 'precio a consultar' : 'price on request');
  return `${mode}: ${price}`;
};

export function resolvePropertyVisualAnswer({
  language,
  prompt,
  property,
  section,
}: ResolvePropertyVisualAnswerOptions): PropertyVisualAnswer | null {
  const isSpanish = language === 'es';
  const offerings = getPublishedOfferings(property);

  if (section === 'summary') {
    const presentation = buildPropertyPresentation(property, language, 0);
    return answer(
      presentation.speech,
      isSpanish ? ['Ver amenidades', 'Ver ubicación', 'Revisar precio'] : ['View amenities', 'View location', 'Review price'],
    );
  }

  if (section === 'description') {
    const description = cleanDescription(property.aiSummary || property.description);
    const reply = description
      ? (isSpanish
          ? `${description} La información mostrada proviene directamente del anuncio publicado. ¿Quieres que ahora revisemos sus amenidades o la ficha técnica?`
          : `${description} The information shown comes directly from the published listing. Would you like to review its amenities or technical profile next?`)
      : (isSpanish
          ? `El responsable todavía no ha publicado una descripción detallada. No voy a completar esos datos con suposiciones. ¿Quieres revisar la ficha técnica o las fotografías disponibles?`
          : `The representative has not published a detailed description yet. I will not fill those gaps with assumptions. Would you like to review the technical profile or available photos?`);
    return answer(reply, isSpanish ? ['Ver amenidades', 'Ver ficha técnica'] : ['View amenities', 'View technical profile']);
  }

  if (section === 'amenities') {
    const amenityMap = new Map<string, string>();
    [
      ...(property.amenities || []),
      ...((property.metadata?.customAmenities as string[] | undefined) || []),
    ].map((item) => item.trim()).filter(Boolean).forEach((amenity) => {
      amenityMap.set(normalizePrompt(amenity), amenity);
    });
    const normalizedRequest = normalizePrompt(prompt);
    const amenities = [...amenityMap.values()].sort((left, right) => {
      const leftRequested = normalizedRequest.includes(normalizePrompt(left)) ? 1 : 0;
      const rightRequested = normalizedRequest.includes(normalizePrompt(right)) ? 1 : 0;
      return rightRequested - leftRequested;
    });
    if (amenities.length === 0) {
      return answer(
        isSpanish
          ? `Este anuncio todavía no tiene amenidades verificadas publicadas. Prefiero decírtelo claramente antes que asumir equipamiento que quizá no existe. ¿Quieres que revisemos la descripción o la ficha técnica?`
          : `This listing does not yet include published, verified amenities. I would rather say that clearly than assume features that may not exist. Would you like to review the description or technical profile?`,
        isSpanish ? ['Ver descripción', 'Ver ficha técnica'] : ['View description', 'View technical profile'],
      );
    }
    const experientialAmenities = amenities.slice(0, 3).map((amenity) => (
      getAmenityExperience(amenity, language)
    ));
    const remaining = amenities.length - experientialAmenities.length;
    return answer(
      isSpanish
        ? `Más que una lista de equipamiento: ${joinNaturally(experientialAmenities, language)}.${remaining > 0 ? ` La ficha muestra ${remaining} ${remaining === 1 ? 'amenidad adicional' : 'amenidades adicionales'} para completar la experiencia.` : ''} Todo lo mencionado está confirmado en el anuncio. ¿Cuál de estos espacios te gustaría imaginar en tu rutina diaria?`
        : `More than a feature list: ${joinNaturally(experientialAmenities, language)}.${remaining > 0 ? ` The listing shows ${remaining} additional ${remaining === 1 ? 'amenity' : 'amenities'} to complete the experience.` : ''} Every feature mentioned is confirmed in the listing. Which of these spaces would you like to picture in your daily routine?`,
      isSpanish ? ['Ver ficha técnica', 'Ver fotos'] : ['View technical profile', 'View photos'],
    );
  }

  if (section === 'technical') {
    const facts = getTechnicalFacts(property, language);
    return answer(
      facts.length > 0
        ? (isSpanish
            ? `Los datos principales publicados son ${joinNaturally(facts, language)}. La ficha también separa superficies, servicios y seguridad para que puedas verificarlos con calma. ¿Quieres que profundicemos en el tamaño, los servicios o la distribución?`
            : `The main published details are ${joinNaturally(facts, language)}. The profile also separates surfaces, utilities, and security so you can verify them carefully. Would you like to focus on size, services, or layout?`)
        : (isSpanish
            ? `La ficha técnica todavía no contiene medidas o distribución suficientes para explicarlas con precisión. No completaré esos espacios con estimaciones. ¿Quieres revisar la descripción o contactar al responsable?`
            : `The technical profile does not yet contain enough measurements or layout details for a precise explanation. I will not fill those gaps with estimates. Would you like to review the description or contact the representative?`),
      isSpanish ? ['Revisar amenidades', 'Ver contacto'] : ['Review amenities', 'View contact'],
    );
  }

  if (section === 'gallery') {
    const photoCount = property.images?.length || 0;
    return answer(
      photoCount > 0
        ? (isSpanish
            ? `La galería contiene ${photoCount} ${photoCount === 1 ? 'fotografía publicada' : 'fotografías publicadas'}. Puedes tocar cualquier imagen para verla en grande y deslizar hacia los lados para recorrerlas. ¿Quieres que después revisemos la distribución o las amenidades que aparecen en las fotos?`
            : `The gallery contains ${photoCount} published ${photoCount === 1 ? 'photo' : 'photos'}. Tap any image to enlarge it and swipe sideways to browse. Would you like to review the layout or the amenities visible in the photos afterward?`)
        : (isSpanish
            ? `Esta propiedad todavía no tiene fotografías publicadas. No mostraré imágenes genéricas como si fueran del inmueble. ¿Quieres revisar su descripción o contactar al responsable?`
            : `This property does not have published photos yet. I will not show generic images as if they belonged to the listing. Would you like to review its description or contact the representative?`),
      isSpanish ? ['Ver amenidades', 'Ver ficha técnica'] : ['View amenities', 'View technical profile'],
    );
  }

  if (section === 'media') {
    const media = property.media || [];
    const videos = media.filter((item) => ['VIDEO', 'YOUTUBE', 'VIMEO', 'DRONE'].includes(item.mediaType)).length;
    const tours = media.filter((item) => ['MATTERPORT', 'VIRTUAL_TOUR'].includes(item.mediaType)).length;
    const plans = media.filter((item) => item.mediaType === 'FLOORPLAN').length;
    const available = [
      videos ? (isSpanish ? `${videos} ${videos === 1 ? 'video' : 'videos'}` : `${videos} ${videos === 1 ? 'video' : 'videos'}`) : null,
      tours ? (isSpanish ? `${tours} ${tours === 1 ? 'recorrido virtual' : 'recorridos virtuales'}` : `${tours} virtual ${tours === 1 ? 'tour' : 'tours'}`) : null,
      plans ? (isSpanish ? `${plans} ${plans === 1 ? 'plano' : 'planos'}` : `${plans} floor ${plans === 1 ? 'plan' : 'plans'}`) : null,
    ].filter((item): item is string => Boolean(item));
    return answer(
      available.length > 0
        ? (isSpanish
            ? `El expediente multimedia incluye ${joinNaturally(available, language)}, disponibles para revisarlos directamente en pantalla. ¿Quieres reproducir el video o prefieres abrir primero la galería de fotografías?`
            : `The media file includes ${joinNaturally(available, language)}, ready to review directly on screen. Would you like to play the video or open the photo gallery first?`)
        : (isSpanish
            ? `Todavía no hay videos, recorridos virtuales ni planos publicados. La galería de fotos y la ficha técnica siguen disponibles para revisar el inmueble. ¿Cuál de esas dos prefieres abrir?`
            : `No videos, virtual tours, or floor plans have been published yet. The photo gallery and technical profile are still available. Which would you prefer to open?`),
      isSpanish ? ['Ver fotos', 'Ver ficha técnica'] : ['View photos', 'View technical profile'],
    );
  }

  if (section === 'location') {
    const publicLocation = formatPropertyLocation(property.location, property.country);
    const allNearby = selectEternaNearbyHighlights(property.nearbyPlaces || []);
    const requestedCategories = getRequestedNearbyCategories(prompt);

    if (requestedCategories.length > 0) {
      const requestedHighlights = requestedCategories.flatMap((category) => {
        const place = allNearby.find((candidate) => candidate.category === category);
        if (!place) return [];
        return [{ ...place, categoryLabel: getNearbyCategoryLabel(category, language) }];
      });
      const missingCategories = requestedCategories
        .filter((category) => !requestedHighlights.some((place) => place.category === category))
        .map((category) => getNearbyCategoryLabel(category, language));
      const facts = requestedHighlights.map((place) => (
        isSpanish
          ? `${place.categoryLabel}: ${place.name}, a ${place.drivingMinutes} ${place.drivingMinutes === 1 ? 'minuto' : 'minutos'} en auto`
          : `${place.categoryLabel}: ${place.name}, ${place.drivingMinutes} ${place.drivingMinutes === 1 ? 'minute' : 'minutes'} by car`
      ));

      return answer(
        facts.length > 0
          ? (isSpanish
              ? `Encontré ${facts.length === 1 ? 'esta referencia cercana verificada' : 'estas referencias cercanas verificadas'}: ${joinNaturally(facts, language)}. ${missingCategories.length > 0 ? `Todavía no hay un dato confirmado para ${joinNaturally(missingCategories, language)}. ` : ''}El mapa permanece abierto para que puedas ubicar cada punto y valorar el traslado con contexto. ¿Quieres que comparemos otra categoría cercana?`
              : `I found ${facts.length === 1 ? 'this verified nearby reference' : 'these verified nearby references'}: ${joinNaturally(facts, language)}. ${missingCategories.length > 0 ? `There is not yet a confirmed result for ${joinNaturally(missingCategories, language)}. ` : ''}The map remains open so you can locate each place and assess the trip in context. Would you like to compare another nearby category?`)
          : (isSpanish
              ? `En los datos actuales no aparece una referencia verificada para ${joinNaturally(missingCategories, language)}. Prefiero no inventar un lugar o un tiempo de traslado; el mapa permanece disponible para revisar visualmente el entorno publicado. ¿Quieres consultar otra categoría cercana?`
              : `The current data does not include a verified reference for ${joinNaturally(missingCategories, language)}. I would rather not invent a place or travel time; the map remains available to review the published area visually. Would you like to check another nearby category?`),
        isSpanish
          ? ['Hospitales cercanos', 'Escuelas cercanas', 'Supermercados cercanos', 'Parques cercanos']
          : ['Nearby hospitals', 'Nearby schools', 'Nearby supermarkets', 'Nearby parks'],
      );
    }

    const nearby = allNearby.slice(0, 3);
    const nearbyText = nearby.map((place) => (
      isSpanish
        ? `${place.name}, a ${place.drivingMinutes} ${place.drivingMinutes === 1 ? 'minuto' : 'minutos'} en auto`
        : `${place.name}, ${place.drivingMinutes} ${place.drivingMinutes === 1 ? 'minute' : 'minutes'} by car`
    ));
    return answer(
      isSpanish
        ? `La propiedad se ubica en ${publicLocation}. ${nearbyText.length ? `Como referencias cercanas verificadas aparecen ${joinNaturally(nearbyText, language)}.` : 'El mapa permite explorar la zona publicada sin revelar una dirección que el anunciante haya decidido mantener privada.'} ¿Quieres que revisemos escuelas, servicios o tiempos de traslado?`
        : `The property is located in ${publicLocation}. ${nearbyText.length ? `Verified nearby references include ${joinNaturally(nearbyText, language)}.` : 'The map lets you explore the published area without revealing an address the advertiser chose to keep private.'} Would you like to review schools, services, or travel times?`,
      isSpanish ? ['Escuelas cercanas', 'Servicios cercanos'] : ['Nearby schools', 'Nearby services'],
    );
  }

  if (section === 'financing') {
    const methods = getFinancingMethods(offerings, language);
    return answer(
      methods.length > 0
        ? (isSpanish
            ? `El anunciante indicó que considera ${joinNaturally(methods, language)}; esto describe opciones posibles, no una aprobación crediticia. La elegibilidad final depende del inmueble, el expediente y la institución. ¿Quieres que calculemos una mensualidad o revisar primero el precio?`
            : `The advertiser indicated ${joinNaturally(methods, language)} may be considered; these are possible options, not credit approval. Final eligibility depends on the property, the file, and the institution. Would you like to calculate a monthly payment or review the price first?`)
        : (isSpanish
            ? `El anuncio no confirma métodos de pago específicos. Eso no significa que un crédito esté rechazado; simplemente requiere validación con el responsable y la institución. ¿Quieres abrir el simulador de mensualidad o contactar al anunciante?`
            : `The listing does not confirm specific payment methods. That does not mean financing is rejected; it requires validation with the representative and lender. Would you like to open the monthly payment simulator or contact the advertiser?`),
      isSpanish ? ['Calcular mensualidad', 'Revisar precio'] : ['Calculate payment', 'Review price'],
    );
  }

  if (section === 'commercial') {
    const descriptions = offerings.map((offering) => getOfferingDescription(offering, language));
    return answer(
      descriptions.length > 0
        ? (isSpanish
            ? `Las modalidades públicas actuales son ${joinNaturally(descriptions, language)}. En pantalla también puedes confirmar si el precio es negociable o si se aceptan ofertas. ¿Quieres revisar financiamiento, calcular una mensualidad o contactar al responsable?`
            : `The current public modes are ${joinNaturally(descriptions, language)}. On screen you can also confirm whether the price is negotiable or offers are accepted. Would you like to review financing, calculate a payment, or contact the representative?`)
        : (isSpanish
            ? `Esta ficha no tiene una modalidad pública activa con precio confirmado. Prefiero no convertir datos incompletos en una cifra. ¿Quieres contactar al responsable o revisar otra sección?`
            : `This listing does not have an active public mode with a confirmed price. I would rather not turn incomplete data into a figure. Would you like to contact the representative or review another section?`),
      isSpanish ? ['Ver financiamiento', 'Ver contacto'] : ['View financing', 'View contact'],
    );
  }

  if (section === 'legal') {
    const facts = getLegalFacts(property, language);
    return answer(
      facts.length > 0
        ? (isSpanish
            ? `El expediente publicado indica ${joinNaturally(facts, language)}. Estos datos ayudan a preparar la revisión, pero no sustituyen la validación notarial ni los documentos originales. ¿Quieres revisar algún punto legal o contactar al responsable?`
            : `The published file indicates ${joinNaturally(facts, language)}. These details help prepare due diligence but do not replace notarial review or original documents. Would you like to review a legal point or contact the representative?`)
        : (isSpanish
            ? `Todavía no hay verificaciones legales publicadas suficientes. Eterna no interpretará la ausencia de datos como una aprobación. ¿Quieres contactar al responsable para solicitar el expediente?`
            : `There are not enough published legal verifications yet. Eterna will not interpret missing data as approval. Would you like to contact the representative to request the file?`),
      isSpanish ? ['Ver contacto', 'Revisar precio'] : ['View contact', 'Review price'],
    );
  }

  if (section === 'contact') {
    const responsible = property.brokerProfile?.name || property.hostName;
    return answer(
      responsible
        ? (isSpanish
            ? `La publicación está a cargo de ${responsible}${property.hostVerified ? ', con perfil verificado' : ''}; en pantalla aparecen únicamente los canales autorizados para contacto. ¿Quieres enviar un mensaje o prefieres seguir revisando la propiedad antes?`
            : `The listing is managed by ${responsible}${property.hostVerified ? ', with a verified profile' : ''}; only authorized contact channels appear on screen. Would you like to send a message or keep reviewing the property first?`)
        : (isSpanish
            ? `El anuncio todavía no muestra un responsable público con canales disponibles. No expondré datos privados para completar esa ausencia. ¿Quieres revisar otra sección mientras se actualiza la ficha?`
            : `The listing does not yet show a public representative with available channels. I will not expose private information to fill that gap. Would you like to review another section while the listing is updated?`),
      isSpanish ? ['Enviar mensaje', 'Ver ubicación'] : ['Send a message', 'View location'],
    );
  }

  if (section === 'valuation' || section === 'market') {
    const valuation = property.valuation;
    const strictValue = valuation?.evidenceTier === 'STRICT_ESTIMATE' ? valuation.estimatedSaleValue : null;
    const areaReference = valuation?.evidenceTier === 'AREA_REFERENCE' ? valuation.areaReferenceValue : null;
    const sourceCount = valuation?.sourceLabels?.length || 0;
    return answer(
      strictValue
        ? (isSpanish
            ? `El valor central calculado es ${formatMoney(strictValue, valuation?.currency || 'MXN', language)}, sustentado en ${valuation?.comparableCount || 0} comparables y ${sourceCount || 'las'} fuentes documentadas. Es una referencia automatizada, no un avalúo oficial. ¿Quieres revisar el rango o los comparables?`
            : `The calculated central value is ${formatMoney(strictValue, valuation?.currency || 'MXN', language)}, supported by ${valuation?.comparableCount || 0} comparables and ${sourceCount || 'documented'} sources. It is an automated reference, not an official appraisal. Would you like to review the range or comparables?`)
        : areaReference
          ? (isSpanish
              ? `El precio central aproximado es ${formatMoney(areaReference, valuation?.currency || 'MXN', language)} y en pantalla puedes ver si el precio publicado está bajo, dentro o arriba del rango. Se basa en anuncios comparables y no sustituye un avalúo. ¿Quieres que te explique el rango?`
              : `The approximate central price is ${formatMoney(areaReference, valuation?.currency || 'MXN', language)}, and the screen shows whether the listing is below, within, or above the range. It is based on comparable listings and does not replace an appraisal. Would you like me to explain the range?`)
          : (isSpanish
              ? `Esta propiedad todavía no reúne comparables suficientes para publicar una estimación responsable. La cifra permanece oculta para evitar una falsa precisión. ¿Quieres revisar el precio anunciado o la metodología?`
              : `This property does not yet have enough comparables for a responsible estimate. The figure remains hidden to avoid false precision. Would you like to review the asking price or methodology?`),
      isSpanish ? ['Ver comparables', 'Revisar precio'] : ['View comparables', 'Review price'],
    );
  }

  if (section === 'mortgage') {
    return answer(
      isSpanish
        ? `Puedes ajustar enganche, plazo y tasa para ver cómo cambia la mensualidad; el resultado es orientativo y no incluye seguros, comisiones ni una aprobación bancaria. ¿Qué dato quieres modificar primero?`
        : `You can adjust down payment, term, and rate to see how the monthly payment changes; the result is indicative and excludes insurance, fees, and bank approval. Which value would you like to change first?`,
      isSpanish ? ['Cambiar enganche', 'Cambiar plazo'] : ['Change down payment', 'Change term'],
    );
  }

  // Keep the prompt in the signature so future section-specific refinements
  // can remain deterministic without adding another model round trip.
  void prompt;
  return null;
}
