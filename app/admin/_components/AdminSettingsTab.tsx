'use client';

import { Check, DollarSign, Radio, Volume2, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/context/LanguageContext';
import {
  ETERNA_VOICE_ENGINES,
  type EternaVoiceEngine,
} from '@/lib/eterna/voiceConfig';

interface AdminSettingsTabProps {
  verificationFee: number;
  commissionRate: number;
  geminiActive: boolean;
  voiceEngine: EternaVoiceEngine;
  voiceEngineStatus: Record<EternaVoiceEngine, boolean>;
  saving: boolean;
  success: boolean;
  error: string;
  onVerificationFeeChange: (value: number) => void;
  onCommissionRateChange: (value: number) => void;
  onToggleGemini: () => void;
  onVoiceEngineChange: (engine: EternaVoiceEngine) => void;
  onSave: () => void;
}

export function AdminSettingsTab({
  verificationFee,
  commissionRate,
  geminiActive,
  voiceEngine,
  voiceEngineStatus,
  saving,
  success,
  error,
  onVerificationFeeChange,
  onCommissionRateChange,
  onToggleGemini,
  onVoiceEngineChange,
  onSave,
}: AdminSettingsTabProps) {
  const { t } = useTranslation();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white border border-brand-gray-200/70 rounded-3xl shadow-premium p-6 sm:p-8"
    >
      <div className="mb-6">
        <h2 className="text-base font-black text-brand-black tracking-tight">{t('admin.settingsTitle')}</h2>
        <p className="text-xs text-brand-gray-500 mt-0.5">{t('admin.settingsDesc')}</p>
      </div>

      <div className="flex flex-col gap-6 max-w-3xl">
        <div className="flex flex-col gap-2">
          <label className="text-xs font-black text-brand-black">{t('admin.verifFeeLabel')}</label>
          <div className="relative">
            <DollarSign className="w-4 h-4 text-brand-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="number"
              value={verificationFee}
              onChange={(event) => onVerificationFeeChange(Number(event.target.value))}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-brand-gray-200/60 focus:outline-none focus:border-brand-accent text-xs font-bold bg-brand-gray-50/50"
            />
          </div>
          <span className="text-[10px] text-brand-gray-400 leading-normal mt-0.5">{t('admin.settingsVerifDesc')}</span>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-black text-brand-black">{t('admin.serviceFeeLabel')}</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.5"
              max="5.0"
              step="0.1"
              value={commissionRate}
              onChange={(event) => onCommissionRateChange(Number(event.target.value))}
              className="w-full accent-brand-accent cursor-pointer"
            />
            <span className="text-xs font-black text-brand-black shrink-0 px-2 py-1 bg-brand-gray-100 rounded-lg">{commissionRate}%</span>
          </div>
          <span className="text-[10px] text-brand-gray-400 leading-normal mt-0.5">{t('admin.settingsCommDesc')}</span>
        </div>

        <div className="flex flex-col gap-2 pt-4 border-t border-brand-gray-100 mt-2">
          <label className="text-xs font-black text-brand-black flex items-center justify-between">
            <span>Modo Cerebro Gemini</span>
            <button
              type="button"
              onClick={onToggleGemini}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 ${
                geminiActive ? 'bg-brand-accent' : 'bg-brand-gray-200'
              }`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                geminiActive ? 'translate-x-5' : 'translate-x-0'
              }`} />
            </button>
          </label>
          <span className="text-[10px] text-brand-gray-400 leading-normal">
            {geminiActive
              ? 'Conectada a Gemini: Eterna procesará cada mensaje directamente con Gemini Flash.'
              : 'Desconectada: Eterna usará la API del servidor local o el motor viejo.'}
          </span>
        </div>

        <div className="flex flex-col gap-4 pt-5 border-t border-brand-gray-100 mt-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-brand-accent" />
                <h3 className="text-xs font-black text-brand-black">Motor de voz de Eterna</h3>
              </div>
              <p className="text-[10px] text-brand-gray-400 leading-relaxed mt-1 max-w-xl">
                Selecciona cómo se sintetizan las respuestas habladas. Si un proveedor externo no está disponible, Eterna cambia automáticamente a la voz del navegador.
              </p>
            </div>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-gray-50 border border-brand-gray-200 text-[9px] font-black uppercase tracking-wider text-brand-gray-500">
              <Radio className="w-3 h-3" /> TTS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {ETERNA_VOICE_ENGINES.map((engine) => {
              const selected = voiceEngine === engine.id;
              const configured = voiceEngineStatus[engine.id];
              return (
                <button
                  key={engine.id}
                  type="button"
                  onClick={() => onVoiceEngineChange(engine.id)}
                  className={`relative text-left rounded-2xl border p-4 transition-all cursor-pointer ${
                    selected
                      ? 'border-brand-accent bg-brand-accent/[0.045] shadow-[0_10px_30px_rgba(99,102,241,0.10)]'
                      : 'border-brand-gray-200 bg-brand-gray-50/40 hover:bg-white hover:border-brand-gray-300'
                  }`}
                >
                  <span className={`absolute top-3 right-3 w-4 h-4 rounded-full border flex items-center justify-center ${selected ? 'bg-brand-accent border-brand-accent' : 'bg-white border-brand-gray-300'}`}>
                    {selected && <Check className="w-2.5 h-2.5 text-white" />}
                  </span>
                  <div className="pr-5">
                    <div className="flex items-center gap-1.5 mb-2">
                      {engine.id === 'fishaudio'
                        ? <Zap className="w-3.5 h-3.5 text-brand-accent" />
                        : <Volume2 className="w-3.5 h-3.5 text-brand-gray-500" />}
                      <span className="text-[11px] font-black text-brand-black">{engine.name}</span>
                    </div>
                    <p className="text-[10px] font-bold text-brand-gray-600 leading-snug">{engine.voice}</p>
                    <p className="mt-2 text-[9px] text-brand-gray-400 leading-relaxed">{engine.description}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-1 rounded-full bg-white border border-brand-gray-200 text-[8px] font-black uppercase tracking-wide text-brand-gray-500">{engine.badge}</span>
                    <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-wide ${configured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-700'}`}>
                      {configured ? 'Configurado' : 'Falta configurar'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {voiceEngine === 'fishaudio' && !voiceEngineStatus.fishaudio && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-[10px] font-semibold leading-relaxed text-amber-800">
              Para activar Fish Audio agrega <code>FISH_AUDIO_API_KEY</code> en Vercel. Opcionalmente puedes definir <code>FISH_AUDIO_VOICE_ID</code> para usar una voz propia.
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-brand-gray-100 mt-2">
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="w-full py-3 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 disabled:cursor-wait disabled:opacity-60 text-white font-bold text-xs tracking-wider uppercase transition-colors shadow-sm select-none cursor-pointer"
          >
            {saving ? 'Guardando para todos los dispositivos…' : t('admin.settingsSave')}
          </button>

          {success && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-3 bg-emerald-50 border border-emerald-250 rounded-xl text-center text-xs font-bold text-emerald-600">
              {t('admin.settingsSuccess')}
            </motion.div>
          )}
          {error && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-center text-xs font-bold text-rose-700">
              {error}
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
