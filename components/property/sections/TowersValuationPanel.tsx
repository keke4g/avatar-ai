'use client';

import { useId, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Calculator,
  CalendarClock,
  ChevronDown,
  Gauge,
  Info,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { Property, PropertyOfferingMode } from '../../../lib/types';

export type TowersValuationStatus = 'READY' | 'REFERENCE_ONLY' | 'INSUFFICIENT_DATA';
export type TowersMarketPosition = 'BELOW' | 'IN_RANGE' | 'ABOVE';

/**
 * Public, presentation-ready output from the valuation engine.
 *
 * `differencePercent` follows this convention:
 *   (published price - estimated value) / estimated value * 100
 */
export interface TowersPropertyValuation {
  status: TowersValuationStatus;
  mode?: PropertyOfferingMode;
  currency?: string;
  estimatedValue?: number | null;
  estimatedMin?: number | null;
  estimatedMax?: number | null;
  estimatedPricePerM2?: number | null;
  publishedPrice?: number | null;
  differenceAmount?: number | null;
  differencePercent?: number | null;
  marketPosition?: TowersMarketPosition | null;
  estimatedMonthlyRent?: number | null;
  estimatedNightlyRent?: number | null;
  estimatedRentPerM2?: number | null;
  grossCapRate?: number | null;
  confidenceScore?: number | null;
  confidenceLabel?: string | null;
  comparableCount?: number | null;
  calculatedAt?: string | null;
  dataCutoff?: string | null;
  modelVersion?: string | null;
  evidenceTier?: 'STRICT_ESTIMATE' | 'AREA_REFERENCE' | 'INSUFFICIENT' | null;
  methodology?: string | null;
  sourceLabels?: string[];
  missingFields?: string[];
  insufficiencyReasons?: string[];
}

interface TowersValuationPanelProps {
  property: Property;
  valuation: TowersPropertyValuation | null | undefined;
  language: 'es' | 'en';
  onAskEterna?: () => void;
  className?: string;
  defaultExpanded?: boolean;
}

const FINITE_POSITIVE = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value) && value > 0
);

const clamp = (value: number, min: number, max: number) => (
  Math.min(Math.max(value, min), max)
);

const formatMoney = (value: number, currency: string, language: 'es' | 'en') => {
  try {
    return new Intl.NumberFormat(language === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} $${Math.round(value).toLocaleString(language === 'es' ? 'es-MX' : 'en-US')}`;
  }
};

const formatCompactMoney = (value: number, currency: string, language: 'es' | 'en') => {
  try {
    return new Intl.NumberFormat(language === 'es' ? 'es-MX' : 'en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      notation: 'compact',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return formatMoney(value, currency, language);
  }
};

const formatDate = (value: string, language: 'es' | 'en') => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === 'es' ? 'es-MX' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const getPrimaryMode = (
  property: Property,
  valuation: TowersPropertyValuation,
): PropertyOfferingMode => {
  if (valuation.mode) return valuation.mode;
  const activeModes = new Set(
    (property.offerings || [])
      .filter((offering) => offering.status === 'ACTIVE')
      .map((offering) => offering.mode),
  );
  return (['SALE', 'MONTHLY_RENT', 'SHORT_RENT', 'SWAP'] as const)
    .find((mode) => activeModes.has(mode)) || 'SALE';
};

const getPublishedPrice = (
  property: Property,
  valuation: TowersPropertyValuation,
  mode: PropertyOfferingMode,
) => {
  if (FINITE_POSITIVE(valuation.publishedPrice)) return valuation.publishedPrice;
  return (property.offerings || []).find(
    (offering) => offering.mode === mode && offering.status === 'ACTIVE',
  )?.priceAmount || null;
};

const getPosition = (
  valuation: TowersPropertyValuation,
  publishedPrice: number | null,
  referenceEstimate: number,
): TowersMarketPosition | null => {
  if (valuation.marketPosition) return valuation.marketPosition;
  if (!FINITE_POSITIVE(publishedPrice)) return null;
  const difference = (publishedPrice - referenceEstimate) / referenceEstimate * 100;
  if (Math.abs(difference) < 1) return 'IN_RANGE';
  return difference < 0 ? 'BELOW' : 'ABOVE';
};

const getEvidenceLabel = (
  valuation: TowersPropertyValuation,
  language: 'es' | 'en',
) => {
  if (valuation.confidenceLabel) return valuation.confidenceLabel;
  const count = valuation.comparableCount || 0;
  if (count >= 8) return language === 'es' ? 'Estimación respaldada' : 'Broad market estimate';
  if (count >= 5) return language === 'es' ? 'Estimación orientativa' : 'Indicative market estimate';
  return language === 'es' ? 'Estimación inicial' : 'Initial market estimate';
};

export function TowersValuationPanel({
  property,
  valuation,
  language,
  onAskEterna,
  className = '',
  defaultExpanded = false,
}: TowersValuationPanelProps) {
  const headingId = useId();
  const contentId = useId();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  if (!valuation) return null;

  const mode = getPrimaryMode(property, valuation);
  const isRentalMode = mode === 'MONTHLY_RENT' || mode === 'SHORT_RENT';
  const currency = valuation.currency
    || (property.offerings || []).find((offering) => offering.mode === mode)?.currency
    || 'MXN';
  const referenceEstimate = FINITE_POSITIVE(valuation.estimatedValue)
    ? valuation.estimatedValue
    : null;
  const publishedPrice = getPublishedPrice(property, valuation, mode);
  const surface = FINITE_POSITIVE(property.surfaceBuilt)
    ? property.surfaceBuilt
    : FINITE_POSITIVE(property.surfaceTotal)
      ? property.surfaceTotal
      : null;
  const estimatedPricePerM2 = FINITE_POSITIVE(valuation.estimatedPricePerM2)
    ? valuation.estimatedPricePerM2
    : referenceEstimate && surface
      ? referenceEstimate / surface
      : null;

  if (
    valuation.status === 'INSUFFICIENT_DATA'
    || valuation.modelVersion !== 'towers-market-v5'
    || !referenceEstimate
  ) return null;

  const rangeIsValid = FINITE_POSITIVE(valuation.estimatedMin)
    && FINITE_POSITIVE(valuation.estimatedMax)
    && valuation.estimatedMax > valuation.estimatedMin;
  const position = getPosition(valuation, publishedPrice, referenceEstimate);
  const calculatedDifference = FINITE_POSITIVE(publishedPrice)
    ? ((publishedPrice - referenceEstimate) / referenceEstimate) * 100
    : null;
  const differencePercent = typeof valuation.differencePercent === 'number'
    && Number.isFinite(valuation.differencePercent)
    ? valuation.differencePercent
    : calculatedDifference;

  const rangeSpan = rangeIsValid ? valuation.estimatedMax! - valuation.estimatedMin! : 0;
  const trackMin = rangeIsValid ? Math.max(1, valuation.estimatedMin! - rangeSpan * 0.35) : 0;
  const trackMax = rangeIsValid ? valuation.estimatedMax! + rangeSpan * 0.35 : 0;
  const markerPosition = (value: number) => (
    rangeIsValid && trackMax > trackMin
      ? clamp((value - trackMin) / (trackMax - trackMin) * 100, 2, 98)
      : 50
  );
  const estimateMarkerPosition = markerPosition(referenceEstimate);
  const publishedMarkerPosition = FINITE_POSITIVE(publishedPrice)
    ? markerPosition(publishedPrice)
    : null;

  const positionTheme = position === 'BELOW'
    ? {
        label: language === 'es' ? 'Precio bajo' : 'Below estimate',
        explanation: language === 'es' ? 'por debajo del estimado' : 'below the estimate',
        accent: 'text-emerald-300',
        chip: 'border-emerald-400/35 bg-emerald-400/12 text-emerald-200',
        icon: TrendingDown,
      }
    : position === 'ABOVE'
      ? {
          label: language === 'es' ? 'Precio alto' : 'Above estimate',
          explanation: language === 'es' ? 'por encima del estimado' : 'above the estimate',
          accent: 'text-rose-300',
          chip: 'border-rose-400/35 bg-rose-400/12 text-rose-200',
          icon: TrendingUp,
        }
      : {
          label: language === 'es' ? 'Precio alineado' : 'Aligned with estimate',
          explanation: language === 'es' ? 'respecto al punto estimado' : 'from the estimated midpoint',
          accent: 'text-amber-200',
          chip: 'border-amber-300/35 bg-amber-300/10 text-amber-100',
          icon: Minus,
        };
  const PositionIcon = positionTheme.icon;
  const differenceExplanation = position === 'IN_RANGE'
    ? (language === 'es' ? 'alineado con el estimado' : 'aligned with the estimate')
    : positionTheme.explanation;
  const evidenceLabel = getEvidenceLabel(valuation, language);
  const estimatedLabel = isRentalMode
    ? (language === 'es' ? 'Renta mensual estimada' : 'Estimated monthly rent')
    : (language === 'es' ? 'Precio estimado' : 'Estimated price');

  return (
    <section
      aria-labelledby={headingId}
      className={`scroll-mt-28 overflow-hidden rounded-[24px] border border-slate-200 bg-white text-slate-950 shadow-[0_24px_64px_-48px_rgba(15,23,42,0.72)] dark:border-white/10 dark:bg-[#11161d] dark:text-[#f3f0e9] dark:shadow-[0_28px_70px_-46px_rgba(0,0,0,0.9)] ${className}`}
    >
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setIsExpanded((expanded) => !expanded)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-600 dark:hover:bg-white/[0.035] sm:px-6 sm:py-5"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm dark:bg-[#ecd29a] dark:text-[#19140c]">
            <Calculator aria-hidden="true" className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0">
            <span className="block text-[9px] font-black uppercase tracking-[0.18em] text-sky-700 dark:text-[#d8b777]">
              {language === 'es' ? 'Guía de mercado Towers' : 'Towers market guide'}
            </span>
            <span
              id={headingId}
              role="heading"
              aria-level={2}
              className="mt-0.5 block truncate text-base font-black tracking-[-0.03em] text-slate-950 dark:text-[#f3f0e9] sm:text-lg"
            >
              {language === 'es' ? '¿Cómo está posicionado este precio?' : 'How is this listing priced?'}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-3">
          <span className="hidden text-right sm:block">
            <span className="block text-[8px] font-black uppercase tracking-[0.14em] text-slate-400 dark:text-white/40">
              {language === 'es' ? 'Estimado' : 'Estimate'}
            </span>
            <span className="mt-0.5 block text-sm font-black text-slate-900 dark:text-[#ecd29a]">
              {formatCompactMoney(referenceEstimate, currency, language)}
            </span>
          </span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.045] dark:text-white/70">
            <ChevronDown
              aria-hidden="true"
              className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            />
          </span>
        </span>
      </button>

      {isExpanded && (
        <div id={contentId} className="animate-in fade-in slide-in-from-top-1 border-t border-slate-200 duration-200 dark:border-white/10">
          {onAskEterna && (
            <div className="flex justify-end px-3 pt-3 sm:px-5 sm:pt-4">
              <button
                type="button"
                onClick={onAskEterna}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-[10px] font-black text-slate-800 transition hover:-translate-y-0.5 hover:border-sky-300 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 dark:border-white/12 dark:bg-white/[0.045] dark:text-[#f3f0e9] dark:hover:border-[#d8b777]/50 dark:hover:text-[#ecd29a]"
              >
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                {language === 'es' ? 'Explícamelo con Eterna' : 'Ask Eterna'}
                <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

      <div className="px-3 pb-3 sm:px-5 sm:pb-5">
        <div className="overflow-hidden rounded-[24px] bg-[#111315] text-white shadow-[0_24px_55px_-38px_rgba(15,23,42,0.9)]">
          <div className="grid gap-0 lg:grid-cols-[1.18fr_0.82fr]">
            <div className="p-5 sm:p-7 lg:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black ${positionTheme.chip}`}>
                  <PositionIcon aria-hidden="true" className="h-3.5 w-3.5" />
                  {positionTheme.label}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-slate-300">
                  {evidenceLabel}
                </span>
              </div>

              <p className="mt-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                <Calculator aria-hidden="true" className="h-4 w-4" />
                {estimatedLabel}
              </p>
              <p className="mt-2 text-[clamp(2rem,6vw,3.3rem)] font-black leading-none tracking-[-0.055em] text-white">
                {formatMoney(referenceEstimate, currency, language)}
                {isRentalMode && (
                  <span className="ml-2 text-xs font-bold tracking-normal text-slate-400">
                    / {language === 'es' ? 'mes' : 'month'}
                  </span>
                )}
              </p>
              {estimatedPricePerM2 && (
                <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-400">
                  <Building2 aria-hidden="true" className="h-4 w-4" />
                  {formatMoney(estimatedPricePerM2, currency, language)} / m²
                </p>
              )}

              {differencePercent !== null && position && (
                <p className={`mt-6 text-sm font-black ${positionTheme.accent}`}>
                  {Math.abs(differencePercent).toLocaleString(language === 'es' ? 'es-MX' : 'en-US', { maximumFractionDigits: 1 })}%{' '}
                  {differenceExplanation}
                </p>
              )}
            </div>

            <div className="border-t border-white/10 bg-white/[0.035] p-5 sm:p-7 lg:border-l lg:border-t-0 lg:p-8">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {language === 'es' ? 'Precio publicado' : 'Listing price'}
              </p>
              <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
                {FINITE_POSITIVE(publishedPrice)
                  ? formatMoney(publishedPrice, currency, language)
                  : (language === 'es' ? 'No disponible' : 'Unavailable')}
              </p>

              {rangeIsValid && (
                <div className="mt-7">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                    {language === 'es' ? 'Rango de precio estimado' : 'Estimated price range'}
                  </p>
                  <p className="mt-2 text-base font-black leading-snug text-white sm:text-lg">
                    {formatMoney(valuation.estimatedMin!, currency, language)}
                    <span className="mx-2 text-slate-600">–</span>
                    {formatMoney(valuation.estimatedMax!, currency, language)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {rangeIsValid && (
            <div className="border-t border-white/10 px-5 py-5 sm:px-7 lg:px-8">
              <div
                role="img"
                aria-label={language === 'es'
                  ? `Rango estimado de ${formatMoney(valuation.estimatedMin!, currency, language)} a ${formatMoney(valuation.estimatedMax!, currency, language)}${FINITE_POSITIVE(publishedPrice) ? `; precio publicado ${formatMoney(publishedPrice, currency, language)}` : ''}.`
                  : `Estimated range from ${formatMoney(valuation.estimatedMin!, currency, language)} to ${formatMoney(valuation.estimatedMax!, currency, language)}${FINITE_POSITIVE(publishedPrice) ? `; listing price ${formatMoney(publishedPrice, currency, language)}` : ''}.`}
              >
                <div className="relative h-2.5 rounded-full bg-[linear-gradient(90deg,#22c55e_0%,#facc15_52%,#fb7185_100%)]">
                  <span
                    aria-hidden="true"
                    className="absolute top-1/2 h-5 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80"
                    style={{ left: `${estimateMarkerPosition}%` }}
                  />
                  {publishedMarkerPosition !== null && (
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-slate-950 shadow-[0_2px_10px_rgba(0,0,0,0.65)]"
                      style={{ left: `${publishedMarkerPosition}%` }}
                    />
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between gap-4 text-[9px] font-bold text-slate-500">
                  <span>{formatCompactMoney(trackMin, currency, language)}</span>
                  <span>{language === 'es' ? '● Publicado · | Estimado' : '● Listed · | Estimated'}</span>
                  <span>{formatCompactMoney(trackMax, currency, language)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 bg-white px-5 py-4 dark:border-white/10 dark:bg-[#0d1117] sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold text-slate-500 dark:text-white/45">
            {typeof valuation.comparableCount === 'number' && valuation.comparableCount > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Gauge aria-hidden="true" className="h-3.5 w-3.5 text-sky-700" />
                {valuation.comparableCount} {language === 'es' ? 'propiedades comparables' : 'comparable properties'}
              </span>
            )}
            {valuation.dataCutoff && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock aria-hidden="true" className="h-3.5 w-3.5 text-sky-700" />
                {language === 'es' ? 'Datos al' : 'Data through'}{' '}
                <time dateTime={valuation.dataCutoff}>{formatDate(valuation.dataCutoff, language)}</time>
              </span>
            )}
          </div>

          <details className="group text-[10px] text-slate-500 dark:text-white/50 sm:max-w-md">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 font-black text-sky-800 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 dark:text-[#d8b777] sm:justify-end">
              <Info aria-hidden="true" className="h-3.5 w-3.5" />
              {language === 'es' ? 'Cómo se calculó' : 'How it was calculated'}
            </summary>
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-left leading-relaxed dark:border-white/10 dark:bg-white/[0.035]">
              {valuation.methodology && <p>{valuation.methodology}</p>}
              {valuation.sourceLabels && valuation.sourceLabels.length > 0 && (
                <p className={valuation.methodology ? 'mt-2' : ''}>
                  <strong>{language === 'es' ? 'Fuentes:' : 'Sources:'}</strong>{' '}
                  {valuation.sourceLabels.join(', ')}.
                </p>
              )}
              <p className="mt-2 font-semibold text-slate-600 dark:text-white/60">
                {language === 'es'
                  ? 'Es una estimación comercial aproximada basada principalmente en precios anunciados; no sustituye un avalúo profesional.'
                  : 'This is an approximate commercial estimate based mainly on asking prices; it does not replace a professional appraisal.'}
              </p>
            </div>
          </details>
        </div>
      </div>
        </div>
      )}
    </section>
  );
}
