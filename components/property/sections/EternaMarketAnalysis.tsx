'use client';

import { AlertCircle, Calculator, CheckCircle2, CircleHelp, Sparkles } from 'lucide-react';
import { getActiveOfferings } from '../../../lib/propertyOfferings';
import type { Property } from '../../../lib/types';

interface EternaMarketAnalysisProps {
  property: Property;
  language: 'es' | 'en';
}

export function EternaMarketAnalysis({ property, language }: EternaMarketAnalysisProps) {
  const isSpanish = language === 'es';
  const saleOffering = getActiveOfferings(property).find((offering) => offering.mode === 'SALE');
  const declaredPrice = Number(saleOffering?.priceAmount) || 0;
  const legalSignals = [property.legalPublicDeed, property.legalTaxCurrent, property.legalServicesPaid, property.legalDebtFree];
  const knownLegalSignals = legalSignals.filter((value) => typeof value === 'boolean').length;
  const legalComplete = property.legalDocumentationComplete === true;
  const maintenanceKnown = property.maintenanceFeeAmount !== undefined && property.maintenanceFeeAmount !== null;

  const items = [
    {
      icon: CheckCircle2,
      tone: 'emerald',
      title: isSpanish ? 'Datos físicos declarados' : 'Declared physical details',
      value: isSpanish
        ? `${property.bedrooms || 0} recámaras · ${property.bathrooms || 0} baños · ${property.parkingSpaces || 0} estacionamientos`
        : `${property.bedrooms || 0} bedrooms · ${property.bathrooms || 0} bathrooms · ${property.parkingSpaces || 0} parking spaces`,
      detail: isSpanish ? 'Información proporcionada por el anunciante.' : 'Information provided by the listing owner.',
    },
    {
      icon: Calculator,
      tone: 'indigo',
      title: isSpanish ? 'Precio y mantenimiento' : 'Price and maintenance',
      value: declaredPrice
        ? `${saleOffering?.currency || 'MXN'} $${declaredPrice.toLocaleString(isSpanish ? 'es-MX' : 'en-US')}`
        : (isSpanish ? 'Precio por confirmar' : 'Price to be confirmed'),
      detail: maintenanceKnown
        ? (isSpanish ? `Mantenimiento declarado: MXN $${Number(property.maintenanceFeeAmount).toLocaleString('es-MX')} al mes.` : `Declared maintenance: MXN $${Number(property.maintenanceFeeAmount).toLocaleString('en-US')} per month.`)
        : (isSpanish ? 'El mantenimiento mensual no fue proporcionado.' : 'Monthly maintenance was not provided.'),
    },
    {
      icon: legalComplete ? CheckCircle2 : AlertCircle,
      tone: legalComplete ? 'emerald' : 'amber',
      title: isSpanish ? 'Expediente jurídico' : 'Legal file',
      value: legalComplete
        ? (isSpanish ? 'Marcado como completo' : 'Marked as complete')
        : (isSpanish ? 'Requiere confirmación' : 'Requires confirmation'),
      detail: isSpanish
        ? `${knownLegalSignals} de ${legalSignals.length} condiciones legales tienen un valor declarado. Solicita documentos antes de decidir.`
        : `${knownLegalSignals} of ${legalSignals.length} legal conditions have a declared value. Request documents before deciding.`,
    },
  ];

  return (
    <section className="mb-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6" aria-labelledby="listing-reading-title">
      <div className="flex items-start gap-3 border-b border-zinc-100 pb-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-indigo-300"><Sparkles className="h-5 w-5" aria-hidden="true" /></span>
        <div>
          <h3 id="listing-reading-title" className="text-sm font-black text-zinc-950">{isSpanish ? 'Lectura transparente del anuncio' : 'Transparent listing review'}</h3>
          <p className="mt-1 text-xs leading-relaxed text-zinc-500">{isSpanish ? 'Eterna resume únicamente datos publicados. No mostramos plusvalía, liquidez ni velocidad de venta sin una fuente verificable.' : 'Eterna summarizes published data only. We do not show appreciation, liquidity, or sales velocity without a verifiable source.'}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          const toneClass = item.tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : item.tone === 'amber' ? 'bg-amber-50 text-amber-700' : 'bg-indigo-50 text-indigo-700';
          return (
            <article key={item.title} className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneClass}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
              <h4 className="mt-3 text-xs font-black uppercase tracking-[0.1em] text-zinc-700">{item.title}</h4>
              <p className="mt-2 text-sm font-black text-zinc-950">{item.value}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">{item.detail}</p>
            </article>
          );
        })}
      </div>

      <div className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        <CircleHelp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>{isSpanish ? 'Antes de contactar, confirma disponibilidad, precio vigente, mantenimiento y documentos con el responsable de la propiedad.' : 'Before contacting, confirm availability, current price, maintenance, and documents with the property representative.'}</p>
      </div>
    </section>
  );
}
