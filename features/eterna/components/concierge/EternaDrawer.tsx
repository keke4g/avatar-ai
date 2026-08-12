import { AnimatePresence, motion } from 'framer-motion';
import type { RefObject } from 'react';

import { EternaAvatarPane } from './EternaAvatarPane';
import { EternaChatHeader } from './EternaChatHeader';
import { EternaChatHistory } from './EternaChatHistory';
import { EternaChatInput } from './EternaChatInput';
import type { EternaDrawerActions, EternaDrawerViewModel } from './types';

interface EternaDrawerProps {
  actions: EternaDrawerActions;
  inputRef: RefObject<HTMLInputElement | null>;
  model: EternaDrawerViewModel;
  textEndRef: RefObject<HTMLDivElement | null>;
}

export function EternaDrawer({ actions, inputRef, model, textEndRef }: EternaDrawerProps) {
  const {
    activeStatus,
    avatar,
    chatHeader,
    chatHistory,
    chatInput,
    isCompact,
    isListening,
    isPropertyPage,
    isPropertyVisualActive,
    mode,
    visible,
  } = model;

  return (
    <AnimatePresence>
      {visible && (
        <div
          data-eterna-ui
          className={`fixed inset-x-2 bottom-2 flex flex-col items-end pointer-events-none md:bottom-6 md:right-6 md:left-auto ${
            isPropertyPage && isPropertyVisualActive
              ? 'z-[5200] lg:top-[6dvh] lg:bottom-[6dvh]'
              : 'z-[80]'
          }`}
        >
          <motion.div
            initial={{ y: '100%', opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: '100%', opacity: 0, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className={`relative z-10 w-full md:w-[380px] border backdrop-blur-xl flex flex-col justify-between overflow-hidden pointer-events-auto md:mr-6 md:mb-0 transition-all duration-300 rounded-[28px] ${
              mode === 'avatar'
                ? 'bg-slate-950 border-transparent shadow-[0_20px_60px_rgba(0,0,0,0.3)] text-white p-[3.2px] cursor-pointer'
                : 'bg-white/95 border-brand-gray-200/60 shadow-[0_20px_50px_rgba(0,0,0,0.12)] text-brand-black'
            } ${
              isPropertyPage && isPropertyVisualActive
                ? 'h-[25dvh] min-h-[160px] max-h-[220px] lg:h-full lg:min-h-0 lg:max-h-none'
                : isCompact && mode !== 'avatar'
                ? 'h-[136px] md:h-[170px]'
                : (mode === 'avatar'
                    ? 'h-[25dvh] min-h-[160px] max-h-[220px] md:h-[580px] md:min-h-0 md:max-h-none'
                    : 'h-[85dvh] md:h-[580px]')
            } ${
              mode === 'avatar' && activeStatus === 'thinking' ? 'animate-border-glow-pulse' :
              mode === 'avatar' && activeStatus === 'talking' ? 'animate-border-glow-breath' : ''
            }`}
            style={
              mode === 'avatar'
                ? {
                    borderColor:
                      isListening ? '#3B82F6' :
                      activeStatus === 'thinking' ? '#8B5CF6' :
                      activeStatus === 'talking' ? '#22C55E' :
                      'rgba(120, 170, 255, 0.25)',
                    boxShadow:
                      isListening ? '0 0 55px rgba(59, 130, 246, 0.35)' :
                      activeStatus === 'thinking' ? '0 0 55px rgba(139, 92, 246, 0.35)' :
                      activeStatus === 'talking' ? '0 0 65px rgba(34, 197, 94, 0.45)' :
                      '0 0 25px rgba(120, 170, 255, 0.12)',
                  }
                : {}
            }
            onClick={(event) => event.stopPropagation()}
          >
            {!isPropertyPage && mode !== 'avatar' && (
              <div
                className="absolute top-0 inset-x-0 h-5 z-40 flex md:hidden items-center justify-center cursor-pointer select-none active:scale-98 pointer-events-auto"
                onTouchStart={actions.onTouchStart}
                onTouchEnd={actions.onTouchEnd}
                onClick={actions.onToggleCompact}
              >
                <div className="w-12 h-1 rounded-full mt-1.5 bg-brand-gray-300/70 transition-colors" />
              </div>
            )}

            {mode === 'avatar' ? (
              <EternaAvatarPane model={avatar} actions={actions} />
            ) : (
              <>
                <EternaChatHeader model={chatHeader} actions={actions} />
                <EternaChatHistory model={chatHistory} actions={actions} textEndRef={textEndRef} />
                <EternaChatInput model={chatInput} actions={actions} inputRef={inputRef} />
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
