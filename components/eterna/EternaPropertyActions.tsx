"use client";

import { ArrowUpRight, MessageSquare, PhoneCall } from 'lucide-react';

import type { PropertySalesResponse } from '../../lib/eterna/propertySales';

type PropertyContactChannel = 'message' | 'call';

interface EternaPropertyActionsProps {
  propertySales: PropertySalesResponse;
  language: string;
  propertyTitle?: string;
  variant?: 'chat' | 'avatar';
  onQuestion: (question: string) => void;
  onContact: (channel: PropertyContactChannel, message: string) => void;
}

export function EternaPropertyActions({
  propertySales,
  language,
  propertyTitle,
  variant = 'chat',
  onQuestion,
  onContact,
}: EternaPropertyActionsProps) {
  const isSpanish = language === 'es';
  const isAvatar = variant === 'avatar';
  const contactTitle = propertySales.contactIntent || propertySales.stage === 'ready_to_contact'
    ? (isSpanish ? 'Conecta con el responsable' : 'Connect with the advisor')
    : (isSpanish ? '¿Te interesa avanzar?' : 'Interested in moving forward?');
  const messageText = propertySales.leadSummary || (isSpanish
    ? 'Hola, me interesa esta propiedad y quisiera recibir más información.'
    : 'Hello, I am interested in this property and would like more information.');
  const callText = propertySales.leadSummary || (isSpanish
    ? `Hola, me interesa "${propertyTitle || 'esta propiedad'}" y quisiera solicitar una llamada con el responsable comercial.`
    : `Hello, I am interested in "${propertyTitle || 'this property'}" and would like to request a call with the advisor.`);

  return (
    <div
      className={isAvatar
        ? 'w-full animate-in fade-in slide-in-from-bottom-3 duration-300'
        : 'mt-3 pt-3 border-t border-brand-gray-200/70 animate-in fade-in slide-in-from-bottom-1 duration-300'}
    >
      {propertySales.suggestedQuestions.length > 0 && (
        <div className={isAvatar ? 'flex flex-col items-start gap-1.5 mb-2' : 'flex flex-wrap gap-1.5 mb-3'}>
          {propertySales.suggestedQuestions.map((question) => (
            <button
              key={question}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onQuestion(question);
              }}
              className={isAvatar
                ? 'max-w-full rounded-full border border-white/30 bg-black/55 px-3 py-1.5 text-left text-[9px] font-bold leading-tight text-white shadow-lg backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/60 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80'
                : 'max-w-full rounded-full border border-brand-gray-200 bg-white px-2.5 py-1.5 text-left text-[9px] font-bold leading-tight text-brand-gray-600 transition-colors hover:border-brand-accent/50 hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/40'}
            >
              {question}
            </button>
          ))}
        </div>
      )}

      <div className={isAvatar
        ? 'rounded-[20px] border border-white/20 bg-black/60 p-3 text-white shadow-[0_18px_45px_rgba(0,0,0,0.36)] backdrop-blur-xl'
        : 'rounded-2xl border border-brand-gray-200 bg-white p-2.5 shadow-xs'}
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <span className={isAvatar
              ? 'block text-[8px] font-black uppercase tracking-[0.16em] text-white/60'
              : 'block text-[8px] font-black uppercase tracking-[0.16em] text-brand-gray-400'}
            >
              {isSpanish ? 'Siguiente paso' : 'Next step'}
            </span>
            <span className={isAvatar
              ? 'mt-0.5 block text-[10px] font-extrabold text-white'
              : 'mt-0.5 block text-[10px] font-extrabold text-brand-black'}
            >
              {contactTitle}
            </span>
          </div>
          <span className={isAvatar
            ? 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-300/20'
            : 'flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600'}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onContact('message', messageText);
            }}
            className={isAvatar
              ? 'inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-2 py-2 text-[9px] font-extrabold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80'
              : 'inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-black px-2 py-2 text-[9px] font-extrabold text-white transition-colors hover:bg-brand-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/40'}
          >
            <MessageSquare className="h-3 w-3" />
            <span>{isSpanish ? 'Enviar mensaje' : 'Send message'}</span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onContact('call', callText);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-2 py-2 text-[9px] font-extrabold text-white transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <PhoneCall className="h-3 w-3" />
            <span>{isSpanish ? 'Solicitar llamada' : 'Request call'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
