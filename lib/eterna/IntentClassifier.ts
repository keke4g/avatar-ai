import { buyDictionary } from './dictionaries/buy';
import { rentDictionary } from './dictionaries/rent';
import { sellDictionary } from './dictionaries/sell';
import { swapDictionary } from './dictionaries/swap';
import { valuationDictionary } from './dictionaries/valuation';
import { navigationDictionary } from './dictionaries/navigation';
import { supportDictionary } from './dictionaries/support';
import { generalDictionary } from './dictionaries/general';
import { ConversationMemory, ConversationSession } from './ConversationEngine';

export type IntentType = 
  | 'SEARCH_PROPERTY'
  | 'RENT_PROPERTY'
  | 'BUY_PROPERTY'
  | 'SELL_PROPERTY'
  | 'SWAP_PROPERTY'
  | 'PROPERTY_VALUATION'
  | 'GENERAL_CHAT'
  | 'NAVIGATION'
  | 'SUPPORT';

export interface ExtractedSlots {
  ciudad?: string;
  presupuesto?: string;
  habitaciones?: number;
  operacion?: 'compra' | 'renta' | 'venta' | 'swap';
  tipo?: 'casa' | 'departamento';
  caracteristicas?: string[];
}

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
  slots: ExtractedSlots;
  matchedPatterns: string[];
  secondaryIntent?: IntentType;
  decisionReason: string;
  executionTimeMs: number;
}

const INTENT_PRIORITY: IntentType[] = [
  'NAVIGATION',
  'SUPPORT',
  'SELL_PROPERTY',
  'BUY_PROPERTY',
  'RENT_PROPERTY',
  'SWAP_PROPERTY',
  'SEARCH_PROPERTY',
  'PROPERTY_VALUATION',
  'GENERAL_CHAT'
];

export class IntentClassifier {
  
  // Normalization keeping fillers (for phrase matching)
  static getRawNormalized(text: string): string {
    if (!text) return '';
    return text.toLowerCase().trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove accents
      .replace(/[¿?¡!.,;:()"\u201c\u201d\-_]/g, " ") // replace punctuation with spaces
      .replace(/\s+/g, " ")
      .trim();
  }

  // Normalization stripping fillers (for keyword matching)
  static normalizeText(text: string): string {
    let clean = this.getRawNormalized(text);
      
    generalDictionary.fillers.forEach(filler => {
      const normalizedFiller = filler.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const regex = new RegExp(`\\b${normalizedFiller}\\b`, 'gi');
      clean = clean.replace(regex, ' ');
    });
    
    return clean.replace(/\s+/g, " ").trim();
  }

  static cleanForSlotFilling(text: string): string {
    if (!text) return '';
    return text.trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[¿?¡!]/g, " ")
      .replace(/\s+/g, " ");
  }

  static checkNegation(prompt: string, keyword: string): boolean {
    const words = prompt.split(' ');
    const kwIndex = words.indexOf(keyword);
    if (kwIndex === -1) return false;
    
    const start = Math.max(0, kwIndex - 3);
    for (let i = start; i < kwIndex; i++) {
      if (['no', 'nunca', 'not', 'never', 'tampoco', 'jamas', 'no quiero', 'no busco', 'no me interesa'].includes(words[i])) {
        return true;
      }
    }
    return false;
  }

  static extractSlots(prompt: string): ExtractedSlots {
    const cleanRaw = this.cleanForSlotFilling(prompt).toLowerCase();
    const slots: ExtractedSlots = {};

    const hasNegationBefore = (word: string): boolean => {
      const idx = cleanRaw.indexOf(word);
      if (idx === -1) return false;
      const preceding = cleanRaw.substring(Math.max(0, idx - 15), idx).trim();
      return /\b(no|sin|not|without|no quiero|no busco|no me interesa|no me interesan)\b/i.test(preceding);
    };

    // 1. Tipo (property type) with prioritization on the first mentioned
    const houseKeywords = ['casa', 'casas', 'villa', 'villas', 'cabana', 'cabanas', 'beach house', 'cabin', 'vivienda'];
    const aptKeywords = ['departamento', 'departamentos', 'depa', 'depas', 'apartamento', 'apartamentos', 'loft', 'lofts', 'penthouse', 'condominio', 'condominios', 'studio', 'micro-loft'];
    
    let houseIndex = -1;
    for (const kw of houseKeywords) {
      const idx = cleanRaw.indexOf(kw);
      if (idx !== -1 && (houseIndex === -1 || idx < houseIndex)) {
        if (!hasNegationBefore(kw)) {
          houseIndex = idx;
        }
      }
    }

    let aptIndex = -1;
    for (const kw of aptKeywords) {
      const idx = cleanRaw.indexOf(kw);
      if (idx !== -1 && (aptIndex === -1 || idx < aptIndex)) {
        if (!hasNegationBefore(kw)) {
          aptIndex = idx;
        }
      }
    }

    if (houseIndex !== -1 && (aptIndex === -1 || houseIndex < aptIndex)) {
      slots.tipo = 'casa';
    } else if (aptIndex !== -1 && (houseIndex === -1 || aptIndex < houseIndex)) {
      slots.tipo = 'departamento';
    }

    // 2. Ciudad (city)
    const knownCities = [
      { key: 'culiacan', val: 'Culiacán' },
      { key: 'mazatlan', val: 'Mazatlán' },
      { key: 'cancun', val: 'Cancún' },
      { key: 'tulum', val: 'Tulum' },
      { key: 'cozumel', val: 'Cozumel' },
      { key: 'cdmx', val: 'CDMX' },
      { key: 'miami', val: 'Miami' },
      { key: 'los cabos', val: 'Los Cabos' }
    ];

    const matchedCity = knownCities.find(c => cleanRaw.includes(c.key));
    if (matchedCity) {
      slots.ciudad = matchedCity.val;
    } else {
      const cityRegex = /\b(?:en|in|a|to)\s+([a-z]+)\b/i;
      const match = cleanRaw.match(cityRegex);
      if (match && match[1]) {
        const cityExclusions = [
          'renta', 'rentar', 'venta', 'vender', 'comprar', 'compra', 'alquiler', 'alquilar', 'swap', 'swaps', 'intercambio', 'intercambiar',
          'efectivo', 'cash', 'abonos', 'cuotas', 'pesos', 'millones', 'dolares', 'breve', 'abril', 'mayo', 'junio', 'julio', 'agosto',
          'septiembre', 'octubre', 'noviembre', 'diciembre', 'enero', 'febrero', 'marzo', 'casa', 'casas', 'departamento', 'departamentos',
          'apartamento', 'apartamentos', 'depa', 'depas', 'villa', 'villas', 'loft', 'lofts', 'cabana', 'cabaña', 'cabañas', 'penthouse',
          'penthouses', 'propiedad', 'propiedades', 'inversion', 'invertir', 'inversión', 'tres', 'rios', 'ríos', 'zona', 'lugar',
          'vivir', 'inversion', 'invertir', 'inversión', 'plusvalia', 'rentar', 'comprar', 'intercambiar'
        ];
        const extracted = match[1].trim();
        if (!cityExclusions.includes(extracted.toLowerCase()) && extracted.length > 2) {
          slots.ciudad = extracted.charAt(0).toUpperCase() + extracted.slice(1);
        }
      }
    }

    if (cleanRaw.includes('tres rios') || cleanRaw.includes('tres ríos')) {
      slots.ciudad = 'Culiacán';
    }

    // 4. Habitaciones (rooms)
    const roomsMatch = cleanRaw.match(/\b(\d+)\s*(?:habitacion|habitaciones|recamara|recamaras|cuarto|cuartos|recámaras|room|rooms|bedroom|bedrooms|hab|habs)\b/i);
    if (roomsMatch) {
      slots.habitaciones = parseInt(roomsMatch[1]);
    } else {
      const writtenNumbers: Record<string, number> = {
        'un': 1, 'una': 1, 'uno': 1, 'one': 1,
        'dos': 2, 'two': 2,
        'tres': 3, 'three': 3,
        'cuatro': 4, 'four': 4,
        'cinco': 5, 'five': 5
      };
      const words = cleanRaw.split(' ');
      for (let i = 0; i < words.length - 1; i++) {
        const word = words[i];
        const nextWord = words[i+1];
        if (writtenNumbers[word] !== undefined && 
            ['habitacion', 'habitaciones', 'recamara', 'recamaras', 'cuarto', 'cuartos', 'habs', 'dormitorio', 'dormitorios', 'bedroom', 'bedrooms', 'rooms'].some(kw => nextWord.startsWith(kw))) {
          slots.habitaciones = writtenNumbers[word];
          break;
        }
      }
    }

    // Remove rooms pattern text before budget extraction to avoid double matching bare room counts
    let cleanForBudget = cleanRaw;
    if (roomsMatch) {
      cleanForBudget = cleanRaw.replace(roomsMatch[0], ' ');
    }

    // 3. Presupuesto (budget)
    const budgetMatch = cleanForBudget.match(/\b(\d+(?:[\d\s.,]*\d)?\s*(?:millones|millon|mil|usd|pesos|mxn|m|k|mdp)?)\b/i);
    if (budgetMatch) {
      const budgetStr = budgetMatch[1].replace(/[\s,$pesoumxn]/gi, '');
      
      let num = parseFloat(budgetStr);
      if (!isNaN(num) && num > 0) {
        const rawMatch = budgetMatch[1].toLowerCase();
        if (rawMatch.includes('million') || rawMatch.includes('millon') || rawMatch.includes('m') || rawMatch.includes('mdp')) {
          num *= 1000000;
        } else if (rawMatch.includes('mil') || rawMatch.includes('k') || rawMatch.includes('thousand')) {
          num *= 1000;
        }
        
        const isExplicitUnit = rawMatch.includes('mil') || rawMatch.includes('millon') || rawMatch.includes('million') || rawMatch.includes('k') || rawMatch.includes('mdp') || rawMatch.includes('$');
        if (num > 100 || isExplicitUnit) {
          slots.presupuesto = num.toString();
        }
      }
    }

    // 5. Características (features)
    const features: string[] = [];
    if (/\b(alberca|piscina|albercas|pool|pools)\b/i.test(cleanRaw)) {
      features.push('alberca');
    }
    if (/\b(jardin|jardines|jardin|garden|gardens)\b/i.test(cleanRaw)) {
      features.push('jardín');
    }
    if (/\b(vista al mar|ocean view|vista marina|frente al mar)\b/i.test(cleanRaw)) {
      features.push('vista al mar');
    }
    if (/\b(mascota|mascotas|perro|perros|pet|pets|animals)\b/i.test(cleanRaw)) {
      features.push('mascotas');
    }
    if (features.length > 0) {
      slots.caracteristicas = features;
    }

    return slots;
  }

  static classify(prompt: string, session?: ConversationSession): IntentClassification {
    const startTime = performance.now();
    const cleanRawNormalized = this.getRawNormalized(prompt);
    const cleanNormalized = this.normalizeText(prompt);
    
    // Negation detection
    const negationPhrases = [
      'no comprar', 'no rentar', 'no alquiler', 'no alquilar', 'no vender', 'no publicar',
      'no swap', 'no cambiar', 'no intercambio', 'no me interesa vender', 'no me interesa comprar',
      'no me interesa rentar', 'no busco renta', 'no busco comprar', 'no quiero comprar',
      'no quiero rentar', 'no quiero alquilar'
    ];
    const hasStrongNegation = negationPhrases.some(phrase => {
      const normPhrase = phrase.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      return cleanNormalized.includes(normPhrase) || cleanRawNormalized.includes(normPhrase);
    });

    if (hasStrongNegation) {
      const duration = performance.now() - startTime;
      return {
        intent: 'GENERAL_CHAT',
        confidence: 0.90,
        slots: {},
        matchedPatterns: ['strong-negation'],
        decisionReason: 'Strong negation phrase detected. Mapped directly to GENERAL_CHAT.',
        executionTimeMs: duration
      };
    }

    const slots = this.extractSlots(prompt);
    
    const scores: Record<IntentType, number> = {
      NAVIGATION: 0,
      SUPPORT: 0,
      SELL_PROPERTY: 0,
      BUY_PROPERTY: 0,
      RENT_PROPERTY: 0,
      SWAP_PROPERTY: 0,
      SEARCH_PROPERTY: 0,
      PROPERTY_VALUATION: 0,
      GENERAL_CHAT: 0
    };

    const matchedPatterns: string[] = [];

    const applyScoring = (intent: IntentType, dict: { keywords: string[], phrases: string[] }) => {
      // 1. Phrase matches use raw text with fillers intact
      dict.phrases.forEach(phrase => {
        const normPhrase = phrase.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (cleanRawNormalized.includes(normPhrase)) {
          scores[intent] += 5;
          matchedPatterns.push(`phrase:${normPhrase}`);
        }
      });

      // 2. Keyword matches use normalized text without fillers
      dict.keywords.forEach(keyword => {
        const normKeyword = keyword.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const regex = new RegExp(`\\b${normKeyword}\\b`, 'g');
        const matchCount = (cleanNormalized.match(regex) || []).length;
        
        if (matchCount > 0) {
          if (this.checkNegation(cleanNormalized, normKeyword)) {
            scores[intent] -= 10;
            matchedPatterns.push(`negated-keyword:${normKeyword}`);
          } else {
            scores[intent] += 2 * matchCount;
            matchedPatterns.push(`keyword:${normKeyword}`);
          }
        }
      });
    };

    applyScoring('BUY_PROPERTY', buyDictionary);
    applyScoring('RENT_PROPERTY', rentDictionary);
    applyScoring('SELL_PROPERTY', sellDictionary);
    applyScoring('SWAP_PROPERTY', swapDictionary);
    applyScoring('PROPERTY_VALUATION', valuationDictionary);
    applyScoring('NAVIGATION', navigationDictionary);
    applyScoring('SUPPORT', supportDictionary);

    generalDictionary.greetings.forEach(greeting => {
      const normGreeting = greeting.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (cleanRawNormalized.includes(normGreeting)) {
        scores['GENERAL_CHAT'] += 3;
        matchedPatterns.push(`greeting:${normGreeting}`);
      }
    });

    generalDictionary.generalChat.forEach(phrase => {
      const normPhrase = phrase.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (cleanRawNormalized.includes(normPhrase)) {
        scores['GENERAL_CHAT'] += 5;
        matchedPatterns.push(`general-chat:${normPhrase}`);
      }
    });

    // SEARCH_PROPERTY fallback check: if property terms are present
    const propertyTerms = ['casa', 'casas', 'propiedad', 'propiedades', 'departamento', 'departamentos', 'depa', 'depas', 'apartamento', 'apartamentos', 'loft', 'lofts', 'penthouse', 'villa', 'villas', 'cabana', 'cabanas', 'inmueble', 'vivienda', 'donde vivir', 'presupuesto'];
    propertyTerms.forEach(term => {
      if (cleanRawNormalized.includes(term)) {
        scores['SEARCH_PROPERTY'] += 1;
      }
    });

    const isSessionActive = session && session.activeIntent === 'PROPERTY_SEARCH';
    
    // Sort intents by score
    const detected = Object.entries(scores)
      .map(([intent, score]) => ({ intent: intent as IntentType, score }))
      .filter(d => d.score > 0);

    detected.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return INTENT_PRIORITY.indexOf(a.intent) - INTENT_PRIORITY.indexOf(b.intent);
    });

    let primary: IntentType = 'GENERAL_CHAT';
    let secondary: IntentType | undefined;
    let confidence = 0.70; // Default greeting or simple chat confidence
    let decisionReason = 'No strong match found. Defaulting to general chat.';

    if (detected.length > 0) {
      primary = detected[0].intent;
      const primaryScore = detected[0].score;

      if (detected.length > 1 && detected[1].score >= 2) {
        secondary = detected[1].intent;
      }

      const conflictingIntents = detected.slice(1).filter(d => d.intent !== 'SEARCH_PROPERTY' && d.intent !== 'GENERAL_CHAT');
      const secondScore = conflictingIntents.length > 0 ? conflictingIntents[0].score : 0;
      const margin = primaryScore - secondScore;

      if (primary === 'SEARCH_PROPERTY') {
        confidence = 0.55; // Always low confidence for unspecified search operations
        decisionReason = 'Matched property search keywords, but operation is unspecified.';
      } else if (primaryScore >= 5) {
        if (margin <= 1) {
          confidence = 0.50;
          decisionReason = `Close match conflict between ${primary} and ${detected[1].intent} (margin: ${margin}). Marked as ambiguous.`;
        } else {
          confidence = 0.95;
          decisionReason = `Matched full intent phrase patterns with score ${primaryScore}.`;
        }
      } else if (primaryScore >= 2) {
        if (margin <= 1) {
          confidence = 0.50;
          decisionReason = `Close match conflict between ${primary} and ${detected[1].intent} (margin: ${margin}). Marked as ambiguous.`;
        } else {
          confidence = 0.85;
          decisionReason = `Matched strong keyword patterns with score ${primaryScore}.`;
        }
      } else {
        confidence = 0.55;
        decisionReason = `Matched weak keyword patterns with score ${primaryScore}.`;
      }
    } else {
      const hasPropertyKeywords = propertyTerms.some(kw => cleanRawNormalized.includes(kw));
      const hasSlotsExtracted = slots.ciudad || slots.presupuesto || slots.habitaciones || slots.tipo || slots.caracteristicas;
      
      if (hasSlotsExtracted || hasPropertyKeywords) {
        primary = 'SEARCH_PROPERTY';
        confidence = 0.55;
        decisionReason = 'Contains property terms or slots but no transaction operation keywords. Fallback to SEARCH_PROPERTY.';
      } else if (isSessionActive) {
        primary = 'SEARCH_PROPERTY';
        confidence = 0.90;
        decisionReason = 'Inherited active property search session context.';
      }
    }

    if (primary === 'BUY_PROPERTY') {
      slots.operacion = 'compra';
    } else if (primary === 'RENT_PROPERTY') {
      slots.operacion = 'renta';
    } else if (primary === 'SELL_PROPERTY') {
      slots.operacion = 'venta';
    } else if (primary === 'SWAP_PROPERTY') {
      slots.operacion = 'swap';
    }

    const duration = performance.now() - startTime;

    const classificationResult: IntentClassification = {
      intent: primary,
      confidence,
      slots,
      matchedPatterns,
      decisionReason,
      executionTimeMs: duration
    };

    if (secondary) {
      classificationResult.secondaryIntent = secondary;
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[IntentClassifier] Detected: ${primary}, Conf: ${confidence.toFixed(2)}, Slots: ${JSON.stringify(slots)}, ExecTime: ${duration.toFixed(2)}ms, Reason: ${decisionReason}`);
    }

    return classificationResult;
  }

  static buildMemoryFromSlots(slots: ExtractedSlots): ConversationMemory {
    const memory: ConversationMemory = {};
    if (slots.operacion) {
      memory.purpose = {
        value: slots.operacion === 'compra' ? 'inversion' : 'vivir',
        confidence: 1.0
      };
    }
    if (slots.ciudad) {
      memory.city = {
        value: slots.ciudad,
        confidence: 1.0
      };
    }
    if (slots.presupuesto) {
      memory.budget = {
        value: slots.presupuesto,
        confidence: 1.0
      };
    }
    if (slots.habitaciones !== undefined) {
      memory.rooms = {
        value: slots.habitaciones,
        confidence: 1.0
      };
    }
    if (slots.tipo) {
      memory.propertyType = {
        value: slots.tipo,
        confidence: 1.0
      };
    }

    if (slots.caracteristicas) {
      slots.caracteristicas.forEach(feat => {
        if (feat === 'alberca') memory.pool = { value: true, confidence: 1.0 };
        if (feat === 'jardín') memory.garden = { value: true, confidence: 1.0 };
        if (feat === 'vista al mar') memory.oceanView = { value: true, confidence: 1.0 };
        if (feat === 'mascotas') memory.pets = { value: true, confidence: 1.0 };
      });
      memory.preferences = {
        value: slots.caracteristicas.join(', '),
        confidence: 1.0
      };
    }

    return memory;
  }

  static mergeSlotsIntoMemory(currentMemory: ConversationMemory, slots: ExtractedSlots): ConversationMemory {
    const memory = { ...currentMemory };
    const prefilled = this.buildMemoryFromSlots(slots);
    
    Object.keys(prefilled).forEach(key => {
      const existing = memory[key];
      const next = prefilled[key];
      if (!existing || existing.confidence < next.confidence) {
        memory[key] = next;
      }
    });

    return memory;
  }
}
