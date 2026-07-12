export type EternaVoiceEngine = 'elevenlabs' | 'deepgram' | 'browser' | 'azure';
export type DeepgramVoiceProfile = 'executive' | 'mexico';

export const ETERNA_VOICE_ENGINE_STORAGE_KEY = 'auraswap_eterna_voice_engine';
export const ETERNA_VOICE_ENGINE_EVENT = 'auraswap:eterna-voice-engine-changed';
export const DEEPGRAM_VOICE_PROFILE_STORAGE_KEY = 'auraswap_deepgram_voice_profile';
export const DEFAULT_ETERNA_VOICE_ENGINE: EternaVoiceEngine = 'deepgram';
export const DEFAULT_DEEPGRAM_VOICE_PROFILE: DeepgramVoiceProfile = 'executive';

export const DEEPGRAM_VOICE_PROFILES: Array<{
  id: DeepgramVoiceProfile;
  name: string;
  voice: string;
  description: string;
}> = [
  {
    id: 'executive',
    name: 'Ejecutiva',
    voice: 'Diana · Español profesional',
    description: 'Tono corporativo, seguro, pulido y persuasivo para asesoría inmobiliaria premium.',
  },
  {
    id: 'mexico',
    name: 'México',
    voice: 'Estrella · Español (México)',
    description: 'Voz femenina mexicana, madura, natural y cálida.',
  },
];

export const ETERNA_VOICE_ENGINES: Array<{
  id: EternaVoiceEngine;
  name: string;
  voice: string;
  description: string;
  badge: string;
}> = [
  {
    id: 'deepgram',
    name: 'Deepgram Aura-2',
    voice: 'Estrella · Español (México)',
    description: 'Voz femenina mexicana, natural y expresiva, optimizada para respuestas conversacionales de muy baja latencia.',
    badge: 'Recomendada',
  },
  {
    id: 'elevenlabs',
    name: 'ElevenLabs',
    voice: 'Sarah · Turbo v2.5',
    description: 'Voz femenina cálida y expresiva con equilibrio entre naturalidad, definición y velocidad conversacional.',
    badge: 'Alta fidelidad',
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
  return stored === 'browser' || stored === 'azure' || stored === 'elevenlabs' || stored === 'deepgram'
    ? stored
    : DEFAULT_ETERNA_VOICE_ENGINE;
}

export function saveEternaVoiceEngine(engine: EternaVoiceEngine) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ETERNA_VOICE_ENGINE_STORAGE_KEY, engine);
  window.dispatchEvent(new CustomEvent(ETERNA_VOICE_ENGINE_EVENT, { detail: { engine } }));
}

export function getDeepgramVoiceProfile(): DeepgramVoiceProfile {
  if (typeof window === 'undefined') return DEFAULT_DEEPGRAM_VOICE_PROFILE;
  return window.localStorage.getItem(DEEPGRAM_VOICE_PROFILE_STORAGE_KEY) === 'mexico'
    ? 'mexico'
    : DEFAULT_DEEPGRAM_VOICE_PROFILE;
}

export function saveDeepgramVoiceProfile(profile: DeepgramVoiceProfile) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEEPGRAM_VOICE_PROFILE_STORAGE_KEY, profile);
}
