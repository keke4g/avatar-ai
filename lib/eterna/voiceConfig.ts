import { supabase } from '../supabaseClient';

export type EternaVoiceEngine = 'fishaudio' | 'browser';

export interface EternaVoiceSettings {
  engine: EternaVoiceEngine;
}

export const ETERNA_VOICE_ENGINE_STORAGE_KEY = 'auraswap_eterna_voice_engine';
export const ETERNA_VOICE_ENGINE_EVENT = 'auraswap:eterna-voice-engine-changed';
export const DEFAULT_ETERNA_VOICE_ENGINE: EternaVoiceEngine = 'fishaudio';
const GLOBAL_VOICE_SETTING_KEY = 'eterna_voice';

export const ETERNA_VOICE_ENGINES: Array<{
  id: EternaVoiceEngine;
  name: string;
  voice: string;
  description: string;
  badge: string;
}> = [
  {
    id: 'fishaudio',
    name: 'Fish Audio',
    voice: 'Mujer · Español latinoamericano',
    description: 'Voz principal de Eterna, reproducida en tiempo real mientras Fish genera cada fragmento.',
    badge: 'Predeterminada',
  },
  {
    id: 'browser',
    name: 'Voz del navegador',
    voice: 'Dalia, Sabina o Google Español',
    description: 'Respaldo automático si Fish Audio no está disponible o tarda demasiado.',
    badge: 'Respaldo',
  },
];

export function getEternaVoiceEngine(): EternaVoiceEngine {
  if (typeof window === 'undefined') return DEFAULT_ETERNA_VOICE_ENGINE;
  const stored = window.localStorage.getItem(ETERNA_VOICE_ENGINE_STORAGE_KEY);
  return stored === 'browser' || stored === 'fishaudio'
    ? stored
    : DEFAULT_ETERNA_VOICE_ENGINE;
}

export function saveEternaVoiceEngine(engine: EternaVoiceEngine) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(ETERNA_VOICE_ENGINE_STORAGE_KEY, engine);
  window.dispatchEvent(new CustomEvent(ETERNA_VOICE_ENGINE_EVENT, { detail: { engine } }));
}

export function isEternaVoiceEngine(value: unknown): value is EternaVoiceEngine {
  return value === 'browser' || value === 'fishaudio';
}

export async function loadGlobalEternaVoiceSettings(): Promise<EternaVoiceSettings> {
  const { data, error } = await supabase
    .from('platform_settings')
    .select('voice_engine')
    .eq('key', GLOBAL_VOICE_SETTING_KEY)
    .single();

  if (error) throw error;

  const settings: EternaVoiceSettings = {
    engine: isEternaVoiceEngine(data?.voice_engine) ? data.voice_engine : DEFAULT_ETERNA_VOICE_ENGINE,
  };

  saveEternaVoiceEngine(settings.engine);
  return settings;
}

export async function saveGlobalEternaVoiceSettings(settings: EternaVoiceSettings): Promise<void> {
  const { data, error } = await supabase
    .from('platform_settings')
    .update({
      voice_engine: settings.engine,
      updated_at: new Date().toISOString(),
    })
    .eq('key', GLOBAL_VOICE_SETTING_KEY)
    .select('key')
    .single();

  if (error) throw error;
  if (!data) throw new Error('No se pudo actualizar la configuración global de voz.');

  saveEternaVoiceEngine(settings.engine);
}
