'use client';

import { CalendarClock, LineChart, Scale, TrendingUp } from 'lucide-react';
import type { Property } from '../../../lib/types';
import { PropertySectionCard, PropertySubIcon } from '../PropertySectionCard';

interface EternaMarketAnalysisProps {
  property: Property;
  language: 'es' | 'en';
}

interface MarketEvidence {
  source?: string;
  measuredAt?: string;
  appreciationRate?: number;
  methodology?: string;
}

export function EternaMarketAnalysis({ property, language }: EternaMarketAnalysisProps) {
  const evidence = property.metadata?.marketEvidence as MarketEvidence | undefined;
  const hasAppraisal = Boolean(
    property.appraisalAmount
      && property.appraisalDate
      && property.appraisalExpert,
  );
  const hasPriceHistory = Boolean(
    property.priceHistory?.initialPrice
      && property.priceHistory?.currentPrice
      && property.priceHistory?.lastModificationDate,
  );
  const hasSourcedAppreciation = Boolean(
    evidence?.source
      && evidence?.measuredAt
      && Number.isFinite(evidence?.appreciationRate),
  );

  if (!hasAppraisal && !hasPriceHistory && !hasSourcedAppreciation) {
    return null;
  }

  return (
    <PropertySectionCard
      icon={LineChart}
      eyebrow={language === 'es' ? 'Evidencia comercial' : 'Commercial evidence'}
      title={language === 'es' ? 'Datos de mercado documentados' : 'Documented market data'}
      description={language === 'es'
        ? 'Se muestran únicamente cifras con fecha y procedencia disponibles en el expediente.'
        : 'Only figures with a date and source available in the listing record are shown.'}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {hasAppraisal && (
          <article className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <PropertySubIcon icon={Scale} />
              <span className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-700">
                {language === 'es' ? 'Con responsable y fecha' : 'Dated and attributed'}
              </span>
            </div>
            <p className="mt-5 text-xl font-black tracking-tight text-neutral-950">
              MXN ${property.appraisalAmount!.toLocaleString()}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-neutral-500">
              {language === 'es' ? 'Avalúo declarado por' : 'Appraisal declared by'} {property.appraisalExpert}
              {' · '}{property.appraisalDate}
            </p>
          </article>
        )}

        {hasPriceHistory && (
          <article className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <PropertySubIcon icon={CalendarClock} />
              <span className="text-[8px] font-black uppercase tracking-[0.12em] text-neutral-500">
                {language === 'es' ? 'Historial del anuncio' : 'Listing history'}
              </span>
            </div>
            <p className="mt-5 text-xl font-black tracking-tight text-neutral-950">
              MXN ${property.priceHistory!.currentPrice.toLocaleString()}
            </p>
            <p className="mt-1 text-[10px] font-semibold text-neutral-500">
              {language === 'es' ? 'Actualizado' : 'Updated'} {property.priceHistory!.lastModificationDate}
            </p>
          </article>
        )}

        {hasSourcedAppreciation && (
          <article className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <PropertySubIcon icon={TrendingUp} />
              <span className="text-[8px] font-black uppercase tracking-[0.12em] text-neutral-500">
                {language === 'es' ? 'Dato de tercero' : 'Third-party data'}
              </span>
            </div>
            <p className="mt-5 text-xl font-black tracking-tight text-neutral-950">
              {evidence!.appreciationRate!.toLocaleString(undefined, { maximumFractionDigits: 2 })}%
            </p>
            <p className="mt-1 text-[10px] font-semibold text-neutral-500">
              {evidence!.source} · {evidence!.measuredAt}
            </p>
            {evidence!.methodology && (
              <p className="mt-2 text-[9px] leading-relaxed text-neutral-400">{evidence!.methodology}</p>
            )}
          </article>
        )}
      </div>
    </PropertySectionCard>
  );
}
