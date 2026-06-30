import { extractEntities } from './IntentRouter';

export enum ConversationIntent {
  PROPERTY_SEARCH = "PROPERTY_SEARCH",
  SELL_PROPERTY = "SELL_PROPERTY",
  PROPERTY_VALUATION = "PROPERTY_VALUATION",
  INVESTMENT = "INVESTMENT",
  GENERAL_CHAT = "GENERAL_CHAT",
  NONE = "NONE"
}

export enum ConversationStatus {
  IDLE = "IDLE",
  COLLECTING = "COLLECTING",
  THINKING = "THINKING",
  CONFIRMING = "CONFIRMING",
  SEARCHING = "SEARCHING",
  RESPONDING = "RESPONDING",
  COMPLETED = "COMPLETED"
}

export type ConversationStep =
  | "purpose"
  | "city"
  | "budget"
  | "rooms"
  | "preferences"
  | "confirm"
  | "completed";

export interface MemoryField<T> {
  value: T;
  confidence: number;
}

export interface ConversationMemory {
  purpose?: MemoryField<'vivir' | 'inversion' | string>;
  city?: MemoryField<string>;
  zone?: MemoryField<string>;
  propertyType?: MemoryField<string>;
  budget?: MemoryField<string>;
  currency?: MemoryField<string>;
  rooms?: MemoryField<number>;
  bathrooms?: MemoryField<number>;
  parking?: MemoryField<number>;
  pool?: MemoryField<boolean>;
  garden?: MemoryField<boolean>;
  pets?: MemoryField<boolean>;
  oceanView?: MemoryField<boolean>;
  deliveryDate?: MemoryField<string>;
  preferences?: MemoryField<string>;
  extras?: MemoryField<string>;
}

export interface ConversationSession {
  activeIntent: ConversationIntent;
  status: ConversationStatus;
  step: ConversationStep;
  memory: ConversationMemory;
  createdAt: number;
  updatedAt: number;
}

export class ConversationEngine {
  // Extract entities from user prompt and merge into existing memory
  static parseAllEntities(
    prompt: string,
    currentMemory: ConversationMemory,
    currentStep: ConversationStep
  ): ConversationMemory {
    const memory: ConversationMemory = { ...currentMemory };
    const clean = prompt.toLowerCase().trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[¿?¡!]/g, " ");

    const setField = <K extends keyof ConversationMemory>(
      key: K,
      value: unknown,
      confidence: number
    ) => {
      const existing = memory[key];
      if (!existing || existing.confidence < confidence) {
        memory[key] = { value, confidence } as unknown as ConversationMemory[K];
      }
    };

    // 1. Parse purpose
    if (/\b(vivir|residir|habitar|mi familia|casa propia|mi hogar|live|reside|dwelling|home)\b/i.test(clean)) {
      setField('purpose', 'vivir', 0.95);
    } else if (/\b(inversion|invertir|negocio|rendimiento|retorno|inversión|invest|investment|business|rent|rental)\b/i.test(clean)) {
      setField('purpose', 'inversion', 0.95);
    }

    // 2. Parse city
    const extractedDest = extractEntities(prompt).destination;
    if (extractedDest) {
      setField('city', extractedDest, 0.95);
    } else {
      const knownLocations = ['cancun', 'tulum', 'cozumel', 'cdmx', 'miami', 'mazatlan', 'los cabos'];
      const matched = knownLocations.find(loc => clean.includes(loc));
      if (matched) {
        const properNames: Record<string, string> = {
          'cancun': 'Cancún',
          'tulum': 'Tulum',
          'cozumel': 'Cozumel',
          'cdmx': 'CDMX',
          'miami': 'Miami',
          'mazatlan': 'Mazatlán',
          'los cabos': 'Los Cabos'
        };
        setField('city', properNames[matched], 0.95);
      }
    }

    // 3. Parse rooms
    const roomsMatch = clean.match(/\b(\d+)\s*(?:habitacion|habitaciones|recamara|recamaras|cuarto|cuartos|hab|habs|dormitorio|dormitorios|recámaras|room|rooms|bedroom|bedrooms)\b/i);
    if (roomsMatch) {
      setField('rooms', parseInt(roomsMatch[1]), 0.98);
    }

    // 4. Parse budget
    const budgetMatch = clean.match(/\b(\d+[\d\s.,]*\s*(?:millones|mil|usd|dolares|dólares|pesos|mxn|m)?)\b/i);
    const hasBudgetKeyword = /\b(presupuesto|costo|precio|maximo|limite|budget|price|max|limit)\b/i.test(clean);
    if (hasBudgetKeyword && budgetMatch) {
      setField('budget', budgetMatch[1].trim(), 0.95);
    } else {
      const moneyMatch = clean.match(/\b(?:\$|usd|mxn)?\s*(\d+[\d\s.,]*\s*(?:millones|mil|usd|dolares|dólares|pesos|mxn|m))\b/i);
      if (moneyMatch) {
        setField('budget', moneyMatch[0].trim(), 0.95);
      }
    }

    // 5. Parse extras/preferences
    if (/\b(alberca|piscina|albercas|pool|pools)\b/i.test(clean)) {
      setField('pool', true, 0.98);
    }
    if (/\b(jardin|jardines|jardín|garden|gardens)\b/i.test(clean)) {
      setField('garden', true, 0.98);
    }
    if (/\b(vista al mar|ocean view|vista marina|frente al mar)\b/i.test(clean)) {
      setField('oceanView', true, 0.98);
    }

    // Step-specific direct fallbacks (highest relevance when explicitly answering a prompt)
    if (currentStep === 'purpose' && !memory.purpose) {
      if (clean.includes('vivir') || clean.includes('hogar')) {
        setField('purpose', 'vivir', 0.90);
      } else if (clean.includes('invers') || clean.includes('invert')) {
        setField('purpose', 'inversion', 0.90);
      }
    } else if (currentStep === 'city' && !memory.city) {
      // Exclude simple fillers
      const fillers = ['quiero', 'busco', 'en', 'a', 'in', 'la', 'el', 'ciudad', 'city'];
      const words = prompt.trim().split(/\s+/).filter(w => !fillers.includes(w.toLowerCase()));
      if (words.length > 0) {
        setField('city', words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), 0.90);
      }
    } else if (currentStep === 'budget' && !memory.budget) {
      setField('budget', prompt.trim(), 0.90);
    } else if (currentStep === 'rooms' && memory.rooms === undefined) {
      const numMatch = clean.match(/\b(\d+)\b/);
      if (numMatch) {
        setField('rooms', parseInt(numMatch[1]), 0.90);
      }
    } else if (currentStep === 'preferences' && !memory.preferences) {
      setField('preferences', prompt.trim(), 0.90);
    }

    return memory;
  }

  // Find the next empty step in order
  static getNextStep(memory: ConversationMemory): ConversationStep {
    if (!memory.purpose) return 'purpose';
    if (!memory.city) return 'city';
    if (!memory.budget) return 'budget';
    if (memory.rooms === undefined) return 'rooms';
    if (!memory.preferences) return 'preferences';
    return 'confirm';
  }

  // Generate question or confirmation summary based on current step and language
  static ask(
    step: ConversationStep,
    memory: ConversationMemory,
    language: string
  ): string {
    const isEs = language === 'es';
    switch (step) {
      case 'purpose':
        return isEs
          ? '¿Buscas la propiedad para vivir o como inversión?'
          : 'Are you looking for the property to live in or as an investment?';
      case 'city':
        return isEs
          ? '¿En qué ciudad o zona estás buscando?'
          : 'Which city or area are you looking in?';
      case 'budget':
        return isEs
          ? '¿Cuál es tu presupuesto aproximado?'
          : 'What is your approximate budget?';
      case 'rooms':
        return isEs
          ? '¿Cuántas habitaciones necesitas?'
          : 'How many rooms do you need?';
      case 'preferences':
        return isEs
          ? '¿Tienes alguna preferencia adicional? (alberca, jardín, vista al mar, etc. - puedes responder "ninguna")'
          : 'Do you have any additional preferences? (pool, garden, ocean view, etc. - you can answer "none")';
      case 'confirm': {
        const purp = memory.purpose?.value === 'vivir'
          ? (isEs ? 'Vivir' : 'To live in')
          : (isEs ? 'Inversión' : 'Investment');
        const city = memory.city?.value || '';
        const bud = memory.budget?.value || '';
        const rms = memory.rooms?.value || '';
        const pref = memory.preferences?.value || (isEs ? 'Ninguna' : 'None');

        const extras: string[] = [];
        if (memory.pool?.value) extras.push(isEs ? 'Alberca' : 'Pool');
        if (memory.garden?.value) extras.push(isEs ? 'Jardín' : 'Garden');
        if (memory.oceanView?.value) extras.push(isEs ? 'Vista al mar' : 'Ocean View');
        const extrasStr = extras.length > 0
          ? ` (${isEs ? 'con' : 'with'} ${extras.join(', ')})`
          : '';

        return isEs
          ? `Perfecto. Buscaré:\n` +
            `• Propósito: ${purp}\n` +
            `• Ciudad: ${city}\n` +
            `• Presupuesto: ${bud}\n` +
            `• Habitaciones: ${rms}\n` +
            `• Preferencias: ${pref}${extrasStr}\n\n` +
            `¿Es correcto? (Sí / No / Modificar [campo])`
          : `Perfect. I will look for:\n` +
            `• Purpose: ${purp}\n` +
            `• City: ${city}\n` +
            `• Budget: ${bud}\n` +
            `• Rooms: ${rms}\n` +
            `• Preferences: ${pref}${extrasStr}\n\n` +
            `Is this correct? (Yes / No / Modify [field])`;
      }
      default:
        return '';
    }
  }

  // Detect explicit cancellations or restart triggers
  static checkInterruption(prompt: string): boolean {
    const clean = prompt.toLowerCase().trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[¿?¡!]/g, " ");

    const cancelPatterns = [
      /\b(cancelar|olvidalo|olvídelo|olvidar|detener|parar|abortar|cancel|forget|stop|abort)\b/i,
      /\b(iniciar de nuevo|comenzar de nuevo|empecemos de nuevo|reset|start over)\b/i,
      /\b(olvida la busqueda|olvida la búsqueda|cancelar busqueda|cancelar búsqueda)\b/i
    ];
    return cancelPatterns.some(p => p.test(clean));
  }
}
