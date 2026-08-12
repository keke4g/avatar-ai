import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, Square } from 'lucide-react';
import Image from 'next/image';

import { VideoAvatar } from '@/components/VideoAvatar';

import type {
  EternaLauncherActions,
  EternaLauncherViewModel,
} from './types';

interface EternaLauncherProps {
  actions: EternaLauncherActions;
  model: EternaLauncherViewModel;
}

export function EternaLauncher({ actions, model }: EternaLauncherProps) {
  const {
    activeStatus,
    isDiscrete,
    isHydrated,
    isListening,
    isPropertyPage,
    language,
    partialTranscript,
    showTooltip,
    userName,
    visible,
    voiceAction,
  } = model;
  const firstName = isHydrated && userName ? userName.split(' ')[0] : null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-eterna-ui
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{
            opacity: isDiscrete ? 0.4 : 1,
            scale: isDiscrete ? 0.5 : 1,
            y: 0,
          }}
          whileHover={{
            opacity: isDiscrete ? 0.85 : 1,
            scale: isDiscrete ? 0.65 : 1.05,
          }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          className={`fixed z-40 flex items-center origin-bottom-right ${isPropertyPage ? 'bottom-4 right-4' : 'bottom-6 right-6'}`}
        >
          <AnimatePresence>
            {showTooltip && !isDiscrete && !isPropertyPage && (
              <motion.div
                initial={{ opacity: 0, x: -20, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.95 }}
                className="absolute right-[84px] bottom-1 px-4 py-3 bg-slate-950/90 text-white rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/10 text-xs font-semibold whitespace-nowrap backdrop-blur-md flex flex-col gap-1 z-30 select-none pointer-events-none"
              >
                <span className="text-[11px] font-bold text-white leading-none">
                  {language === 'es'
                    ? `¡Hola, ${firstName || 'Usuario'}! 👋`
                    : `Hi, ${firstName || 'User'}! 👋`}
                </span>
                <span className="text-[10px] text-white/60 font-semibold leading-none">
                  {language === 'es' ? '¿En qué puedo ayudarte?' : 'How can I help you?'}
                </span>
                <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-slate-950/90" />
              </motion.div>
            )}
          </AnimatePresence>

          {!isPropertyPage && (
            <button
              type="button"
              onClick={actions.onVoiceAction}
              aria-label={voiceAction.ariaLabel}
              className={`mr-3 px-3.5 py-2.5 rounded-full font-extrabold text-[10px] tracking-wider uppercase transition-all duration-300 flex items-center gap-1.5 shadow-premium text-white active:scale-95 cursor-pointer ${voiceAction.tone}`}
            >
              {voiceAction.isSpeaking ? (
                <>
                  <Square className="w-3 h-3 fill-current" />
                  <span>{voiceAction.label}</span>
                </>
              ) : voiceAction.isVoiceMode ? (
                <>
                  <MicOff className="w-3.5 h-3.5" />
                  <span>{voiceAction.label}</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5" />
                  <span>{voiceAction.label}</span>
                </>
              )}
            </button>
          )}

          {isListening && partialTranscript && (
            <div className="absolute bottom-[80px] right-[84px] bg-slate-950/95 text-white border border-white/10 px-4 py-2.5 rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-[11px] font-semibold max-w-[220px] leading-normal animate-in fade-in slide-in-from-bottom-2 select-none pointer-events-none whitespace-normal break-words text-right z-30">
              <div className="text-[8px] font-black text-brand-accent uppercase tracking-wider mb-0.5">
                {language === 'es' ? 'Te estoy escuchando...' : 'Listening to you...'}
              </div>
              <span className="italic text-white/90">&ldquo;{partialTranscript}&rdquo;</span>
            </div>
          )}

          <button
            type="button"
            aria-label={language === 'es' ? 'Abrir chat con Eterna' : 'Open Eterna chat'}
            onClick={actions.onOpen}
            className="hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer relative select-none flex flex-col items-center gap-1"
          >
            {isListening || activeStatus === 'thinking' || activeStatus === 'talking' ? (
              <VideoAvatar
                status={activeStatus}
                size={isPropertyPage ? 48 : 60}
                hidePill={true}
              />
            ) : (
              <span
                className="relative block overflow-hidden rounded-full border-2 border-white bg-slate-950 shadow-premium"
                style={{ width: isPropertyPage ? 48 : 60, height: isPropertyPage ? 48 : 60 }}
              >
                <Image
                  src="/avatar.png"
                  alt="Eterna Concierge"
                  fill
                  sizes={isPropertyPage ? '48px' : '60px'}
                  className="object-cover object-[center_15%]"
                />
              </span>
            )}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
