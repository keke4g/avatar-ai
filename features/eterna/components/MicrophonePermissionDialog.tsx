'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Mic,
  MicOff,
  Settings,
  ShieldCheck,
  Smartphone,
  X,
} from 'lucide-react';

import type {
  MobileBrowserGuide,
  MicrophoneIssue,
} from '@/features/eterna/lib/microphoneSupport';

interface MicrophonePermissionDialogProps {
  open: boolean;
  language: 'es' | 'en';
  issue: MicrophoneIssue;
  guide: MobileBrowserGuide;
  showInstructions: boolean;
  checking: boolean;
  onClose: () => void;
  onRetry: () => void;
  onWrite: () => void;
  onToggleInstructions: () => void;
}

function getIssueCopy(language: 'es' | 'en', issue: MicrophoneIssue) {
  const spanish = {
    denied: {
      title: 'Activa el micrófono para hablar',
      description: 'El permiso está bloqueado para Towers México. Actívalo una sola vez y Eterna podrá escucharte desde este navegador.',
    },
    'not-found': {
      title: 'No encontramos un micrófono',
      description: 'Revisa que tu teléfono tenga un micrófono disponible y que no esté desconectado.',
    },
    busy: {
      title: 'El micrófono está ocupado',
      description: 'Otra aplicación puede estar usando el micrófono. Ciérrala y vuelve a intentarlo.',
    },
    unsupported: {
      title: 'El navegador no admite el micrófono',
      description: 'Abre Towers México en Safari o Chrome actualizado para conversar por voz.',
    },
    unknown: {
      title: 'No pudimos abrir el micrófono',
      description: 'Ocurrió un problema al iniciar el audio. Puedes volver a intentarlo.',
    },
  } satisfies Record<MicrophoneIssue, { title: string; description: string }>;

  const english = {
    denied: {
      title: 'Enable the microphone to talk',
      description: 'Microphone access is blocked for Towers México. Enable it once so Eterna can listen in this browser.',
    },
    'not-found': {
      title: 'No microphone was found',
      description: 'Check that your device has an available microphone and that it is connected.',
    },
    busy: {
      title: 'The microphone is busy',
      description: 'Another app may be using the microphone. Close it and try again.',
    },
    unsupported: {
      title: 'This browser cannot use the microphone',
      description: 'Open Towers México in an updated version of Safari or Chrome to use voice.',
    },
    unknown: {
      title: 'We could not open the microphone',
      description: 'There was a problem starting audio. You can try again.',
    },
  } satisfies Record<MicrophoneIssue, { title: string; description: string }>;

  return (language === 'es' ? spanish : english)[issue];
}

export default function MicrophonePermissionDialog({
  open,
  language,
  issue,
  guide,
  showInstructions,
  checking,
  onClose,
  onRetry,
  onWrite,
  onToggleInstructions,
}: MicrophonePermissionDialogProps) {
  const copy = getIssueCopy(language, issue);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[99999] flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-md sm:items-center sm:p-4"
          role="presentation"
        >
          <motion.div
            initial={{ y: 32, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex max-h-[92dvh] w-full max-w-[460px] select-none flex-col overflow-y-auto rounded-t-[30px] border border-slate-700/80 bg-slate-950 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 text-slate-100 shadow-[0_-24px_80px_rgba(2,6,23,0.38)] sm:rounded-[30px] sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="microphone-permission-title"
          >
            <div className="mx-auto mb-4 h-1 w-11 rounded-full bg-slate-700 sm:hidden" aria-hidden="true" />

            <button
              onClick={onClose}
              className="absolute right-4 top-4 cursor-pointer rounded-full border border-slate-700 bg-slate-900 p-2.5 text-slate-400 transition-colors hover:text-white"
              aria-label={language === 'es' ? 'Cerrar ayuda del micrófono' : 'Close microphone help'}
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-4 flex items-center gap-3 pr-12">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${
                issue === 'denied'
                  ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                  : 'border-rose-400/30 bg-rose-400/10 text-rose-300'
              }`}>
                {issue === 'denied' ? <Settings className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
              </div>
              <div className="min-w-0 text-left">
                <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                  Eterna Concierge
                </span>
                <h3 id="microphone-permission-title" className="text-xl font-black leading-tight text-white">
                  {copy.title}
                </h3>
              </div>
            </div>

            <p className="mb-4 text-left text-sm font-medium leading-relaxed text-slate-300">
              {copy.description}
            </p>

            <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 text-left">
              <Smartphone className="h-5 w-5 shrink-0 text-cyan-400" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  {language === 'es' ? 'Guía detectada' : 'Detected guide'}
                </p>
                <p className="truncate text-sm font-bold text-slate-100">
                  {guide.deviceLabel} · {guide.browserLabel}
                </p>
              </div>
            </div>

            <AnimatePresence>
              {showInstructions && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mb-4 overflow-hidden"
                >
                  <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-4 text-left">
                    <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
                      <ShieldCheck className="h-4 w-4" />
                      {language === 'es' ? 'Cómo activarlo' : 'How to enable it'}
                    </div>
                    <ol className="space-y-3">
                      {guide.steps.map((step, index) => (
                        <li key={step} className="flex gap-3 text-xs font-medium leading-relaxed text-slate-200">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-400 text-[10px] font-black text-slate-950">
                            {index + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex w-full flex-col gap-2">
              <button
                onClick={onRetry}
                disabled={checking}
                className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-cyan-400 py-3.5 text-xs font-black uppercase tracking-[0.12em] text-slate-950 shadow-lg shadow-cyan-950/20 transition-all hover:bg-cyan-300 active:scale-[0.99] disabled:cursor-wait disabled:opacity-70"
              >
                {checking ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950/30 border-t-slate-950" />
                ) : (
                  <Mic className="h-4 w-4" />
                )}
                {language === 'es'
                  ? checking ? 'Comprobando…' : 'Comprobar permiso'
                  : checking ? 'Checking…' : 'Check permission'}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={onWrite}
                  className="flex-1 cursor-pointer rounded-xl border border-slate-800 bg-slate-900 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-300 transition-all hover:border-slate-700 hover:text-white active:scale-[0.99]"
                >
                  {language === 'es' ? 'Escribir' : 'Write'}
                </button>
                <button
                  onClick={onToggleInstructions}
                  className="flex-1 cursor-pointer rounded-xl border border-slate-800 bg-slate-900 py-2.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-300 transition-all hover:border-slate-700 hover:text-white active:scale-[0.99]"
                >
                  {language === 'es'
                    ? showInstructions ? 'Ocultar pasos' : 'Cómo activarlo'
                    : showInstructions ? 'Hide steps' : 'Instructions'}
                </button>
              </div>

              {issue === 'denied' && (
                <div className="mt-1 flex items-start gap-2 px-1 text-left text-[10px] font-medium leading-relaxed text-slate-500">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {language === 'es'
                      ? 'Por seguridad, el navegador no permite que Towers México abra directamente los ajustes del teléfono.'
                      : 'For security, the browser does not let Towers México open your phone settings directly.'}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
