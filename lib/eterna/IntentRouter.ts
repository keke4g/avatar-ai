import { INTENT_PATTERNS } from './intents/patterns';
import type { IntentContext, IntentPattern, IntentResult } from './intents/types';

export { INTENT_PATTERNS };
export type { IntentContext, IntentPattern, IntentResult };
// This file is a pure module containing the Intent Router logic extracted from EternaConcierge.tsx
// It contains pure functions and static patterns without React/Next.js/HTML side-effects.

// ────────────────────────────────────────────────
// INTENT ROUTER — Resolves navigation without LLM
// ────────────────────────────────────────────────

export const isPropertySearchIntent = (prompt: string): boolean => {
  const clean = prompt.toLowerCase().trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!]/g, " ");

  // 1. Prefijos inmobiliarios explícitos con destino
  const explicitPrefixes = [
    'casas en', 'casa en', 'propiedades en', 'propiedad en', 
    'buscar en', 'alojamiento en', 'alojamientos en', 'hospedaje en', 
    'viajar a', 'viaje a', 'houses in', 'house in', 'properties in', 
    'property in', 'search in', 'stay in', 'travel to', 'casas de', 
    'casa de', 'propiedades de', 'propiedad de', 'alojamientos de', 
    'alojamiento de', 'departamentos en', 'departamento en', 'apartamentos en',
    'apartamento en', 'villas en', 'villa en', 'lofts en', 'loft en',
    'penthouse en', 'cabañas en', 'cabaña en', 'habitacion en', 'habitaciones en',
    'renta en', 'rentas en', 'alquiler en', 'venta en', 'departamentos de',
    'departamento de', 'apartamentos de', 'apartamento de'
  ];

  const prefixRegex = new RegExp(`\\b(${explicitPrefixes.join('|')})\\b\\s+([a-z]+)`, 'i');
  const match = clean.match(prefixRegex);
  if (match) {
    const matchedWordAfterPrefix = match[2].trim().toLowerCase();
    const exclusions = [
      'venta', 'vender', 'renta', 'rentar', 'alquiler', 'alquilar', 'intercambio', 'intercambiar', 'swap', 'swaps', 'trueque',
      'comprar', 'compra', 'adquirir', 'hospedar', 'hospedaje', 'hospedarse', 'quedar', 'quedarse', 'viajar'
    ];
    if (exclusions.includes(matchedWordAfterPrefix)) {
      return false;
    }
    return true;
  }

  // 2. Palabras clave inmobiliarias obligatorias
  const propertyKeywords = [
    'casa', 'casas', 'propiedad', 'propiedades', 'alojamiento', 'alojamientos',
    'departamento', 'departamentos', 'apartamento', 'apartamentos', 'villa', 'villas',
    'loft', 'lofts', 'penthouse', 'cabaña', 'cabañas', 'alquiler', 'renta', 'hospedaje',
    'inmueble', 'inmuebles', 'residencia', 'residencias', 'condominio', 'condominios'
  ];

  // Si no contiene palabras clave inmobiliarias, no es una búsqueda
  if (!propertyKeywords.some(kw => clean.includes(kw))) {
    return false;
  }

  // 3. Palabras conversacionales de exclusión (saludos, preguntas generales, etc.)
  const conversationalKeywords = [
    'quien eres', 'quien es', 'quien me', 'quien escribio', 'como funciona', 
    'explicame', 'que haces', 'que puedes', 'ayudar', 'ayuda', 'hola', 'buenos dias',
    'buenas tardes', 'buenas noches', 'publicar mi', 'publicar una', 'crear mi',
    'quiero publicar', 'como publico', 'bienvenido', 'bienvenida', 'saludos',
    'gracias', 'hola eterna', 'eterna', 'que es auraswap', 'como va', 'como estas',
    'como esta'
  ];

  if (conversationalKeywords.some(ckw => clean.includes(ckw))) {
    return false;
  }

  return true;
};

import { generatePropertySummary, resolveLocalPropertyQA } from './actions/PropertyActions';
export { generatePropertySummary, resolveLocalPropertyQA };

export interface PropertySearchIntent {
  destination?: string;
  guests?: number;
  category?: string;
  offering?: string;
  startDate?: string;
  endDate?: string;
  tier?: string;
  isPropertyMode?: boolean;
}

export const extractEntities = (prompt: string): PropertySearchIntent => {
  const clean = prompt.toLowerCase().trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!]/g, " ");

  const entities: PropertySearchIntent = {};

  // 1. Extract offering (Modalidad)
  if (/\b(comprar|venta|adquirir|compraria|adquiriria|vender|compro)\b/i.test(clean)) {
    entities.offering = 'SALE';
  } else if (/\b(renta mensual|larga estancia|rentar por mes|alquiler mensual)\b/i.test(clean)) {
    entities.offering = 'MONTHLY_RENT';
  } else if (/\b(renta|alquilar|vacaciones|hospedaje|alquiler|quedarme|rentar|noche|temporal|vacacional)\b/i.test(clean)) {
    entities.offering = 'SHORT_RENT';
  } else if (/\b(intercambio|swap|intercambiar|swaps)\b/i.test(clean)) {
    entities.offering = 'SWAP';
  }

  // 2. Extract category
  if (/\b(departamento|apartamento|apartment|depa|apartamentos|departamentos)\b/i.test(clean)) {
    entities.category = 'Apartment';
  } else if (/\b(villa|villas)\b/i.test(clean)) {
    entities.category = 'Villa';
  } else if (/\b(cabana|cabanas|cabin|cabins)\b/i.test(clean)) {
    entities.category = 'Cabin';
  } else if (/\b(penthouse|penthouses)\b/i.test(clean)) {
    entities.category = 'Penthouse';
  } else if (/\b(loft|lofts)\b/i.test(clean)) {
    entities.category = 'Loft';
  } else if (/\b(casa de playa|beach house|beach houses|casas de playa)\b/i.test(clean)) {
    entities.category = 'Beach House';
  }

  // 3. Extract guests
  const guestsMatch = clean.match(/\b(?:para\s+)?(\d+)\s*(?:personas|huespedes|adultos|huesped|persona)?\b/i);
  if (guestsMatch) {
    const num = parseInt(guestsMatch[1]);
    if (!isNaN(num) && num > 0) {
      entities.guests = num;
    }
  }

  // 4. Extract destination
  const destMatch = clean.match(/\b(?:en|a|hacia|para)\s+([a-z\s]+?)(?=\s+(?:para|con|de|en|a|comprar|rentar|intercambio|hospedaje|vacaciones|\d)|\.|\b)/i);
  const dest = destMatch ? destMatch[1].trim() : '';

  const commonExclusions = [
    'compra', 'comprar', 'renta', 'rentar', 'alquiler', 'alquilar', 'venta', 'vender', 'intercambio', 'intercambiar', 'swap', 'swaps', 'trueque',
    'vacaciones', 'personas', 'huespedes', 'huéspedes', 'un', 'una', 'mi', 'este', 'esta', 'ese', 'esa', 'el', 'la', 'los', 'las',
    'apartamento', 'departamento', 'apartamentos', 'departamentos', 'depa', 'depas', 'villa', 'villas', 'cabin', 'cabana', 'cabaña', 'cabañas',
    'penthouse', 'penthouses', 'loft', 'lofts', 'casa', 'casas', 'propiedad', 'propiedades', 'alojamiento', 'alojamientos', 'hospedaje',
    'hospedar', 'hospedarse', 'quedar', 'quedarse', 'viajar', 'viaje', 'zona', 'lugar', 'destino', 'vivir', 'inversion', 'invertir', 'inversión'
  ];
  if (dest && !commonExclusions.includes(dest.toLowerCase())) {
    entities.destination = dest.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  } else {
    const knownLocations = ['cancun', 'tulum', 'cozumel', 'cdmx', 'miami', 'mazatlan', 'los cabos', 'cabo', 'lomas', 'bosque'];
    const matchedLocation = knownLocations.find(loc => clean.includes(loc));
    if (matchedLocation) {
      const properNames: Record<string, string> = {
        'cancun': 'Cancún',
        'tulum': 'Tulum',
        'cozumel': 'Cozumel',
        'cdmx': 'CDMX',
        'miami': 'Miami',
        'mazatlan': 'Mazatlán',
        'los cabos': 'Los Cabos',
        'cabo': 'Los Cabos',
        'lomas': 'Lomas',
        'bosque': 'Bosque'
      };
      entities.destination = properNames[matchedLocation];
    }
  }

  // 5. Extract tier
  if (/\b(premium)\b/i.test(clean)) {
    entities.tier = 'Premium';
  } else if (/\b(luxury|lujo)\b/i.test(clean)) {
    entities.tier = 'Luxury';
  } else if (/\b(exclusive|exclusivo|exclusiva)\b/i.test(clean)) {
    entities.tier = 'Exclusive';
  } else if (/\b(curated|curada|curado)\b/i.test(clean)) {
    entities.tier = 'Curated';
  }

  // 6. Detect if it is a property search (rather than travel/lodging)
  const propertyKeywords = [
    'comprar', 'compra', 'casa', 'departamento', 'condominio', 
    'villa', 'propiedad', 'inmueble', 'terreno', 'inversión inmobiliaria', 'inversion inmobiliaria',
    'buy', 'purchase', 'real estate', 'investment'
  ];
  if (propertyKeywords.some(kw => clean.includes(kw)) || entities.offering === 'SALE') {
    entities.isPropertyMode = true;
  }

  return entities;
};

export const isPropertyPublishingTrigger = (prompt: string): boolean => {
  const clean = prompt.toLowerCase().trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!]/g, " ");

  const publishingPatterns = [
    /\b(publicar|subir|anunciar|listar)\s+(?:mi|mis|una|un|la|el)?\s*(?:propiedad|propiedades|inmueble|inmuebles|casa|departamento|terreno|local|oficina)\b/i,
    /\b(?:quiero|deseo|necesito|voy a|me gustaria)\s+(?:vender|publicar|subir|anunciar|listar)\b/i,
    /\b(?:vender|poner en venta|rentar|arrendar)\s+(?:mi|mis|una|un|la|el)\s+(?:propiedad|propiedades|inmueble|inmuebles|casa|departamento|terreno|local|oficina)\b/i,
    /\b(publish|upload|list)\s+(?:my|a|the)?\s*(?:property|properties|house|apartment|land|office)\b/i,
    /\b(?:i want|i need|i would like|want)\s+to\s+(?:sell|publish|upload|list)\b/i,
    /\b(?:sell|put up for sale|rent out)\s+(?:my|a|the)\s+(?:property|house|apartment|land|office)\b/i
  ];
  return publishingPatterns.some((pattern) => pattern.test(clean));
};

export const isPropertySearchTrigger = (prompt: string): boolean => {
  if (isPropertyPublishingTrigger(prompt)) return false;
  return isPropertySearchIntent(prompt);
};

export const resolveIntent = (
  prompt: string,
  intentContext: IntentContext,
  language: string
): IntentResult => {
  // Normalize prompt: lowercase, remove accents, and replace punctuation with spaces to preserve word boundaries
  const clean = prompt.toLowerCase().trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿?¡!]/g, " ");

  console.log("[Eterna Audit] resolveIntent called with prompt:", JSON.stringify(prompt));
  console.log("[Eterna Audit] Normalized clean prompt:", JSON.stringify(clean));

  let patternIdx = 0;
  for (const intent of INTENT_PATTERNS) {
    patternIdx++;
    for (const pattern of intent.patterns) {
      // Normalize the pattern source to remove any accents/diacritics dynamically
      const normalizedSource = pattern.source
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
      const normalizedPattern = new RegExp(normalizedSource, pattern.flags);

      const isMatch = normalizedPattern.test(clean);

      // Specifically log details for queries related to messages / quién me escribió
      if (clean.includes("escribio") || clean.includes("quien")) {
        console.log(`[Eterna Audit] Checking Pattern under Intent Group #${patternIdx}:`, normalizedPattern.toString(), "-> Match Result:", isMatch);
      }
      if (isMatch) {
        // Si es el intent de búsqueda de propiedades y no cumple el criterio del helper, omitimos el match
        const isPropertySearch = intent.action === 'local_response' && 
          intent.patterns.some(p => p.toString().includes('casas en') || p.toString().includes('propiedades de'));

        if (isPropertySearch && !isPropertySearchIntent(clean)) {
          console.log("[Eterna Audit] resolveIntent: Omitiendo coincidencia local de búsqueda inmobiliaria porque isPropertySearchIntent es falso.");
          continue;
        }

        const responseMap = intent.getResponse(intentContext, clean);
        const response = language === 'es' ? responseMap.es : responseMap.en;

        console.log("[Eterna Audit] MATCH SUCCESSFUL!");
        console.log("[Eterna Audit] Matched Route:", intent.route || "None (local response)");
        console.log("[Eterna Audit] Matched Action:", intent.action);
        console.log("[Eterna Audit] Response Generated:", JSON.stringify(response));

        return {
          matched: true,
          route: responseMap.route || intent.route,
          response,
          action: intent.action,
        };
      }
    }
  }

  console.log("[Eterna Audit] resolveIntent matched NO patterns in the catalog.");
  return { matched: false, response: '' };
};
