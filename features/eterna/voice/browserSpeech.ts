export interface SpeechRecognitionAlternative {
  transcript: string;
}

export interface SpeechRecognitionResult {
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

export interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

export interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

export interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onnomatch: (() => void) | null;
  onaudiostart: (() => void) | null;
  onaudioend: (() => void) | null;
  onspeechstart: (() => void) | null;
  onspeechend: (() => void) | null;
}

export type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export function normalizeVoiceText(value: string): string {
  return value
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function voiceTokenOverlap(left: string, right: string): number {
  const leftTokens = new Set(left.split(' ').filter(Boolean));
  const rightTokens = new Set(right.split(' ').filter(Boolean));
  if (!leftTokens.size || !rightTokens.size) return 0;

  let shared = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) shared += 1;
  });
  return shared / Math.max(leftTokens.size, rightTokens.size);
}

function isFemaleVoiceName(name: string): boolean {
  const normalizedName = name.toLowerCase();
  return [
    'female',
    'femenino',
    'zira',
    'dalia',
    'elena',
    'sabina',
    'pilar',
    'clara',
    'helena',
    'google',
    'monica',
    'luz',
  ].some((cue) => normalizedName.includes(cue));
}

export function selectPremiumVoiceWithReason(): {
  voice: SpeechSynthesisVoice | null;
  reason: string;
} {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return { voice: null, reason: 'SpeechSynthesis no está disponible en el objeto global window.' };
  }

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) {
    return {
      voice: null,
      reason: 'SpeechSynthesis.getVoices() devolvió una lista vacía. Posible retraso en la carga del navegador.',
    };
  }

  const esUS = voices.find((voice) => (
    voice.name === 'Google español de Estados Unidos'
    || voice.lang === 'es-US'
    || voice.lang === 'es_US'
  ));
  if (esUS) return { voice: esUS, reason: 'Forzada: Google español de Estados Unidos (es-US)' };

  const mexicanFemale = voices.find((voice) => {
    const name = voice.name.toLowerCase();
    const isMexican = voice.lang.toLowerCase().replace('_', '-').startsWith('es-mx');
    return isMexican && ['dalia', 'sabina', 'renata', 'larissa'].some((cue) => name.includes(cue));
  });
  if (mexicanFemale) {
    return {
      voice: mexicanFemale,
      reason: `Voz femenina nativa de México: ${mexicanFemale.name}`,
    };
  }

  const esES = voices.find((voice) => (
    voice.name === 'Google español'
    || voice.lang === 'es-ES'
    || voice.lang === 'es_ES'
  ));
  if (esES) return { voice: esES, reason: 'Coincidencia secundaria: Google español (es-ES)' };

  const spanishVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith('es'));
  const elena = spanishVoices.find((voice) => voice.name.toLowerCase().includes('elena'));
  if (elena) return { voice: elena, reason: 'Microsoft Elena (es-ES)' };

  const esMXFemale = spanishVoices.find((voice) => (
    voice.lang.toLowerCase().includes('mx') && isFemaleVoiceName(voice.name)
  ));
  if (esMXFemale) {
    return {
      voice: esMXFemale,
      reason: 'Se encontró una voz identificada como femenina para la región es-MX.',
    };
  }

  const esMXAny = spanishVoices.find((voice) => voice.lang.toLowerCase().includes('mx'));
  if (esMXAny) {
    return {
      voice: esMXAny,
      reason: 'No se halló voz femenina en es-MX; se seleccionó la única voz es-MX disponible.',
    };
  }

  const esESFemale = spanishVoices.find((voice) => (
    voice.lang.toLowerCase().includes('es') && isFemaleVoiceName(voice.name)
  ));
  if (esESFemale) {
    return {
      voice: esESFemale,
      reason: 'Se encontró una voz identificada como femenina para la región es-ES.',
    };
  }

  const esESAny = spanishVoices.find((voice) => voice.lang.toLowerCase().includes('es'));
  if (esESAny) {
    return {
      voice: esESAny,
      reason: 'No se halló voz femenina en es-ES; se seleccionó la única voz es-ES disponible.',
    };
  }

  if (spanishVoices.length > 0) {
    return {
      voice: spanishVoices[0],
      reason: 'Se seleccionó el primer recurso en idioma español de la lista.',
    };
  }

  const defaultVoice = voices.find((voice) => voice.default);
  if (defaultVoice) {
    return {
      voice: defaultVoice,
      reason: 'No hay voces en español disponibles. Se seleccionó la voz predeterminada del sistema de fallback total.',
    };
  }

  return {
    voice: voices[0] || null,
    reason: 'No hay voces en español ni predeterminadas. Se seleccionó la primera voz absoluta devuelta por el sistema.',
  };
}
