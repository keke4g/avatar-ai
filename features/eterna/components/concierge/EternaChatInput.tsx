import { Mic, MicOff, Minimize2, Send, Square } from 'lucide-react';
import type { RefObject } from 'react';

import type { EternaChatInputViewModel, EternaDrawerActions } from './types';

interface EternaChatInputProps {
  actions: Pick<EternaDrawerActions, 'onInputChange' | 'onSubmit' | 'onVoiceAction'>;
  inputRef: RefObject<HTMLInputElement | null>;
  model: EternaChatInputViewModel;
}

export function EternaChatInput({ actions, inputRef, model }: EternaChatInputProps) {
  const {
    activeStatus,
    isCompact,
    isHome,
    isListening,
    translate,
    typedInput,
    voiceAction,
  } = model;
  const hasTypedInput = Boolean(typedInput.trim());

  return (
    <div className={`border-t transition-colors duration-300 ${
      isHome ? 'border-white/5 bg-white/5' : 'border-brand-gray-100 bg-white/95 backdrop-blur-xl'
    } ${
      isCompact ? 'p-1.5' : 'px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
    }`}>
      <div className="flex gap-2 items-center">
        <div className={`min-w-0 flex-grow flex border focus-within:border-brand-accent/50 focus-within:ring-2 focus-within:ring-brand-accent/10 transition-all items-center rounded-2xl ${
          isHome ? 'bg-white/5 border-white/10' : 'bg-white border-brand-gray-200'
        } ${
          isCompact ? 'p-0.5' : 'p-1.5'
        }`}>
          <input
            ref={inputRef}
            type="text"
            placeholder={isListening ? translate('messages.listeningVoice') : translate('messages.askEternaPlaceholder')}
            value={typedInput}
            onChange={(event) => actions.onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                actions.onSubmit();
              }
            }}
            disabled={isListening}
            className={`flex-grow pl-2.5 outline-none text-xs font-semibold bg-transparent placeholder-brand-gray-400 ${
              isHome ? 'text-white placeholder-white/30' : 'text-brand-black placeholder-brand-gray-400'
            } ${
              isCompact ? 'py-1' : 'py-1.5'
            }`}
          />
        </div>

        <button
          type="button"
          onClick={actions.onVoiceAction}
          aria-label={voiceAction.ariaLabel}
          className={`h-11 w-11 sm:w-auto sm:px-4 rounded-2xl font-extrabold text-[10px] tracking-wider uppercase transition-all duration-200 flex items-center justify-center gap-1.5 shadow-sm text-white active:scale-95 cursor-pointer shrink-0 ${voiceAction.tone}`}
        >
          {voiceAction.isSpeaking ? (
            <>
              <Square className="w-3 h-3 fill-current" />
              <span className="hidden sm:inline">{voiceAction.label}</span>
            </>
          ) : voiceAction.isVoiceMode ? (
            <>
              <MicOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{voiceAction.label}</span>
            </>
          ) : (
            <>
              <Mic className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{voiceAction.label}</span>
            </>
          )}
        </button>

        <button
          onClick={actions.onSubmit}
          disabled={!hasTypedInput && activeStatus !== 'talking'}
          title={activeStatus === 'talking' && !hasTypedInput ? 'Interrumpir' : undefined}
          className={`transition-all shadow-sm shrink-0 cursor-pointer ${
            isCompact ? 'p-2 rounded-xl' : 'h-11 w-11 rounded-2xl flex items-center justify-center'
          } ${
            hasTypedInput
              ? 'bg-brand-accent text-white hover:scale-105 active:scale-95'
              : activeStatus === 'talking'
                ? (isHome ? 'bg-white/10 text-white/70 hover:bg-white/20' : 'bg-brand-gray-100 text-brand-gray-600 hover:bg-brand-gray-200 hover:scale-105 active:scale-95')
                : (isHome ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-brand-gray-100 text-brand-gray-300 cursor-not-allowed')
          }`}
        >
          {activeStatus === 'talking' && !hasTypedInput ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </div>
    </div>
  );
}
