import { ArrowUpRight, HelpCircle, Navigation } from 'lucide-react';
import type { RefObject } from 'react';

import { EternaPropertyActions } from '@/features/eterna/components/EternaPropertyActions';

import type { EternaChatHistoryViewModel, EternaDrawerActions } from './types';

interface EternaChatHistoryProps {
  actions: Pick<
    EternaDrawerActions,
    | 'onContact'
    | 'onNavigateMessage'
    | 'onPublishProperty'
    | 'onRegister'
    | 'onSend'
    | 'onSignIn'
  >;
  model: EternaChatHistoryViewModel;
  textEndRef: RefObject<HTMLDivElement | null>;
}

function getRouteActionLabel(route: string, language: EternaChatHistoryViewModel['language']) {
  if (route.includes('tab=properties')) {
    return language === 'es' ? 'Ir a mis propiedades' : 'Go to my properties';
  }
  if (route.includes('tab=trips')) {
    return language === 'es' ? 'Ir a mis viajes' : 'Go to my trips';
  }
  if (route.includes('tab=swaps')) {
    return language === 'es' ? 'Ir a intercambios' : 'Go to swaps';
  }
  if (route.includes('messages')) {
    return language === 'es' ? 'Ir a mensajes' : 'Go to messages';
  }
  if (route.includes('profile')) {
    return language === 'es' ? 'Ir a mi perfil' : 'Go to profile';
  }
  return language === 'es' ? 'Ver resultados' : 'View results';
}

export function EternaChatHistory({ actions, model, textEndRef }: EternaChatHistoryProps) {
  const {
    activeStatus,
    chatHistory,
    geminiActive,
    hasActiveProperty,
    isCompact,
    isConnected,
    isHome,
    isListening,
    language,
    partialTranscript,
    propertyTitle,
    simulatedStatus,
    simulatedText,
    translate,
    userName,
    websocketStatus,
    websocketText,
  } = model;
  const messagesToRender = isCompact && chatHistory.length > 0
    ? [chatHistory[chatHistory.length - 1]]
    : chatHistory;

  return (
    <>
      <div className={`flex-1 overflow-y-auto flex flex-col scroll-smooth scrollbar-thin scrollbar-thumb-brand-gray-200 scrollbar-track-transparent transition-all duration-300 ${
        isHome ? 'bg-transparent' : 'bg-white/20'
      } ${
        isCompact ? 'p-2 py-1 gap-1.5' : 'px-4 py-4 gap-3.5'
      }`}>
        {messagesToRender.length === 0 ? (
          <div className={`flex flex-col items-center justify-center text-center ${
            isHome ? 'text-white' : 'text-brand-gray-400'
          } ${
            isCompact ? 'p-1 h-[40px]' : 'p-6 h-full'
          }`}>
            <HelpCircle className={`${isHome ? 'text-white/40' : 'text-brand-gray-300'} ${isCompact ? 'hidden' : 'w-8 h-8 mb-3'}`} />
            <p className={`text-xs font-extrabold ${isHome ? 'text-white' : 'text-brand-black'}`}>
              {translate('messages.eternaGreeting', { name: userName ? userName.split(' ')[0] : 'Usuario' })}
            </p>
            {!isCompact && (
              <p className={`text-[10px] leading-relaxed mt-1 max-w-[220px] ${isHome ? 'text-white/60' : 'text-brand-gray-400'}`}>
                {translate('messages.eternaGreetingDesc')}
              </p>
            )}
          </div>
        ) : (
          messagesToRender.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-1 duration-200`}
            >
              <div className={`max-w-[88%] rounded-[20px] px-4 py-3 font-semibold ${isCompact ? 'text-[10px] leading-relaxed' : 'text-[13px] leading-[1.55]'} ${
                message.role === 'user'
                  ? 'bg-[#087FAF] text-white rounded-br-md shadow-[0_8px_24px_rgba(8,127,175,0.18)]'
                  : isHome
                    ? 'bg-white/10 border border-white/5 text-white rounded-tl-none shadow-sm'
                    : 'bg-white border border-brand-gray-100 text-brand-black rounded-bl-md shadow-[0_6px_20px_rgba(15,23,42,0.07)]'
              }`}>
                <span className={`text-[9px] uppercase tracking-[0.12em] block mb-1 font-black ${
                  message.role === 'user' ? 'text-indigo-200' : 'text-brand-accent'
                }`}>
                  {message.role === 'user' ? translate('messages.typing') : 'Eterna IA'}
                </span>
                <p className="whitespace-pre-line">{message.content}</p>

                {!message.propertySales && message.suggestedReplies && message.suggestedReplies.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {message.suggestedReplies.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          actions.onSend(suggestion);
                        }}
                        className={`max-w-full rounded-full border px-3 py-2 text-left text-[10px] font-bold transition-colors ${
                          isHome
                            ? 'border-white/15 bg-white/5 text-white/75 hover:border-white/35 hover:text-white'
                            : 'border-brand-gray-200 bg-white text-brand-gray-600 hover:border-brand-accent/50 hover:text-brand-accent'
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}

                {message.route && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      actions.onNavigateMessage(message);
                    }}
                    className="mt-2 w-full inline-flex items-center justify-between px-3 py-2 rounded-xl bg-brand-accent text-white text-[10px] font-extrabold tracking-wide hover:bg-brand-accent/90 transition-all shadow-xs cursor-pointer animate-in fade-in zoom-in-95 duration-200"
                  >
                    <span>{getRouteActionLabel(message.route, language)}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {message.showAuthButtons && (
                  <div className="mt-3 flex gap-2 w-full animate-in fade-in zoom-in-95 duration-200">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        actions.onSignIn();
                      }}
                      className="flex-grow py-2 rounded-xl bg-brand-accent text-white text-[10px] font-extrabold text-center hover:bg-brand-accent/90 transition-all cursor-pointer shadow-xs"
                    >
                      {language === 'es' ? 'Iniciar Sesión' : 'Sign In'}
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        actions.onRegister();
                      }}
                      className="flex-grow py-2 rounded-xl border border-brand-gray-200 bg-white text-brand-black text-[10px] font-extrabold text-center hover:bg-brand-gray-50 transition-all cursor-pointer shadow-xs"
                    >
                      {language === 'es' ? 'Crear Cuenta' : 'Register'}
                    </button>
                  </div>
                )}

                {message.showPublishButton && (
                  <div className="mt-3 w-full animate-in fade-in zoom-in-95 duration-200">
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        actions.onPublishProperty();
                      }}
                      className="w-full py-2 rounded-xl bg-brand-accent text-white text-[10px] font-extrabold text-center hover:bg-brand-accent/90 transition-all cursor-pointer shadow-xs"
                    >
                      {language === 'es' ? 'Publicar Propiedad' : 'List Property'}
                    </button>
                  </div>
                )}

                {message.propertySales && hasActiveProperty && (
                  <EternaPropertyActions
                    propertySales={message.propertySales}
                    language={language}
                    propertyTitle={propertyTitle}
                    onQuestion={actions.onSend}
                    onContact={actions.onContact}
                  />
                )}
              </div>
            </div>
          ))
        )}

        {isConnected && !geminiActive && websocketText && websocketStatus === 'talking' && (
          <div className="flex justify-start animate-pulse">
            <div className={`max-w-[88%] rounded-[20px] px-4 py-3 text-[13px] leading-[1.55] font-semibold rounded-bl-md shadow-sm ${
              isHome
                ? 'bg-white/10 border border-white/5 text-white'
                : 'bg-brand-gray-50 border border-brand-gray-100 text-brand-black'
            }`}>
              <span className="text-[8px] uppercase tracking-wider block mb-0.5 font-black text-brand-accent">
                {translate('messages.eternaTalking')}
              </span>
              <p className="whitespace-pre-line">{websocketText}</p>
            </div>
          </div>
        )}

        {(!isConnected || geminiActive) && simulatedText && simulatedStatus === 'talking' && (
          <div className="flex justify-start">
            <div className={`max-w-[88%] rounded-[20px] px-4 py-3 text-[13px] leading-[1.55] font-semibold rounded-bl-md shadow-sm ${
              isHome
                ? 'bg-white/10 border border-white/5 text-white'
                : 'bg-brand-gray-50 border border-brand-gray-100 text-brand-black'
            }`}>
              <span className="text-[8px] uppercase tracking-wider block mb-0.5 font-black text-brand-accent">
                Eterna IA
              </span>
              <p className="whitespace-pre-line">{simulatedText}</p>
            </div>
          </div>
        )}

        {activeStatus === 'thinking' && (
          <div className="flex justify-start">
            <div className={`rounded-2xl px-3.5 py-2 flex items-center gap-1 shadow-xs ${
              isHome ? 'bg-white/10 border border-white/5' : 'bg-brand-gray-50 border border-brand-gray-100'
            }`}>
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-bounce" />
            </div>
          </div>
        )}

        {isListening && partialTranscript && (
          <div className="flex justify-end animate-pulse">
            <div className={`max-w-[88%] rounded-[20px] px-4 py-3 text-[13px] leading-[1.55] font-semibold rounded-br-md shadow-sm ${
              isHome
                ? 'bg-white/5 border border-white/5 text-white/90'
                : 'bg-brand-accent/5 border border-brand-accent/15 text-brand-black'
            }`}>
              <span className="text-[8px] uppercase tracking-wider block mb-0.5 font-black text-brand-accent">
                {language === 'es' ? 'Te estoy escuchando...' : 'Listening to you...'}
              </span>
              <p className="italic text-brand-black/80">&ldquo;{partialTranscript}&rdquo;</p>
            </div>
          </div>
        )}

        <div ref={textEndRef} />
      </div>

      {chatHistory.length === 0 && !isCompact && (
        <div className={`p-3 border-t transition-colors ${
          isHome ? 'border-white/5 bg-white/5' : 'border-brand-gray-100 bg-brand-gray-50/20'
        }`}>
          <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none px-1 py-1 select-none max-w-full md:flex-wrap md:justify-center scroll-smooth">
            <button
              onClick={() => actions.onSend(translate('messages.howWorksPrompt'))}
              className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap shadow-xs ${
                isHome
                  ? 'bg-white/10 border-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                  : 'bg-white border-brand-gray-200 text-brand-black/75 hover:bg-brand-gray-50 hover:text-brand-black'
              }`}
            >
              {translate('messages.questionHowWorks')}
            </button>
            <button
              onClick={() => actions.onSend(translate('messages.beachVillaPrompt'))}
              className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap shadow-xs ${
                isHome
                  ? 'bg-white/10 border-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                  : 'bg-white border-brand-gray-200 text-brand-black/75 hover:bg-brand-gray-50 hover:text-brand-black'
              }`}
            >
              {translate('messages.questionBeachVilla')}
            </button>
            <button
              onClick={() => actions.onSend(translate('messages.feesInsurancePrompt'))}
              className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap shadow-xs ${
                isHome
                  ? 'bg-white/10 border-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                  : 'bg-white border-brand-gray-200 text-brand-black/75 hover:bg-brand-gray-50 hover:text-brand-black'
              }`}
            >
              {translate('messages.questionInsurance')}
            </button>
            <button
              onClick={() => actions.onSend(language === 'es' ? 'Llévame a mis mensajes' : 'Take me to my messages')}
              className={`px-3 py-1.5 rounded-full border text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap shadow-xs flex items-center gap-1 ${
                isHome
                  ? 'bg-white/10 border-white/10 text-white/90 hover:bg-white/20 hover:text-white'
                  : 'bg-white border-brand-gray-200 text-brand-black/75 hover:bg-brand-gray-50 hover:text-brand-black'
              }`}
            >
              <Navigation className="w-3 h-3" />
              <span>{language === 'es' ? 'Mis Mensajes' : 'My Messages'}</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
