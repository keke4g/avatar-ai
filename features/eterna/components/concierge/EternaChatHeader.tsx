import { Sparkles, User, Volume2, VolumeX, X } from 'lucide-react';
import Image from 'next/image';

import { VideoAvatar } from '@/components/VideoAvatar';

import type { EternaChatHeaderViewModel, EternaDrawerActions } from './types';

interface EternaChatHeaderProps {
  actions: Pick<EternaDrawerActions, 'onClose' | 'onMuteToggle' | 'onShowAvatar'>;
  model: EternaChatHeaderViewModel;
}

export function EternaChatHeader({ actions, model }: EternaChatHeaderProps) {
  const {
    activeStatus,
    contextLabel,
    isHome,
    isListening,
    isMuted,
    language,
    statusMessage,
  } = model;

  return (
    <div className={`px-4 pb-3 pt-5 border-b flex items-center justify-between gap-3 transition-colors ${
      isHome ? 'border-white/5 bg-white/5' : 'border-brand-gray-100 bg-white/90'
    }`}>
      <div className="flex min-w-0 items-center gap-3">
        {!isHome && (
          <div className="w-11 h-11 shrink-0 rounded-full overflow-hidden border border-brand-gray-200 bg-slate-950 flex items-center justify-center shadow-sm">
            {isListening || activeStatus === 'thinking' || activeStatus === 'talking' ? (
              <VideoAvatar
                status={activeStatus}
                size={40}
                hidePill={true}
                hideGlow={true}
                isListening={isListening}
              />
            ) : (
              <span className="relative block h-10 w-10 overflow-hidden rounded-full">
                <Image
                  src="/avatar.png"
                  alt="Eterna Concierge"
                  fill
                  sizes="40px"
                  className="object-cover object-[center_15%]"
                />
              </span>
            )}
          </div>
        )}
        <div className="min-w-0">
          <h3 className={`text-[13px] leading-tight font-extrabold flex items-center gap-1 ${
            isHome ? 'text-white' : 'text-brand-black'
          }`}>
            <span className="truncate">Eterna Concierge</span>
            <Sparkles className="w-3.5 h-3.5 text-brand-accent animate-pulse" />
          </h3>
          <p className="mt-1 inline-flex max-w-full items-center rounded-full bg-sky-50 px-2 py-0.5 text-[8px] leading-4 text-sky-700 font-extrabold uppercase tracking-[0.08em] whitespace-nowrap">
            {statusMessage}
          </p>
          {contextLabel && (
            <p className="mt-1 truncate text-[9px] text-brand-gray-500 font-semibold tracking-wide">
              {contextLabel}
            </p>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={actions.onShowAvatar}
          className="px-2.5 py-1.5 rounded-full bg-brand-accent/10 border border-brand-accent/20 text-brand-accent text-[9px] font-extrabold uppercase tracking-wider hover:bg-brand-accent/20 transition-all cursor-pointer flex items-center gap-1 shrink-0"
          title="Ver Avatar"
        >
          <User className="w-3 h-3" />
          <span className="hidden min-[370px]:inline">Avatar</span>
        </button>

        <button
          onClick={actions.onMuteToggle}
          className="p-1.5 text-brand-gray-500 hover:text-brand-black hover:bg-brand-gray-100 rounded-full cursor-pointer transition-colors"
          title={isMuted ? 'Activar sonido' : 'Silenciar'}
        >
          {isMuted ? (
            <VolumeX className="w-3.5 h-3.5 text-brand-rose" />
          ) : (
            <Volume2 className="w-3.5 h-3.5" />
          )}
        </button>

        <button
          onClick={actions.onClose}
          aria-label={language === 'es' ? 'Cerrar Eterna y apagar el micrófono' : 'Close Eterna and turn off the microphone'}
          className="p-1.5 text-brand-gray-500 hover:text-brand-black hover:bg-brand-gray-100 rounded-full cursor-pointer transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
