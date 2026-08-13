import type { EternaPropertyVisualSection } from '../events';
import type { Property, PropertyOffering } from '../../types';
import { formatPropertyLocation } from '../../textHelpers';
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

const answer = (
  reply: string,
  suggestedReplies: string[],
  speech = reply,
): PropertyVisualAnswer => ({ reply, speech, suggestedReplies });

const getTechnicalFacts = (property: Property, language: 'es' | 'en'): string[] => {
  if (language === 'en') {
    return [
      property.bedrooms > 0 ? `${property.bedrooms} ${property.bedrooms === 1 ? 'bedroom' : 'bedrooms'}` : null,
      property.bathrooms > 0 ? `${property.bathrooms} full ${property.bathrooms === 1 ? 'bathroom' : 'bathrooms'}` : null,
      property.halfBathrooms ? `${property.halfBathrooms} half ${property.halfBathrooms === 1 ? 'bathroom' : 'bathrooms'}` : null,
      property.surfaceBuilt ? `${property.surfaceBuilt} square meters of construction` : null,
      property.surfaceTotal ? `${property.surfaceTotal} square meters of land` : null,
      property.parkingSpaces ? `${property.parkingSpaces} parking ${property.parkingSpaces === 1 ? 'space' : 'spaces'}` : null,
      property.levelsCount ? `${property.levelsCount} ${property.levelsCount === 1 ? 'level' : 'levels'}` : null,
    ].filter((item): item is string => Boolean(item));
  }

  return [
    property.bedrooms > 0 ? `${property.bedrooms} ${property.bedrooms === 1 ? 'recámara' : 'recámaras'}` : null,
    property.bathrooms > 0 ? `${property.bathrooms} ${property.bathrooms === 1 ? 'baño completo' : 'baños completos'}` : null,
    property.halfBathrooms ? `${property.halfBathrooms} ${property.halfBathrooms === 1 ? 'medio baño' : 'medios baños'}` : null,
    property.surfaceBuilt ? `${property.surfaceBuilt} metros cuadrados de construcción` : null,
    property.surfaceTotal ? `${property.surfaceTotal} metros cuadrados de terreno` : null,
    property.parkingSpaces ? `${property.parkingSpaces} ${property.parkingSpaces === 1 ? 'lugar de estacionamiento' : 'lugares de estacionamiento'}` : null,
    property.levelsCount ? `${property.levelsCount} ${property.levelsCount === 1 ? 'nivel' : 'niveles'}` : null,
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
  const title = property.title?.trim() || (isSpanish ? 'esta propiedad' : 'this property');

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
          ? `Abrí la descripción de “${title}”. ${description} La información mostrada proviene directamente del anuncio publicado. ¿Quieres que ahora revisemos sus amenidades o la ficha técnica?`
          : `I opened the description for “${title}”. ${description} The information shown comes directly from the published listing. Would you like to review its amenities or technical profile next?`)
      : (isSpanish
          ? `Abrí la descripción, pero el responsable todavía no ha publicado un texto detallado para “${title}”. No voy a completar esos datos con suposiciones. ¿Quieres revisar la ficha técnica o las fotografías disponibles?`
          : `I opened the description, but the representative has not published a detailed text for “${title}” yet. I will not fill those gaps with assumptions. Would you like to review the technical profile or available photos?`);
    return answer(reply, isSpanish ? ['Ver amenidades', 'Ver ficha técnica'] : ['View amenities', 'View technical profile']);
  }

  if (section === 'amenities') {
    const amenities = [...new Set([
      ...(property.amenities || []),
      ...((property.metadata?.customAmenities as string[] | undefined) || []),
    ].map((item) => item.trim()).filter(Boolean))];
    if (amenities.length === 0) {
      return answer(
        isSpanish
          ? `Abrí la sección de amenidades, pero este anuncio todavía no tiene comodidades verificadas publicadas. Prefiero decírtelo claramente antes que asumir equipamiento que quizá no existe. ¿Quieres que revisemos la descripción o la ficha técnica?`
          : `I opened the amenities section, but this listing does not yet include published, verified amenities. I would rather say that clearly than assume features that may not exist. Would you like to review the description or technical profile?`,
        isSpanish ? ['Ver descripción', 'Ver ficha técnica'] : ['View description', 'View technical profile'],
      );
    }
    const visibleAmenities = amenities.slice(0, 7);
    const remaining = amenities.length - visibleAmenities.length;
    const detail = `${joinNaturally(visibleAmenities, language)}${remaining > 0 ? (isSpanish ? `, además de ${remaining} adicionales` : `, plus ${remaining} more`) : ''}`;
    return answer(
      isSpanish
        ? `Abrí las amenidades de “${title}”. El anuncio confirma ${detail}. En pantalla puedes revisar la lista completa sin perder la conversación. ¿Quieres que te explique alguna amenidad en particular o pasamos a los espacios y superficies?`
        : `I opened the amenities for “${title}”. The listing confirms ${detail}. You can review the complete list on screen without leaving the conversation. Would you like me to explain a specific feature or move on to spaces and surfaces?`,
      isSpanish ? ['Ver ficha técnica', 'Ver fotos'] : ['View technical profile', 'View photos'],
    );
  }

  if (section === 'technical') {
    const facts = getTechnicalFacts(property, language);
    return answer(
      facts.length > 0
        ? (isSpanish
            ? `Abrí la ficha técnica de “${title}”. Los datos principales publicados son ${joinNaturally(facts, language)}. La sección también separa superficies, servicios y seguridad para que puedas verificarlos con calma. ¿Quieres que profundicemos en el tamaño, los servicios o la distribución?`
            : `I opened the technical profile for “${title}”. Its main published details are ${joinNaturally(facts, language)}. The section also separates surfaces, utilities, and security so you can verify them carefully. Would you like to focus on size, services, or layout?`)
        : (isSpanish
            ? `Abrí la ficha técnica, pero todavía no contiene medidas o distribución suficientes para explicarlas con precisión. No completaré esos espacios con estimaciones. ¿Quieres revisar la descripción o contactar al responsable?`
            : `I opened the technical profile, but it does not yet contain enough measurements or layout details for a precise explanation. I will not fill those gaps with estimates. Would you like to review the description or contact the representative?`),
      isSpanish ? ['Revisar amenidades', 'Ver contacto'] : ['Review amenities', 'View contact'],
    );
  }

  if (section === 'gallery') {
    const photoCount = property.images?.length || 0;
    return answer(
      photoCount > 0
        ? (isSpanish
            ? `Abrí la galería de “${title}”, que contiene ${photoCount} ${photoCount === 1 ? 'fotografía publicada' : 'fotografías publicadas'}. Puedes tocar cualquier imagen para verla en grande y deslizar hacia los lados para recorrerlas. ¿Quieres que después revisemos la distribución o las amenidades que aparecen en las fotos?`
            : `I opened the gallery for “${title}”, which contains ${photoCount} published ${photoCount === 1 ? 'photo' : 'photos'}. Tap any image to enlarge it and swipe sideways to browse. Would you like to review the layout or the amenities visible in the photos afterward?`)
        : (isSpanish
            ? `Abrí la galería, pero esta propiedad todavía no tiene fotografías publicadas. No mostraré imágenes genéricas como si fueran del inmueble. ¿Quieres revisar su descripción o contactar al responsable?`
            : `I opened the gallery, but this property does not have published photos yet. I will not show generic images as if they belonged to the listing. Would you like to review its description or contact the representative?`),
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
            ? `Abrí la sección multimedia de “${title}”. El expediente incluye ${joinNaturally(available, language)}, disponibles para revisarlos directamente en pantalla. ¿Quieres reproducir el video o prefieres abrir primero la galería de fotografías?`
            : `I opened the media section for “${title}”. The listing includes ${joinNaturally(available, language)}, ready to review directly on screen. Would you like to play the video or open the photo gallery first?`)
        : (isSpanish
            ? `Abrí la sección multimedia, pero todavía no hay videos, recorridos virtuales ni planos publicados. La galería de fotos y la ficha técnica siguen disponibles para revisar el inmueble. ¿Cuál de esas dos prefieres abrir?`
            : `I opened the media section, but no videos, virtual tours, or floor plans have been published yet. The photo gallery and technical profile are still available. Which would you prefer to open?`),
      isSpanish ? ['Ver fotos', 'Ver ficha técnica'] : ['View photos', 'View technical profile'],
    );
  }

  if (section === 'location') {
    const publicLocation = formatPropertyLocation(property.location, property.country);
    const nearby = selectEternaNearbyHighlights(property.nearbyPlaces || []).slice(0, 3);
    const nearbyText = nearby.map((place) => (
      isSpanish
        ? `${place.name}, a ${place.drivingMinutes} ${place.drivingMinutes === 1 ? 'minuto' : 'minutos'} en auto`
        : `${place.name}, ${place.drivingMinutes} ${place.drivingMinutes === 1 ? 'minute' : 'minutes'} by car`
    ));
    return answer(
      isSpanish
        ? `Abrí el mapa de “${title}”, ubicada en ${publicLocation}. ${nearbyText.length ? `Como referencias cercanas verificadas aparecen ${joinNaturally(nearbyText, language)}.` : 'El mapa permite explorar la zona publicada sin revelar una dirección que el anunciante haya decidido mantener privada.'} ¿Quieres que revisemos escuelas, servicios o tiempos de traslado?`
        : `I opened the map for “${title}”, located in ${publicLocation}. ${nearbyText.length ? `Verified nearby references include ${joinNaturally(nearbyText, language)}.` : 'The map lets you explore the published area without revealing an address the advertiser chose to keep private.'} Would you like to review schools, services, or travel times?`,
      isSpanish ? ['Escuelas cercanas', 'Servicios cercanos'] : ['Nearby schools', 'Nearby services'],
    );
  }

  if (section === 'financing') {
    const methods = getFinancingMethods(offerings, language);
    return answer(
      methods.length > 0
        ? (isSpanish
            ? `Abrí los métodos de pago declarados para “${title}”. El anunciante indicó que considera ${joinNaturally(methods, language)}; esto describe opciones posibles, no una aprobación crediticia. La elegibilidad final depende del inmueble, el expediente y la institución. ¿Quieres que calculemos una mensualidad o revisar primero el precio?`
            : `I opened the declared payment methods for “${title}”. The advertiser indicated ${joinNaturally(methods, language)} may be considered; these are possible options, not credit approval. Final eligibility depends on the property, the file, and the institution. Would you like to calculate a monthly payment or review the price first?`)
        : (isSpanish
            ? `Abrí la sección de financiamiento, pero el anuncio no confirma métodos de pago específicos. Eso no significa que un crédito esté rechazado; simplemente requiere validación con el responsable y la institución. ¿Quieres abrir el simulador de mensualidad o contactar al anunciante?`
            : `I opened the financing section, but the listing does not confirm specific payment methods. That does not mean financing is rejected; it requires validation with the representative and lender. Would you like to open the monthly payment simulator or contact the advertiser?`),
      isSpanish ? ['Calcular mensualidad', 'Revisar precio'] : ['Calculate payment', 'Review price'],
    );
  }

  if (section === 'commercial') {
    const descriptions = offerings.map((offering) => getOfferingDescription(offering, language));
    return answer(
      descriptions.length > 0
        ? (isSpanish
            ? `Abrí las condiciones comerciales de “${title}”. Las modalidades públicas actuales son ${joinNaturally(descriptions, language)}. En pantalla también puedes confirmar si el precio es negociable o si se aceptan ofertas. ¿Quieres revisar financiamiento, calcular una mensualidad o contactar al responsable?`
            : `I opened the commercial terms for “${title}”. Its current public modes are ${joinNaturally(descriptions, language)}. On screen you can also confirm whether the price is negotiable or offers are accepted. Would you like to review financing, calculate a payment, or contact the representative?`)
        : (isSpanish
            ? `Abrí las condiciones comerciales, pero esta ficha no tiene una modalidad pública activa con precio confirmado. Prefiero no convertir datos incompletos en una cifra. ¿Quieres contactar al responsable o revisar otra sección?`
            : `I opened the commercial terms, but this listing does not have an active public mode with a confirmed price. I would rather not turn incomplete data into a figure. Would you like to contact the representative or review another section?`),
      isSpanish ? ['Ver financiamiento', 'Ver contacto'] : ['View financing', 'View contact'],
    );
  }

  if (section === 'legal') {
    const facts = getLegalFacts(property, language);
    return answer(
      facts.length > 0
        ? (isSpanish
            ? `Abrí la situación documental de “${title}”. El expediente publicado indica ${joinNaturally(facts, language)}. Estos datos ayudan a preparar la revisión, pero no sustituyen la validación notarial ni los documentos originales. ¿Quieres revisar algún punto legal o contactar al responsable?`
            : `I opened the document status for “${title}”. The published file indicates ${joinNaturally(facts, language)}. These details help prepare due diligence but do not replace notarial review or original documents. Would you like to review a legal point or contact the representative?`)
        : (isSpanish
            ? `Abrí la situación documental, pero todavía no hay verificaciones legales publicadas suficientes. Eterna no interpretará la ausencia de datos como una aprobación. ¿Quieres contactar al responsable para solicitar el expediente?`
            : `I opened the document status, but there are not enough published legal verifications yet. Eterna will not interpret missing data as approval. Would you like to contact the representative to request the file?`),
      isSpanish ? ['Ver contacto', 'Revisar precio'] : ['View contact', 'Review price'],
    );
  }

  if (section === 'contact') {
    const responsible = property.brokerProfile?.name || property.hostName;
    return answer(
      responsible
        ? (isSpanish
            ? `Abrí los datos públicos del responsable de “${title}”. La publicación está a cargo de ${responsible}${property.hostVerified ? ', con perfil verificado' : ''}; en pantalla aparecen únicamente los canales autorizados para contacto. ¿Quieres enviar un mensaje o prefieres seguir revisando la propiedad antes?`
            : `I opened the public contact details for “${title}”. The listing is managed by ${responsible}${property.hostVerified ? ', with a verified profile' : ''}; only authorized contact channels appear on screen. Would you like to send a message or keep reviewing the property first?`)
        : (isSpanish
            ? `Abrí la sección de contacto, pero el anuncio no muestra todavía un responsable público con canales disponibles. No expondré datos privados para completar esa ausencia. ¿Quieres revisar otra sección mientras se actualiza la ficha?`
            : `I opened the contact section, but the listing does not yet show a public representative with available channels. I will not expose private information to fill that gap. Would you like to review another section while the listing is updated?`),
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
            ? `Abrí la estimación automatizada de “${title}”. El valor central calculado es ${formatMoney(strictValue, valuation?.currency || 'MXN', language)}, sustentado en ${valuation?.comparableCount || 0} comparables y ${sourceCount || 'las'} fuentes documentadas. Es una referencia automatizada, no un avalúo oficial. ¿Quieres revisar el rango o los comparables?`
            : `I opened the automated estimate for “${title}”. The calculated central value is ${formatMoney(strictValue, valuation?.currency || 'MXN', language)}, supported by ${valuation?.comparableCount || 0} comparables and ${sourceCount || 'documented'} sources. It is an automated reference, not an official appraisal. Would you like to review the range or comparables?`)
        : areaReference
          ? (isSpanish
              ? `Abrí la estimación comercial de “${title}”. El precio central aproximado es ${formatMoney(areaReference, valuation?.currency || 'MXN', language)} y en pantalla puedes ver si el precio publicado está bajo, dentro o arriba del rango. Se basa en anuncios comparables y no sustituye un avalúo. ¿Quieres que te explique el rango?`
              : `I opened the commercial estimate for “${title}”. The approximate central price is ${formatMoney(areaReference, valuation?.currency || 'MXN', language)}, and the screen shows whether the listing is below, within, or above the range. It is based on comparable listings and does not replace an appraisal. Would you like me to explain the range?`)
          : (isSpanish
              ? `Abrí la evidencia de mercado, pero esta propiedad todavía no reúne comparables suficientes para publicar una estimación responsable. La cifra permanece oculta para evitar una falsa precisión. ¿Quieres revisar el precio anunciado o la metodología?`
              : `I opened the market evidence, but this property does not yet have enough comparables for a responsible estimate. The figure remains hidden to avoid false precision. Would you like to review the asking price or methodology?`),
      isSpanish ? ['Ver comparables', 'Revisar precio'] : ['View comparables', 'Review price'],
    );
  }

  if (section === 'mortgage') {
    return answer(
      isSpanish
        ? `Abrí el simulador hipotecario de “${title}”. Puedes ajustar enganche, plazo y tasa para ver cómo cambia la mensualidad; el resultado es orientativo y no incluye seguros, comisiones ni una aprobación bancaria. ¿Qué dato quieres modificar primero?`
        : `I opened the mortgage simulator for “${title}”. You can adjust down payment, term, and rate to see how the monthly payment changes; the result is indicative and excludes insurance, fees, and bank approval. Which value would you like to change first?`,
      isSpanish ? ['Cambiar enganche', 'Cambiar plazo'] : ['Change down payment', 'Change term'],
    );
  }

  // Keep the prompt in the signature so future section-specific refinements
  // can remain deterministic without adding another model round trip.
  void prompt;
  return null;
}
