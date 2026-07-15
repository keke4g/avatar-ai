"use client";

import { ArrowUpRight, CalendarCheck, MessageSquare, PhoneCall } from 'lucide-react';

import type { PropertySalesResponse } from '../../lib/eterna/propertySales';

type PropertyContactChannel = 'message' | 'call' | 'visit';

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
  const showContact = propertySales.contactIntent || propertySales.stage === 'ready_to_contact';
  const contactTitle = showContact
    ? (isSpanish ? 'Conecta con el responsable' : 'Connect with the advisor')
    : propertySales.stage === 'consideration'
      ? (isSpanish ? 'Resuelve lo pendiente' : 'Resolve what is pending')
      : (isSpanish ? 'Entiende si realmente te conviene' : 'Understand whether it truly fits');
  const messageText = propertySales.leadSummary || (isSpanish
    ? 'Hola, me interesa esta propiedad y quisiera recibir más información.'
    : 'Hello, I am interested in this property and would like more information.');
  const callText = propertySales.leadSummary || (isSpanish
    ? `Hola, me interesa "${propertyTitle || 'esta propiedad'}" y quisiera solicitar una llamada con el responsable comercial.`
    : `Hello, I am interested in "${propertyTitle || 'this property'}" and would like to request a call with the advisor.`);
  const visitText = propertySales.leadSummary || (isSpanish
    ? `Hola, me interesa "${propertyTitle || 'esta propiedad'}" y quisiera proponer una fecha para conocerla en persona.`
    : `Hello, I am interested in "${propertyTitle || 'this property'}" and would like to propose a date to visit it.`);

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
                ? 'min-h-10 max-w-full rounded-full border border-white/30 bg-black/55 px-3 py-2 text-left text-xs font-bold leading-tight text-white shadow-lg backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-white/60 hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80'
                : 'min-h-10 max-w-full rounded-full border border-brand-gray-200 bg-white px-3 py-2 text-left text-xs font-bold leading-tight text-brand-gray-600 transition-colors hover:border-brand-accent/50 hover:text-brand-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/40'}
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
              ? 'block text-[10px] font-black uppercase tracking-[0.16em] text-white/70'
              : 'block text-[10px] font-black uppercase tracking-[0.16em] text-brand-gray-500'}
            >
              {isSpanish ? 'Siguiente paso' : 'Next step'}
            </span>
            <span className={isAvatar
              ? 'mt-1 block text-sm font-extrabold text-white'
              : 'mt-1 block text-sm font-extrabold text-brand-black'}
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

        <div className={`grid gap-2 ${showContact ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-2'}`}>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (showContact) onContact('message', messageText);
              else onQuestion(isSpanish ? 'Resume por qué esta propiedad coincide conmigo y cuál es su principal desventaja.' : 'Summarize why this property fits me and its main tradeoff.');
            }}
            className={isAvatar
              ? 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80'
              : 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-brand-black px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-brand-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/40'}
          >
            <MessageSquare className="h-3 w-3" />
            <span>{showContact ? (isSpanish ? 'Enviar mensaje' : 'Send message') : (isSpanish ? 'Por qué encaja' : 'Why it fits')}</span>
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (showContact) onContact('call', callText);
              else onQuestion(isSpanish ? '¿Qué información importante falta confirmar antes de contactar?' : 'What important information should be confirmed before contacting?');
            }}
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            <PhoneCall className="h-3 w-3" />
            <span>{showContact ? (isSpanish ? 'Solicitar llamada' : 'Request call') : (isSpanish ? 'Qué falta saber' : 'What is missing')}</span>
          </button>
          {showContact && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onContact('visit', visitText);
              }}
              className={isAvatar
                ? 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200'
                : 'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-extrabold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'}
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              <span>{isSpanish ? 'Proponer visita' : 'Propose visit'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
