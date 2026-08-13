import type { Property } from '../../types';

type ValuationConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'INSUFFICIENT';

/**
 * Public, read-only valuation fields that Eterna is allowed to explain. The
 * interface deliberately mirrors PropertyValuation without coupling the
 * conversation layer to the database implementation.
 */
export interface EternaValuationSnapshot {
  currency?: string | null;
  estimatedSaleValue?: number | null;
  saleRangeLow?: number | null;
  saleRangeHigh?: number | null;
  salePricePerM2?: number | null;
  estimatedMonthlyRent?: number | null;
  rentRangeLow?: number | null;
  rentRangeHigh?: number | null;
  rentPricePerM2?: number | null;
  estimatedCapRate?: number | null;
  grossRentalYield?: number | null;
  listingPrice?: number | null;
  listingVsEstimatePct?: number | null;
  areaReferenceValue?: number | null;
  areaRangeLow?: number | null;
  areaRangeHigh?: number | null;
  areaPricePerM2?: number | null;
  areaReferenceOperation?: 'SALE' | 'MONTHLY_RENT' | null;
  evidenceTier?: 'STRICT_ESTIMATE' | 'AREA_REFERENCE' | 'INSUFFICIENT' | null;
  confidence?: ValuationConfidence | null;
  confidenceScore?: number | null;
  comparableCount?: number | null;
  saleComparableCount?: number | null;
  rentComparableCount?: number | null;
  dataAsOf?: string | null;
  modelVersion?: string | null;
  methodology?: string | null;
  warnings?: string[] | null;
}

export interface ValuationAnswer {
  /** Plain text shown in Eterna's chat. */
  reply: string;
  /** Speech-friendly version without symbols such as %, m² or price dashes. */
  speech: string;
  suggestedReplies: string[];
}

type ValuationProperty = Property & { valuation?: EternaValuationSnapshot | null };
type ValuationIntent = 'value' | 'comparison' | 'rent' | 'cap_rate' | 'methodology';

const normalize = (value: string): string => value
  .toLocaleLowerCase('es-MX')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\p{L}\p{N}%\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const finiteNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const formatMoney = (value: number, currency: string, language: 'es' | 'en'): string => {
  try {
    return new Intl.NumberFormat(language === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(Math.round(value));
  } catch {
    return `$${Math.round(value).toLocaleString(language === 'es' ? 'es-MX' : 'en-US')}`;
  }
};

const formatSpokenMoney = (value: number, currency: string, language: 'es' | 'en'): string => {
  const number = Math.round(value).toLocaleString(language === 'es' ? 'es-MX' : 'en-US');
  if (language === 'en') return `${number} ${currency === 'MXN' ? 'Mexican pesos' : currency}`;
  return `${number} ${currency === 'MXN' ? 'pesos' : currency === 'USD' ? 'dólares estadounidenses' : currency}`;
};

const formatPercent = (value: number, language: 'es' | 'en'): string => (
  new Intl.NumberFormat(language === 'es' ? 'es-MX' : 'en-US', {
    maximumFractionDigits: 1,
  }).format(Math.abs(value))
);

const formatDate = (value: string | null | undefined, language: 'es' | 'en'): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 30);
  return new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
};

const confidenceLabel = (confidence: ValuationConfidence | null | undefined, language: 'es' | 'en'): string => {
  if (language === 'en') {
    if (confidence === 'HIGH') return 'high';
    if (confidence === 'MEDIUM') return 'medium';
    if (confidence === 'LOW') return 'low';
    return 'insufficient';
  }
  if (confidence === 'HIGH') return 'alta';
  if (confidence === 'MEDIUM') return 'media';
  if (confidence === 'LOW') return 'baja';
  return 'insuficiente';
};

const detectIntent = (prompt: string): ValuationIntent | null => {
  const clean = normalize(prompt);

  if (/\b(cap rate|tasa de capitalizacion|rentabilidad|rendimiento (?:anual|de renta)|rental yield)\b/.test(clean)) {
    return 'cap_rate';
  }
  if (/\b(como (?:se )?(?:calculo|calcularon|estima)|metodologia|de donde sale|que datos usaron|comparables|confianza|que tan confiable|fuentes del estimado)\b/.test(clean)) {
    return 'methodology';
  }
  if (/\b(renta estimada|renta de mercado|cuanto (?:se )?rentaria|cuanto podria rentar|en cuanto (?:se )?puede rentar|alquiler estimado|estimated rent|rent estimate)\b/.test(clean)) {
    return 'rent';
  }
  if (/\b(caro|barato|precio (?:bajo|alto)|por debajo del estimado|por encima del estimado|buena oportunidad|conviene|comparado con el estimado|respecto al estimado)\b/.test(clean)) {
    return 'comparison';
  }
  if (
    /\b(cuanto vale|cuanto cuesta|valor (?:estimado|de mercado)|precio estimado|rango de (?:valor|precio)|avaluo|avaluar|estimacion de valor|precio de mercado|precio de esta propiedad)\b/.test(clean)
    || /^(?:revisar|ver|explicame) (?:el )?precio$/.test(clean)
  ) {
    return 'value';
  }
  return null;
};

const noEstimateAnswer = (language: 'es' | 'en', insufficient = false): ValuationAnswer => {
  if (language === 'en') {
    const reply = insufficient
      ? 'Towers México marked the available data as insufficient, so it does not publish a reliable automated estimate for this property. I will not substitute the listing price or invent a figure. Would you like to review the listed price or the property details?'
      : 'There is no Towers México automated estimate available for this property yet. I will not substitute the listing price or invent a figure. Would you like to review the listed price or the property details?';
    return {
      reply,
      speech: reply,
      suggestedReplies: ['Review the listed price', 'Review property details'],
    };
  }

  const reply = insufficient
    ? 'Towers México marcó los datos disponibles como insuficientes, por lo que no publica una estimación automatizada fiable para esta propiedad. No la sustituiré con el precio anunciado ni inventaré una cifra. ¿Quieres revisar el precio publicado o las características del inmueble?'
    : 'Todavía no hay una estimación automatizada de Towers México disponible para esta propiedad. No la sustituiré con el precio anunciado ni inventaré una cifra. ¿Quieres revisar el precio publicado o las características del inmueble?';
  return {
    reply,
    speech: reply,
    suggestedReplies: ['Revisar el precio publicado', 'Ver características'],
  };
};

const contextSentence = (valuation: EternaValuationSnapshot, language: 'es' | 'en'): string => {
  const date = formatDate(valuation.dataAsOf, language);
  const confidence = confidenceLabel(valuation.confidence, language);
  const count = Math.max(0, Math.round(finiteNumber(valuation.comparableCount) || 0));

  if (language === 'en') {
    const parts = [`Confidence is ${confidence}`];
    if (count) parts.push(`based on ${count} comparable ${count === 1 ? 'property' : 'properties'}`);
    if (date) parts.push(`with data through ${date}`);
    return `${parts.join(', ')}.`;
  }

  const parts = [`La confianza es ${confidence}`];
  if (count) parts.push(`con ${count} ${count === 1 ? 'comparable' : 'comparables'}`);
  if (date) parts.push(`y datos con corte al ${date}`);
  return `${parts.join(' ')}.`;
};

const comparisonPhrase = (
  percent: number | null,
  language: 'es' | 'en',
  spoken = false,
): string | null => {
  if (percent === null) return null;
  const magnitude = formatPercent(percent, language);
  const percentUnit = spoken ? (language === 'es' ? ' por ciento' : ' percent') : '%';
  if (Math.abs(percent) < 0.5) {
    return language === 'es'
      ? 'El precio publicado está prácticamente alineado con el punto estimado'
      : 'The listing price is essentially aligned with the estimated midpoint';
  }
  if (percent < 0) {
    return language === 'es'
      ? `El precio publicado está ${magnitude}${percentUnit} por debajo del punto estimado`
      : `The listing price is ${magnitude}${percentUnit} below the estimated midpoint`;
  }
  return language === 'es'
    ? `El precio publicado está ${magnitude}${percentUnit} por encima del punto estimado`
    : `The listing price is ${magnitude}${percentUnit} above the estimated midpoint`;
};

export function getEternaValuation(property: Property): EternaValuationSnapshot | null {
  const valuation = (property as ValuationProperty).valuation;
  return valuation && typeof valuation === 'object' ? valuation : null;
}

/**
 * Produces only aggregate, public-safe facts for the LLM dossier. Comparable
 * IDs, titles and exact locations intentionally never leave the client.
 */
export function getEternaValuationDossier(property: Property): Record<string, unknown> | null {
  const valuation = getEternaValuation(property);
  const isAreaReference = valuation?.evidenceTier === 'AREA_REFERENCE'
    && valuation.confidence === 'LOW';
  if (
    !valuation
    || valuation.confidence === 'INSUFFICIENT'
    || (valuation.confidence === 'LOW' && !isAreaReference)
    || valuation.modelVersion !== 'towers-market-v5'
  ) return null;
  const areaReference = finiteNumber(valuation.areaReferenceValue);
  const listingPrice = finiteNumber(valuation.listingPrice);
  const areaDifference = isAreaReference && areaReference && listingPrice
    ? Number(((listingPrice - areaReference) / areaReference * 100).toFixed(2))
    : null;
  return {
    tipo: isAreaReference ? 'ESTIMACION_COMERCIAL_ORIENTATIVA' : 'ESTIMACION_AUTOMATIZADA_DE_VALOR',
    aviso: isAreaReference
      ? 'Es una estimación comercial aproximada basada en precios anunciados del micromercado; no es un avalúo.'
      : 'No es un avalúo oficial ni sustituye la inspección y firma de un perito autorizado.',
    moneda: valuation.currency || 'MXN',
    valorVentaEstimado: finiteNumber(valuation.estimatedSaleValue),
    rangoVenta: {
      minimo: finiteNumber(valuation.saleRangeLow),
      maximo: finiteNumber(valuation.saleRangeHigh),
    },
    precioVentaEstimadoM2: finiteNumber(valuation.salePricePerM2),
    rentaMensualEstimada: finiteNumber(valuation.estimatedMonthlyRent),
    rangoRentaMensual: {
      minimo: finiteNumber(valuation.rentRangeLow),
      maximo: finiteNumber(valuation.rentRangeHigh),
    },
    rentaEstimadaM2: finiteNumber(valuation.rentPricePerM2),
    capRateEstimadoPct: finiteNumber(valuation.estimatedCapRate) || finiteNumber(valuation.grossRentalYield),
    precioPublicado: listingPrice,
    diferenciaPublicadoVsEstimadoPct: typeof valuation.listingVsEstimatePct === 'number'
      && Number.isFinite(valuation.listingVsEstimatePct)
      ? valuation.listingVsEstimatePct
      : areaDifference,
    referenciaOrientativa: areaReference,
    rangoReferenciaOrientativa: {
      minimo: finiteNumber(valuation.areaRangeLow),
      maximo: finiteNumber(valuation.areaRangeHigh),
    },
    referenciaOrientativaM2: finiteNumber(valuation.areaPricePerM2),
    confianza: valuation.confidence || 'INSUFFICIENT',
    puntuacionConfianza: finiteNumber(valuation.confidenceScore),
    comparablesUtilizados: finiteNumber(valuation.comparableCount),
    corteDeDatos: valuation.dataAsOf || null,
    versionModelo: valuation.modelVersion || null,
    metodologia: valuation.methodology || null,
    advertencias: Array.isArray(valuation.warnings) ? valuation.warnings.slice(0, 5) : [],
  };
}

export function resolveValuationQuestion(
  rawPrompt: string,
  property: Property,
  language: 'es' | 'en',
): ValuationAnswer | null {
  const intent = detectIntent(rawPrompt);
  if (!intent) return null;

  const valuation = getEternaValuation(property);
  if (!valuation) return noEstimateAnswer(language);
  const isAreaReference = valuation.evidenceTier === 'AREA_REFERENCE'
    && valuation.confidence === 'LOW';
  if (
    valuation.confidence === 'INSUFFICIENT'
    || (valuation.confidence === 'LOW' && !isAreaReference)
    || valuation.modelVersion !== 'towers-market-v5'
  ) return noEstimateAnswer(language, true);

  const currency = valuation.currency || 'MXN';
  const estimate = finiteNumber(valuation.estimatedSaleValue);
  const rangeLow = finiteNumber(valuation.saleRangeLow);
  const rangeHigh = finiteNumber(valuation.saleRangeHigh);
  const pricePerM2 = finiteNumber(valuation.salePricePerM2);
  const monthlyRent = finiteNumber(valuation.estimatedMonthlyRent);
  const rentLow = finiteNumber(valuation.rentRangeLow);
  const rentHigh = finiteNumber(valuation.rentRangeHigh);
  const rentPerM2 = finiteNumber(valuation.rentPricePerM2);
  const capRate = finiteNumber(valuation.estimatedCapRate) || finiteNumber(valuation.grossRentalYield);
  const listingPrice = finiteNumber(valuation.listingPrice);
  const listingDifference = typeof valuation.listingVsEstimatePct === 'number'
    && Number.isFinite(valuation.listingVsEstimatePct)
      ? valuation.listingVsEstimatePct
      : null;

  if (isAreaReference) {
    const reference = finiteNumber(valuation.areaReferenceValue);
    const referenceLow = finiteNumber(valuation.areaRangeLow);
    const referenceHigh = finiteNumber(valuation.areaRangeHigh);
    const referencePerM2 = finiteNumber(valuation.areaPricePerM2);
    if (!reference) return noEstimateAnswer(language, true);

    if (intent === 'cap_rate') {
      const reply = language === 'es'
        ? 'La ficha tiene una estimación comercial de venta, pero todavía no una estimación de renta compatible; sin ambas cifras no sería responsable calcular el cap rate. ¿Quieres revisar el precio estimado y su rango?'
        : 'This listing has a commercial sale estimate, but not yet a compatible rent estimate; without both figures, calculating cap rate would not be responsible. Would you like to review the estimated price and range?';
      return { reply, speech: reply, suggestedReplies: language === 'es' ? ['Ver precio estimado', '¿Cómo se calculó?'] : ['See estimated price', 'How was it calculated?'] };
    }

    if (intent === 'comparison') {
      const listed = finiteNumber(valuation.listingPrice);
      const difference = listed
        ? Number(((listed - reference) / reference * 100).toFixed(2))
        : null;
      const visualComparison = comparisonPhrase(difference, language);
      const spokenComparison = comparisonPhrase(difference, language, true);
      const reply = language === 'es'
        ? `${listed ? `El precio publicado es ${formatMoney(listed, currency, language)} y la estimación comercial central es ${formatMoney(reference, currency, language)}. ` : ''}${visualComparison ? `${visualComparison}. ` : ''}El rango es aproximado y se basa en precios anunciados comparables. ¿Quieres que te muestre el rango completo?`
        : `${listed ? `The listing price is ${formatMoney(listed, currency, language)} and the central commercial estimate is ${formatMoney(reference, currency, language)}. ` : ''}${visualComparison ? `${visualComparison}. ` : ''}The range is approximate and based on comparable asking prices. Would you like the full range?`;
      const speech = language === 'es'
        ? `${listed ? `El precio publicado es ${formatSpokenMoney(listed, currency, language)} y la estimación comercial central es ${formatSpokenMoney(reference, currency, language)}. ` : ''}${spokenComparison ? `${spokenComparison}. ` : ''}El rango es aproximado y se basa en precios anunciados comparables. ¿Quieres que te muestre el rango completo?`
        : `${listed ? `The listing price is ${formatSpokenMoney(listed, currency, language)} and the central commercial estimate is ${formatSpokenMoney(reference, currency, language)}. ` : ''}${spokenComparison ? `${spokenComparison}. ` : ''}The range is approximate and based on comparable asking prices. Would you like the full range?`;
      return { reply, speech, suggestedReplies: language === 'es' ? ['Ver rango estimado', '¿Cómo se calculó?'] : ['See estimated range', 'How was it calculated?'] };
    }

    if (intent === 'methodology') {
      const count = Math.round(finiteNumber(valuation.comparableCount) || 0);
      const date = formatDate(valuation.dataAsOf, language);
      const reply = language === 'es'
        ? `Es una estimación comercial aproximada, no un avalúo. Usó ${count} propiedades del mismo micromercado, tipo y operación; eliminó posibles duplicados y ajustó las diferencias de superficie${date ? `, con datos al ${date}` : ''}. No exige coordenadas exactas cuando la colonia está identificada. ¿Quieres revisar el precio central o el rango?`
        : `This is an approximate commercial estimate, not an appraisal. It used ${count} properties in the same micro-market, type and operation; removed likely duplicates and adjusted area differences${date ? `, with data through ${date}` : ''}. It does not require exact coordinates when the neighborhood is identified. Would you like the central price or range?`;
      return { reply, speech: reply, suggestedReplies: language === 'es' ? ['Ver precio estimado', 'Ver rango estimado'] : ['See estimated price', 'See estimated range'] };
    }

    const visualRange = referenceLow && referenceHigh
      ? (language === 'es'
          ? `, con un rango estimado de ${formatMoney(referenceLow, currency, language)} a ${formatMoney(referenceHigh, currency, language)}`
          : `, with an estimated range from ${formatMoney(referenceLow, currency, language)} to ${formatMoney(referenceHigh, currency, language)}`)
      : '';
    const spokenRange = referenceLow && referenceHigh
      ? (language === 'es'
          ? `, con un rango estimado entre ${formatSpokenMoney(referenceLow, currency, language)} y ${formatSpokenMoney(referenceHigh, currency, language)}`
          : `, with an estimated range between ${formatSpokenMoney(referenceLow, currency, language)} and ${formatSpokenMoney(referenceHigh, currency, language)}`)
      : '';
    const visualPerM2 = referencePerM2
      ? (language === 'es' ? ` La referencia por m² es ${formatMoney(referencePerM2, currency, language)}.` : ` The reference per m² is ${formatMoney(referencePerM2, currency, language)}.`)
      : '';
    const spokenPerM2 = referencePerM2
      ? (language === 'es' ? ` La referencia por metro cuadrado es ${formatSpokenMoney(referencePerM2, currency, language)}.` : ` The reference per square meter is ${formatSpokenMoney(referencePerM2, currency, language)}.`)
      : '';
    const reply = language === 'es'
      ? `La estimación comercial aproximada de esta propiedad es ${formatMoney(reference, currency, language)}${visualRange}.${visualPerM2} Se basó en ${Math.round(finiteNumber(valuation.comparableCount) || 0)} comparables y no sustituye un avalúo. ¿Quieres saber cómo se calculó?`
      : `The approximate commercial estimate for this property is ${formatMoney(reference, currency, language)}${visualRange}.${visualPerM2} It used ${Math.round(finiteNumber(valuation.comparableCount) || 0)} comparables and does not replace an appraisal. Would you like to know how it was calculated?`;
    const speech = language === 'es'
      ? `La estimación comercial aproximada de esta propiedad es ${formatSpokenMoney(reference, currency, language)}${spokenRange}.${spokenPerM2} Se basó en ${Math.round(finiteNumber(valuation.comparableCount) || 0)} comparables y no sustituye un avalúo. ¿Quieres saber cómo se calculó?`
      : `The approximate commercial estimate for this property is ${formatSpokenMoney(reference, currency, language)}${spokenRange}.${spokenPerM2} It used ${Math.round(finiteNumber(valuation.comparableCount) || 0)} comparables and does not replace an appraisal. Would you like to know how it was calculated?`;
    return { reply, speech, suggestedReplies: language === 'es' ? ['¿Cómo se calculó?', 'Ver características'] : ['How was it calculated?', 'Review property details'] };
  }

  if (intent === 'rent') {
    if (!monthlyRent) {
      const reply = language === 'es'
        ? 'La estimación automatizada actual no incluye una renta mensual fiable para esta propiedad, así que no inventaré una cifra. ¿Quieres revisar el valor de venta estimado o cómo se calculó?'
        : 'The current automated estimate does not include a reliable monthly rent for this property, so I will not invent a figure. Would you like to review the estimated sale value or how it was calculated?';
      return {
        reply,
        speech: reply,
        suggestedReplies: language === 'es'
          ? ['Ver valor estimado', '¿Cómo se calculó?']
          : ['See estimated value', 'How was it calculated?'],
      };
    }

    const visualRange = rentLow && rentHigh
      ? (language === 'es'
        ? `, dentro de un rango de ${formatMoney(rentLow, currency, language)} a ${formatMoney(rentHigh, currency, language)}`
        : `, within a range of ${formatMoney(rentLow, currency, language)} to ${formatMoney(rentHigh, currency, language)}`)
      : '';
    const spokenRange = rentLow && rentHigh
      ? (language === 'es'
        ? `, dentro de un rango entre ${formatSpokenMoney(rentLow, currency, language)} y ${formatSpokenMoney(rentHigh, currency, language)}`
        : `, within a range between ${formatSpokenMoney(rentLow, currency, language)} and ${formatSpokenMoney(rentHigh, currency, language)}`)
      : '';
    const visualPerM2 = rentPerM2
      ? (language === 'es'
        ? ` Equivale a ${formatMoney(rentPerM2, currency, language)}/m².`
        : ` That equals ${formatMoney(rentPerM2, currency, language)}/m².`)
      : '';
    const spokenPerM2 = rentPerM2
      ? (language === 'es'
        ? ` Equivale a ${formatSpokenMoney(rentPerM2, currency, language)} por metro cuadrado.`
        : ` That equals ${formatSpokenMoney(rentPerM2, currency, language)} per square meter.`)
      : '';

    const reply = language === 'es'
      ? `La renta mensual estimada por Towers México es ${formatMoney(monthlyRent, currency, language)}${visualRange}.${visualPerM2} ${contextSentence(valuation, language)} ¿Quieres comparar la renta publicada o revisar el cap rate?`
      : `The Towers México estimated monthly rent is ${formatMoney(monthlyRent, currency, language)}${visualRange}.${visualPerM2} ${contextSentence(valuation, language)} Would you like to compare the listed rent or review the cap rate?`;
    const speech = language === 'es'
      ? `La renta mensual estimada por Towers México es ${formatSpokenMoney(monthlyRent, currency, language)}${spokenRange}.${spokenPerM2} ${contextSentence(valuation, language)} ¿Quieres comparar la renta publicada o revisar el cap rate?`
      : `The Towers México estimated monthly rent is ${formatSpokenMoney(monthlyRent, currency, language)}${spokenRange}.${spokenPerM2} ${contextSentence(valuation, language)} Would you like to compare the listed rent or review the cap rate?`;
    return {
      reply,
      speech,
      suggestedReplies: language === 'es'
        ? ['¿Cuál es el cap rate?', '¿Cómo se calculó la renta?']
        : ['What is the cap rate?', 'How was rent calculated?'],
    };
  }

  if (intent === 'cap_rate') {
    if (!capRate) {
      const reply = language === 'es'
        ? 'La estimación actual no tiene suficiente información para publicar un cap rate fiable. Para calcularlo se necesita una renta mensual y un valor de mercado estimados de forma consistente. ¿Quieres revisar las métricas que sí están disponibles?'
        : 'The current estimate does not have enough information to publish a reliable cap rate. It requires a monthly rent and market value estimated on a consistent basis. Would you like to review the available metrics?';
      return {
        reply,
        speech: reply,
        suggestedReplies: language === 'es'
          ? ['Ver valor estimado', 'Ver renta estimada']
          : ['See estimated value', 'See estimated rent'],
      };
    }

    const percent = formatPercent(capRate, language);
    const reply = language === 'es'
      ? `El cap rate estimado es ${percent}%. Es una referencia bruta basada en la renta y el valor estimados; no descuenta vacancia, mantenimiento, predial, administración ni otros gastos. ¿Quieres que revisemos la renta estimada o la metodología?`
      : `The estimated cap rate is ${percent}%. It is a gross reference based on estimated rent and value; it does not deduct vacancy, maintenance, property tax, management, or other expenses. Would you like to review the estimated rent or methodology?`;
    const speech = language === 'es'
      ? `El cap rate estimado es ${percent} por ciento. Es una referencia bruta basada en la renta y el valor estimados; no descuenta vacancia, mantenimiento, predial, administración ni otros gastos. ¿Quieres que revisemos la renta estimada o la metodología?`
      : `The estimated cap rate is ${percent} percent. It is a gross reference based on estimated rent and value; it does not deduct vacancy, maintenance, property tax, management, or other expenses. Would you like to review the estimated rent or methodology?`;
    return {
      reply,
      speech,
      suggestedReplies: language === 'es'
        ? ['Ver renta estimada', '¿Cómo se calculó?']
        : ['See estimated rent', 'How was it calculated?'],
    };
  }

  if (intent === 'methodology') {
    const method = valuation.methodology?.trim().replace(/\s+/g, ' ').slice(0, 260);
    const count = Math.max(0, Math.round(finiteNumber(valuation.comparableCount) || 0));
    const date = formatDate(valuation.dataAsOf, language);
    const confidence = confidenceLabel(valuation.confidence, language);
    const reply = language === 'es'
      ? `Es una estimación automatizada, no un avalúo oficial. ${method ? `La metodología registrada es: ${method}.` : 'La ficha no publica un detalle metodológico adicional.'}${count ? ` Utilizó ${count} ${count === 1 ? 'comparable' : 'comparables'}.` : ''} La confianza es ${confidence}${date ? ` y el corte de datos es ${date}` : ''}. ¿Quieres revisar el valor central o su rango?`
      : `This is an automated estimate, not an official appraisal. ${method ? `The recorded methodology is: ${method}.` : 'The record does not publish further methodology detail.'}${count ? ` It used ${count} comparable ${count === 1 ? 'property' : 'properties'}.` : ''} Confidence is ${confidence}${date ? ` and the data cutoff is ${date}` : ''}. Would you like to review the midpoint or its range?`;
    return {
      reply,
      speech: reply,
      suggestedReplies: language === 'es'
        ? ['Ver valor estimado', 'Ver renta estimada']
        : ['See estimated value', 'See estimated rent'],
    };
  }

  if (intent === 'comparison') {
    const visualComparison = comparisonPhrase(listingDifference, language);
    const spokenComparison = comparisonPhrase(listingDifference, language, true);
    if (!listingPrice || !estimate || !visualComparison || !spokenComparison) {
      const reply = language === 'es'
        ? 'No hay datos suficientes para comparar de forma responsable el precio publicado con la estimación automatizada. Una diferencia aislada tampoco determina por sí sola si es una buena oportunidad. ¿Quieres revisar el rango estimado o las características del inmueble?'
        : 'There is not enough data to responsibly compare the listing price with the automated estimate. A price difference alone also does not determine whether it is a good opportunity. Would you like to review the estimated range or property details?';
      return {
        reply,
        speech: reply,
        suggestedReplies: language === 'es'
          ? ['Ver rango estimado', 'Ver características']
          : ['See estimated range', 'Review property details'],
      };
    }

    const reply = language === 'es'
      ? `El precio publicado es ${formatMoney(listingPrice, currency, language)} y el punto estimado es ${formatMoney(estimate, currency, language)}. ${visualComparison}. Esa diferencia es una referencia de mercado, no una garantía de oportunidad ni un avalúo oficial. ¿Quieres revisar el rango o la renta estimada?`
      : `The listing price is ${formatMoney(listingPrice, currency, language)} and the estimated midpoint is ${formatMoney(estimate, currency, language)}. ${visualComparison}. That difference is a market reference, not a guarantee of value or an official appraisal. Would you like to review the range or estimated rent?`;
    const speech = language === 'es'
      ? `El precio publicado es ${formatSpokenMoney(listingPrice, currency, language)} y el punto estimado es ${formatSpokenMoney(estimate, currency, language)}. ${spokenComparison}. Esa diferencia es una referencia de mercado, no una garantía de oportunidad ni un avalúo oficial. ¿Quieres revisar el rango o la renta estimada?`
      : `The listing price is ${formatSpokenMoney(listingPrice, currency, language)} and the estimated midpoint is ${formatSpokenMoney(estimate, currency, language)}. ${spokenComparison}. That difference is a market reference, not a guarantee of value or an official appraisal. Would you like to review the range or estimated rent?`;
    return {
      reply,
      speech,
      suggestedReplies: language === 'es'
        ? ['Ver rango estimado', 'Ver renta estimada']
        : ['See estimated range', 'See estimated rent'],
    };
  }

  if (!estimate) return noEstimateAnswer(language, true);

  const visualRange = rangeLow && rangeHigh
    ? (language === 'es'
      ? `, con un rango de ${formatMoney(rangeLow, currency, language)} a ${formatMoney(rangeHigh, currency, language)}`
      : `, with a range of ${formatMoney(rangeLow, currency, language)} to ${formatMoney(rangeHigh, currency, language)}`)
    : '';
  const spokenRange = rangeLow && rangeHigh
    ? (language === 'es'
      ? `, con un rango entre ${formatSpokenMoney(rangeLow, currency, language)} y ${formatSpokenMoney(rangeHigh, currency, language)}`
      : `, with a range between ${formatSpokenMoney(rangeLow, currency, language)} and ${formatSpokenMoney(rangeHigh, currency, language)}`)
    : '';
  const visualPerM2 = pricePerM2
    ? (language === 'es'
      ? ` El valor estimado por m² es ${formatMoney(pricePerM2, currency, language)}.`
      : ` The estimated value per m² is ${formatMoney(pricePerM2, currency, language)}.`)
    : '';
  const spokenPerM2 = pricePerM2
    ? (language === 'es'
      ? ` El valor estimado por metro cuadrado es ${formatSpokenMoney(pricePerM2, currency, language)}.`
      : ` The estimated value per square meter is ${formatSpokenMoney(pricePerM2, currency, language)}.`)
    : '';

  const reply = language === 'es'
    ? `La estimación automatizada de Towers México es ${formatMoney(estimate, currency, language)}${visualRange}.${visualPerM2} ${contextSentence(valuation, language)} No sustituye un avalúo oficial. ¿Quieres revisar la diferencia frente al precio publicado o la renta estimada?`
    : `The Towers México automated estimate is ${formatMoney(estimate, currency, language)}${visualRange}.${visualPerM2} ${contextSentence(valuation, language)} It does not replace an official appraisal. Would you like to review the difference from the listing price or the estimated rent?`;
  const speech = language === 'es'
    ? `La estimación automatizada de Towers México es ${formatSpokenMoney(estimate, currency, language)}${spokenRange}.${spokenPerM2} ${contextSentence(valuation, language)} No sustituye un avalúo oficial. ¿Quieres revisar la diferencia frente al precio publicado o la renta estimada?`
    : `The Towers México automated estimate is ${formatSpokenMoney(estimate, currency, language)}${spokenRange}.${spokenPerM2} ${contextSentence(valuation, language)} It does not replace an official appraisal. Would you like to review the difference from the listing price or the estimated rent?`;
  return {
    reply,
    speech,
    suggestedReplies: language === 'es'
      ? ['Comparar con precio publicado', 'Ver renta estimada', '¿Cómo se calculó?']
      : ['Compare with listing price', 'See estimated rent', 'How was it calculated?'],
  };
}
