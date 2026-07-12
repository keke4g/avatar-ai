export type EternaVoiceEngine = 'elevenlabs' | 'browser' | 'azure';

export const ETERNA_VOICE_ENGINE_STORAGE_KEY = 'auraswap_eterna_voice_engine';
export const ETERNA_VOICE_ENGINE_EVENT = 'auraswap:eterna-voice-engine-changed';
export const DEFAULT_ETERNA_VOICE_ENGINE: EternaVoiceEngine = 'elevenlabs';

export const ETERNA_VOICE_ENGINES: Array<{
  id: EternaVoiceEngine;
  name: string;
  voice: string;
  description: string;
  badge: string;
}> = [
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    voice: 'Sarah · Flash v2.5',
    description: 'Voz femenina cálida y expresiva con el modelo de baja latencia optimizado para conversaciones en tiempo real.',
    badge: 'Recomendada',
  },
  {
    id: 'azure',
    name: 'Azure Neural Voice',
    voice: 'Dalia Neural · Español (México)',
    description: 'Alternativa neural con acento mexicano nativo y una capa gratuita amplia. Requiere credenciales de Azure Speech.',
    badge: 'Gratis 500k caracteres',
  },
  {
    id: 'browser',
    name: 'Voz del navegador',
    voice: 'Dalia, Sabina o Google Español',
    description: 'Funciona sin consumir créditos ni configurar APIs. La calidad depende del navegador y del dispositivo.',
    badge: 'Siempre disponible',
  },
];

export function getEternaVoiceEngine(): EternaVoiceEngine {
  if (typeof window === 'undefined') return DEFAULT_ETERNA_VOICE_ENGINE;
  const stored = window.localStorage.getItem(ETERNA_VOICE_ENGINE_STORAGE_KEY);
  return stored === 'browser' || stored === 'azure' || stored === 'elevenlabs'
    ? stored
    : DEFAULT_ETERNA_VOICE_ENGINE;
}

export function saveEternaVoiceEngine(engine: EternaVoiceEngine) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ETERNA_VOICE_ENGINE_STORAGE_KEY, engine);
  window.dispatchEvent(new CustomEvent(ETERNA_VOICE_ENGINE_EVENT, { detail: { engine } }));
}
