import {
  MessageSquare,
  Mic,
  MicOff,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';

import { DoubleBufferVideoPlayer } from '@/components/DoubleBufferVideoPlayer';
import { EternaPropertyActions } from '@/features/eterna/components/EternaPropertyActions';

import type { EternaAvatarViewModel, EternaDrawerActions } from './types';

interface EternaAvatarPaneProps {
  actions: Pick<
    EternaDrawerActions,
    | 'onAvatarSurfaceClick'
    | 'onClose'
    | 'onContact'
    | 'onMuteToggle'
    | 'onSend'
    | 'onShowChat'
    | 'onVoiceAction'
  >;
  model: EternaAvatarViewModel;
}

export function EternaAvatarPane({ actions, model }: EternaAvatarPaneProps) {
  const {
    activeStatus,
    hasActiveProperty,
    isCompact,
    isListening,
    isMuted,
    isPresentingProperty,
    isPropertyPage,
    language,
    propertySales,
    propertyTitle,
    statusMessage,
    voiceAction,
  } = model;

  return (
    <div
      onClick={actions.onAvatarSurfaceClick}
      className="relative w-full h-full rounded-[28px] overflow-hidden bg-slate-950 flex flex-col justify-between"
    >
      <DoubleBufferVideoPlayer
        state={
          isListening
            ? 'LISTENING'
            : activeStatus === 'thinking'
              ? 'THINKING'
              : activeStatus === 'talking'
                ? 'TALKING'
                : 'IDLE'
        }
        loop={true}
        className="absolute inset-0 w-full h-full object-cover z-10"
        objectPosition="center 15%"
      />

      <div className={`absolute top-0 left-0 w-full z-30 flex items-center justify-between bg-gradient-to-b from-black/65 to-transparent text-white rounded-t-[28px] pointer-events-none select-none ${isCompact ? 'p-2 pt-5' : 'p-4 pt-7'}`}>
        <div className="flex items-center gap-2.5 pointer-events-auto">
          <div className="flex flex-col text-left">
            <h3 className={`font-extrabold flex items-center gap-1 text-white ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
              <span>Eterna Concierge</span>
              <Sparkles className={`${isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} text-brand-accent animate-pulse`} />
            </h3>
            <p className={`text-brand-accent font-extrabold uppercase tracking-wider mt-0.5 ${isCompact ? 'text-[7px]' : 'text-[8px]'}`}>
              {statusMessage}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            onClick={(event) => {
              event.stopPropagation();
              actions.onMuteToggle();
            }}
            className={`text-white/70 hover:text-white hover:bg-white/10 rounded-full cursor-pointer transition-colors ${isCompact ? 'p-1' : 'p-1.5'}`}
            title={isMuted ? 'Activar sonido' : 'Silenciar'}
          >
            {isMuted ? (
              <VolumeX className={isCompact ? 'w-3 h-3 text-brand-rose' : 'w-3.5 h-3.5 text-brand-rose'} />
            ) : (
              <Volume2 className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
            )}
          </button>

          <button
            onClick={(event) => {
              event.stopPropagation();
              actions.onClose();
            }}
            aria-label={
              isPropertyPage
                ? (language === 'es' ? 'Minimizar Eterna a orbe' : 'Minimize Eterna to orb')
                : (language === 'es' ? 'Cerrar Eterna y apagar el micrófono' : 'Close Eterna and turn off the microphone')
            }
            title={
              isPropertyPage
                ? (language === 'es' ? 'Minimizar a orbe' : 'Minimize to orb')
                : undefined
            }
            className={`text-white/70 hover:text-white hover:bg-white/10 rounded-full cursor-pointer transition-colors ${isCompact ? 'p-1' : 'p-1.5'}`}
          >
            <X className={isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
          </button>
        </div>
      </div>

      {!isPropertyPage
        && propertySales
        && hasActiveProperty
        && !isPresentingProperty
        && !isCompact
        && activeStatus !== 'thinking' && (
        <div
          className="absolute inset-x-3 bottom-[76px] z-40 pointer-events-auto"
          onClick={(event) => event.stopPropagation()}
        >
          <EternaPropertyActions
            propertySales={propertySales}
            language={language}
            propertyTitle={propertyTitle}
            variant="avatar"
            onQuestion={actions.onSend}
            onContact={actions.onContact}
          />
        </div>
      )}

      <div className={`absolute left-1/2 z-30 flex -translate-x-1/2 items-center pointer-events-auto ${
        isCompact ? 'bottom-2.5 gap-1.5' : 'bottom-6 gap-2'
      }`}>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            actions.onVoiceAction();
          }}
          aria-label={voiceAction.ariaLabel}
          className={`flex items-center rounded-full font-extrabold uppercase tracking-wider text-white shadow-floating transition-all hover:scale-105 active:scale-95 cursor-pointer ${voiceAction.tone} ${
            isCompact ? 'px-3 py-1.5 text-[9px] gap-1' : 'px-4 py-2.5 text-[10px] gap-1.5'
          }`}
        >
          {voiceAction.isSpeaking ? (
            <Square className={isCompact ? 'h-2.5 w-2.5 fill-current' : 'h-3 w-3 fill-current'} />
          ) : voiceAction.isVoiceMode ? (
            <MicOff className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          ) : (
            <Mic className={isCompact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
          )}
          <span>{voiceAction.label}</span>
        </button>

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            actions.onShowChat();
          }}
          className={`flex items-center rounded-full border border-zinc-200/50 bg-white/90 font-bold uppercase tracking-wider text-brand-black shadow-floating transition-all hover:scale-105 active:scale-95 cursor-pointer dark:border-white/10 dark:bg-zinc-900/90 dark:text-white ${
            isCompact ? 'px-3 py-1.5 text-[9px] gap-1' : 'px-4 py-2.5 text-[10px] gap-1.5'
          }`}
        >
          <MessageSquare className={isCompact ? 'w-3 h-3 text-brand-accent' : 'w-3.5 h-3.5 text-brand-accent'} />
          <span>Chat</span>
        </button>
      </div>
    </div>
  );
}
