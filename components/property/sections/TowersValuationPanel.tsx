'use client';

import { useId } from 'react';
import {
  ArrowRight,
  BarChart3,
  Building2,
  CalendarClock,
  CircleAlert,
  Gauge,
  House,
  Info,
  LineChart,
  Percent,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { Property, PropertyOfferingMode } from '../../../lib/types';

export type TowersValuationStatus = 'READY' | 'REFERENCE_ONLY' | 'INSUFFICIENT_DATA';
export type TowersMarketPosition = 'BELOW' | 'IN_RANGE' | 'ABOVE';

/**
 * Public, presentation-ready output from the valuation engine.
 *
 * `differencePercent` follows this convention:
 *   (published price - estimated value) / estimated value * 100
 * Negative values are below the estimate and positive values are above it.
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
}

type Metric = {
  key: string;
  label: string;
  value: string;
  helper?: string;
  icon: typeof Building2;
};

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
  referenceEstimate: number | null,
): TowersMarketPosition | null => {
  if (valuation.marketPosition) return valuation.marketPosition;
  if (!FINITE_POSITIVE(publishedPrice) || !FINITE_POSITIVE(referenceEstimate)) return null;

  if (
    FINITE_POSITIVE(valuation.estimatedMin)
    && FINITE_POSITIVE(valuation.estimatedMax)
    && publishedPrice >= valuation.estimatedMin
    && publishedPrice <= valuation.estimatedMax
  ) {
    return 'IN_RANGE';
  }

  return publishedPrice < referenceEstimate ? 'BELOW' : 'ABOVE';
};

const getModeLabel = (mode: PropertyOfferingMode, language: 'es' | 'en') => {
  const labels: Record<PropertyOfferingMode, { es: string; en: string }> = {
    SALE: { es: 'Estimación de venta', en: 'Sale valuation' },
    MONTHLY_RENT: { es: 'Estimación de renta mensual', en: 'Monthly rent estimate' },
    SHORT_RENT: { es: 'Estimación de estancia temporal', en: 'Short-stay estimate' },
    SWAP: { es: 'Estimación para intercambio', en: 'Swap valuation' },
  };
  return labels[mode][language];
};

export function TowersValuationPanel({
  property,
  valuation,
  language,
  onAskEterna,
  className = '',
}: TowersValuationPanelProps) {
  const headingId = useId();

  if (!valuation) return null;

  const mode = getPrimaryMode(property, valuation);
  const isAreaReference = valuation.status === 'REFERENCE_ONLY'
    && valuation.evidenceTier === 'AREA_REFERENCE';
  const currency = valuation.currency
    || (property.offerings || []).find((offering) => offering.mode === mode)?.currency
    || 'MXN';
  const publishedPrice = getPublishedPrice(property, valuation, mode);
  const isRentalMode = mode === 'MONTHLY_RENT' || mode === 'SHORT_RENT';
  const rentEstimate = mode === 'SHORT_RENT'
    ? valuation.estimatedNightlyRent
    : valuation.estimatedMonthlyRent;
  const referenceEstimate = isAreaReference
    ? (FINITE_POSITIVE(valuation.estimatedValue) ? valuation.estimatedValue : null)
    : isRentalMode
      ? (FINITE_POSITIVE(rentEstimate) ? rentEstimate : null)
      : (FINITE_POSITIVE(valuation.estimatedValue) ? valuation.estimatedValue : null);
  const position = isAreaReference ? null : getPosition(valuation, publishedPrice, referenceEstimate);
  const calculatedDifference = FINITE_POSITIVE(publishedPrice) && FINITE_POSITIVE(referenceEstimate)
    ? ((publishedPrice - referenceEstimate) / referenceEstimate) * 100
    : null;
  const differencePercent = isAreaReference
    ? null
    : typeof valuation.differencePercent === 'number' && Number.isFinite(valuation.differencePercent)
      ? valuation.differencePercent
      : calculatedDifference;

  const surface = FINITE_POSITIVE(property.surfaceBuilt)
    ? property.surfaceBuilt
    : (FINITE_POSITIVE(property.surfaceTotal) ? property.surfaceTotal : null);
  const estimatedPricePerM2 = FINITE_POSITIVE(valuation.estimatedPricePerM2)
    ? valuation.estimatedPricePerM2
    : (FINITE_POSITIVE(valuation.estimatedValue) && surface
        ? valuation.estimatedValue / surface
        : null);
  const estimatedRentPerM2 = FINITE_POSITIVE(valuation.estimatedRentPerM2)
    ? valuation.estimatedRentPerM2
    : (FINITE_POSITIVE(valuation.estimatedMonthlyRent) && surface
        ? valuation.estimatedMonthlyRent / surface
        : null);
  const grossCapRate = FINITE_POSITIVE(valuation.grossCapRate)
    ? valuation.grossCapRate
    : (FINITE_POSITIVE(valuation.estimatedMonthlyRent) && FINITE_POSITIVE(valuation.estimatedValue)
        ? (valuation.estimatedMonthlyRent * 12 / valuation.estimatedValue) * 100
        : null);

  const effectivelyInsufficient = valuation.status === 'INSUFFICIENT_DATA'
    || valuation.modelVersion !== 'towers-market-v5'
    || !FINITE_POSITIVE(referenceEstimate);

  if (effectivelyInsufficient) return null;

  const rangeIsValid = FINITE_POSITIVE(valuation.estimatedMin)
    && FINITE_POSITIVE(valuation.estimatedMax)
    && valuation.estimatedMax > valuation.estimatedMin;
  const publishedMarkerPosition = !isAreaReference && rangeIsValid && FINITE_POSITIVE(publishedPrice)
    ? clamp(((publishedPrice - valuation.estimatedMin!) / (valuation.estimatedMax! - valuation.estimatedMin!)) * 100, 0, 100)
    : null;
  const estimateMarkerPosition = rangeIsValid && FINITE_POSITIVE(referenceEstimate)
    ? clamp(((referenceEstimate - valuation.estimatedMin!) / (valuation.estimatedMax! - valuation.estimatedMin!)) * 100, 0, 100)
    : 50;

  const positionTone = position === 'BELOW'
    ? {
        label: language === 'es' ? 'por debajo de la estimación' : 'below the estimate',
        text: 'text-emerald-800',
        badge: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      }
    : position === 'ABOVE'
      ? {
          label: language === 'es' ? 'por encima de la estimación' : 'above the estimate',
          text: 'text-rose-800',
          badge: 'border-rose-200 bg-rose-50 text-rose-800',
        }
      : {
          label: language === 'es' ? 'dentro del rango estimado' : 'within the estimated range',
          text: 'text-amber-800',
          badge: 'border-amber-200 bg-amber-50 text-amber-800',
        };

  const headline = isAreaReference
    ? (language === 'es'
        ? 'Referencia de precios anunciados en este micromercado'
        : 'Asking-price reference for this micro-market')
    : isRentalMode
    ? position === 'BELOW'
      ? (language === 'es' ? 'La renta publicada está por debajo de la estimación' : 'The listed rent is below the estimate')
      : position === 'ABOVE'
        ? (language === 'es' ? 'La renta publicada está por encima de la estimación' : 'The listed rent is above the estimate')
        : (language === 'es' ? 'La renta publicada está dentro del rango estimado' : 'The listed rent is within the estimated range')
    : position === 'BELOW'
      ? (language === 'es' ? 'El precio publicado está por debajo del valor estimado' : 'The listing price is below the estimated value')
      : position === 'ABOVE'
        ? (language === 'es' ? 'El precio publicado está por encima del valor estimado' : 'The listing price is above the estimated value')
        : position === 'IN_RANGE'
          ? (language === 'es' ? 'El precio publicado está dentro del rango estimado' : 'The listing price is within the estimated range')
          : (language === 'es' ? 'Una referencia de valor para decidir con más contexto' : 'A value reference for a more informed decision');

  const metrics: Metric[] = [];
  if (FINITE_POSITIVE(estimatedPricePerM2)) {
    metrics.push({
      key: 'price-m2',
      label: isAreaReference
        ? (language === 'es' ? 'Referencia de oferta / m²' : 'Asking reference / m²')
        : (language === 'es' ? 'Valor estimado / m²' : 'Estimated value / m²'),
      value: formatMoney(estimatedPricePerM2, currency, language),
      helper: surface ? `${surface.toLocaleString(language === 'es' ? 'es-MX' : 'en-US')} m²` : undefined,
      icon: Building2,
    });
  }
  if (FINITE_POSITIVE(valuation.estimatedMonthlyRent)) {
    metrics.push({
      key: 'monthly-rent',
      label: language === 'es' ? 'Renta mensual estimada' : 'Estimated monthly rent',
      value: formatMoney(valuation.estimatedMonthlyRent, currency, language),
      helper: language === 'es' ? 'Referencia mensual' : 'Monthly reference',
      icon: House,
    });
  } else if (FINITE_POSITIVE(valuation.estimatedNightlyRent)) {
    metrics.push({
      key: 'nightly-rent',
      label: language === 'es' ? 'Tarifa nocturna estimada' : 'Estimated nightly rate',
      value: formatMoney(valuation.estimatedNightlyRent, currency, language),
      helper: language === 'es' ? 'Referencia por noche' : 'Nightly reference',
      icon: House,
    });
  }
  if (FINITE_POSITIVE(estimatedRentPerM2)) {
    metrics.push({
      key: 'rent-m2',
      label: language === 'es' ? 'Renta estimada / m²' : 'Estimated rent / m²',
      value: formatMoney(estimatedRentPerM2, currency, language),
      helper: language === 'es' ? 'Mensual' : 'Monthly',
      icon: BarChart3,
    });
  }
  if (FINITE_POSITIVE(grossCapRate)) {
    metrics.push({
      key: 'cap-rate',
      label: language === 'es' ? 'Cap rate bruto estimado' : 'Estimated gross cap rate',
      value: `${grossCapRate.toLocaleString(language === 'es' ? 'es-MX' : 'en-US', { maximumFractionDigits: 2 })}%`,
      helper: language === 'es' ? 'Antes de gastos e impuestos' : 'Before expenses and taxes',
      icon: Percent,
    });
  }

  const confidenceScore = typeof valuation.confidenceScore === 'number'
    ? clamp(valuation.confidenceScore, 0, 100)
    : null;
  const confidenceLabel = valuation.confidenceLabel
    || (valuation.status === 'REFERENCE_ONLY'
      ? (language === 'es' ? 'Referencia orientativa' : 'Indicative reference')
      : (language === 'es' ? 'Confianza calculada' : 'Calculated confidence'));
  const rangeLabel = rangeIsValid
    ? `${formatMoney(valuation.estimatedMin!, currency, language)} – ${formatMoney(valuation.estimatedMax!, currency, language)}`
    : null;

  return (
    <section
      aria-labelledby={headingId}
      className={`overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_28px_72px_-48px_rgba(15,23,42,0.62)] ${className}`}
    >
      <div className="relative overflow-hidden border-b border-slate-200/80 bg-[linear-gradient(135deg,#f7fbfd_0%,#ffffff_52%,#f2f8fb_100%)] p-5 sm:p-7 lg:p-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-28 h-64 w-64 rounded-full bg-sky-200/25 blur-3xl" />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.35fr)] lg:items-center lg:gap-10">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/85 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-sky-800 shadow-sm">
                <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
                {isAreaReference
                  ? (language === 'es' ? 'Referencia de mercado' : 'Market reference')
                  : (language === 'es' ? 'Estimación Towers' : 'Towers valuation')}
              </span>
              <span className="rounded-full bg-slate-950 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white">
                {isAreaReference
                  ? (language === 'es' ? 'Precios anunciados' : 'Asking prices')
                  : getModeLabel(mode, language)}
              </span>
            </div>
            <h2 id={headingId} className="mt-5 max-w-xl text-xl font-black leading-tight tracking-[-0.035em] text-slate-950 sm:text-2xl lg:text-[28px]">
              {headline}
            </h2>
            <p className="mt-3 max-w-xl text-xs font-semibold leading-relaxed text-slate-500 sm:text-sm">
              {isAreaReference
                ? (language === 'es'
                    ? 'Comparamos anuncios del mismo micromercado y equilibramos el peso de cada portal. No usamos distancias inventadas: es una orientación de oferta, no un avalúo ni un precio de cierre.'
                    : 'We compare listings in the same micro-market and balance each portal. No distance is invented: this is asking-price guidance, not an appraisal or closing price.')
                : (language === 'es'
                    ? 'Comparamos ubicación, superficies y señales del mercado para ofrecerte una referencia clara, no un avalúo oficial.'
                    : 'We compare location, areas and market signals to provide a clear reference, not an official appraisal.')}
            </p>
            {onAskEterna && (
              <button
                type="button"
                onClick={onAskEterna}
                className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-5 text-xs font-black text-white shadow-[0_16px_30px_-18px_rgba(2,132,199,0.8)] transition hover:-translate-y-0.5 hover:bg-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 sm:w-auto"
              >
                <Sparkles aria-hidden="true" className="h-4 w-4" />
                {language === 'es' ? 'Pídele a Eterna que te lo explique' : 'Ask Eterna to explain it'}
                <ArrowRight aria-hidden="true" className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="min-w-0 rounded-[24px] border border-white/90 bg-white/90 p-4 shadow-[0_22px_52px_-40px_rgba(15,23,42,0.75)] backdrop-blur sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400">
                  <LineChart aria-hidden="true" className="h-4 w-4 text-sky-700" />
                  {isRentalMode
                    ? (isAreaReference
                        ? (language === 'es' ? 'Referencia mensual de oferta' : 'Monthly asking reference')
                        : (language === 'es' ? 'Renta estimada' : 'Estimated rent'))
                    : (isAreaReference
                        ? (language === 'es' ? 'Referencia central de oferta' : 'Central asking reference')
                        : (language === 'es' ? 'Valor estimado' : 'Estimated value'))}
                </p>
                <p className="mt-2 truncate text-[28px] font-black tracking-[-0.045em] text-slate-950 sm:text-3xl">
                  {formatMoney(referenceEstimate!, currency, language)}
                  {isRentalMode && (
                    <span className="ml-1 text-xs font-bold tracking-normal text-slate-400">
                      / {mode === 'SHORT_RENT'
                        ? (language === 'es' ? 'noche' : 'night')
                        : (language === 'es' ? 'mes' : 'month')}
                    </span>
                  )}
                </p>
              </div>
              <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-black ${
                isAreaReference
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-800'
              }`}>
                {isAreaReference
                  ? <CircleAlert aria-hidden="true" className="h-3.5 w-3.5" />
                  : <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />}
                {confidenceLabel}
                {!isAreaReference && confidenceScore !== null ? ` · ${Math.round(confidenceScore)}%` : ''}
              </span>
            </div>

            {differencePercent !== null && position && (
              <p className={`mt-3 text-xs font-black ${positionTone.text}`}>
                {Math.abs(differencePercent).toLocaleString(language === 'es' ? 'es-MX' : 'en-US', { maximumFractionDigits: 1 })}% {positionTone.label}
              </p>
            )}

            {rangeIsValid && (
              <div className="mt-5 border-t border-slate-100 pt-4">
                <div
                  role="img"
                  aria-label={isAreaReference
                    ? (language === 'es'
                        ? `Rango orientativo de precios anunciados de ${formatMoney(valuation.estimatedMin!, currency, language)} a ${formatMoney(valuation.estimatedMax!, currency, language)}.`
                        : `Indicative asking-price range from ${formatMoney(valuation.estimatedMin!, currency, language)} to ${formatMoney(valuation.estimatedMax!, currency, language)}.`)
                    : (language === 'es'
                        ? `Rango estimado de ${formatMoney(valuation.estimatedMin!, currency, language)} a ${formatMoney(valuation.estimatedMax!, currency, language)}${FINITE_POSITIVE(publishedPrice) ? `; precio publicado ${formatMoney(publishedPrice, currency, language)}` : ''}.`
                        : `Estimated range from ${formatMoney(valuation.estimatedMin!, currency, language)} to ${formatMoney(valuation.estimatedMax!, currency, language)}${FINITE_POSITIVE(publishedPrice) ? `; listing price ${formatMoney(publishedPrice, currency, language)}` : ''}.`)}
                >
                  <div className="mb-2 flex items-center justify-between gap-3 text-[9px] font-black uppercase tracking-[0.1em] text-slate-400">
                    <span>{isAreaReference
                      ? (language === 'es' ? 'Rango orientativo de oferta' : 'Indicative asking range')
                      : (language === 'es' ? 'Rango estimado' : 'Estimated range')}</span>
                    <span className="truncate text-right normal-case tracking-normal text-slate-600">{rangeLabel}</span>
                  </div>
                  <div className="relative h-2 rounded-full bg-[linear-gradient(90deg,#34d399_0%,#fbbf24_52%,#fb7185_100%)]">
                    <span
                      aria-hidden="true"
                      className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-800 ring-2 ring-white"
                      style={{ left: `${estimateMarkerPosition}%` }}
                    />
                    {publishedMarkerPosition !== null && (
                      <span
                        aria-hidden="true"
                        className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-slate-950 shadow-md"
                        style={{ left: `${publishedMarkerPosition}%` }}
                      />
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[9px] font-bold text-slate-500">
                    <span>{formatCompactMoney(valuation.estimatedMin!, currency, language)}</span>
                    {FINITE_POSITIVE(publishedPrice) && (
                      <span className={`rounded-full border px-2 py-1 ${positionTone.badge}`}>
                        {language === 'es' ? 'Publicado' : 'Listed'}: {formatCompactMoney(publishedPrice, currency, language)}
                      </span>
                    )}
                    <span>{formatCompactMoney(valuation.estimatedMax!, currency, language)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-px bg-slate-200/80 sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            return (
              <article key={metric.key} className="min-w-0 bg-white p-4 sm:p-5">
                <span className="flex h-9 w-9 items-center justify-center rounded-[13px] border border-slate-200 bg-slate-50 text-sky-800">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <p className="mt-4 text-[9px] font-black uppercase leading-tight tracking-[0.11em] text-slate-400">
                  {metric.label}
                </p>
                <p className="mt-1.5 truncate text-base font-black tracking-tight text-slate-950 sm:text-lg" title={metric.value}>
                  {metric.value}
                </p>
                {metric.helper && (
                  <p className="mt-1 text-[9px] font-semibold leading-tight text-slate-400">{metric.helper}</p>
                )}
              </article>
            );
          })}
        </div>
      )}

      <div className="border-t border-slate-200/80 bg-slate-50/70 px-5 py-4 sm:px-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold text-slate-500">
            {typeof valuation.comparableCount === 'number' && valuation.comparableCount >= 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Gauge aria-hidden="true" className="h-3.5 w-3.5 text-sky-700" />
                {valuation.comparableCount} {language === 'es' ? 'comparables analizados' : 'comparables analyzed'}
              </span>
            )}
            {valuation.dataCutoff && (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock aria-hidden="true" className="h-3.5 w-3.5 text-sky-700" />
                {language === 'es' ? 'Datos al' : 'Data through'}{' '}
                <time dateTime={valuation.dataCutoff}>{formatDate(valuation.dataCutoff, language)}</time>
              </span>
            )}
            {valuation.modelVersion && (
              <span>{language === 'es' ? 'Modelo' : 'Model'} {valuation.modelVersion}</span>
            )}
          </div>
          {(valuation.methodology || (valuation.sourceLabels && valuation.sourceLabels.length > 0)) && (
            <details className="group text-[10px] text-slate-500 sm:max-w-md">
              <summary className="flex cursor-pointer list-none items-center justify-end gap-1.5 font-black text-sky-800 outline-none marker:hidden focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2">
                <Info aria-hidden="true" className="h-3.5 w-3.5" />
                {language === 'es' ? 'Metodología y fuentes' : 'Methodology and sources'}
              </summary>
              <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3 text-left leading-relaxed shadow-sm">
                {valuation.methodology && <p>{valuation.methodology}</p>}
                {valuation.sourceLabels && valuation.sourceLabels.length > 0 && (
                  <p className={valuation.methodology ? 'mt-2' : ''}>
                    <strong>{language === 'es' ? 'Fuentes:' : 'Sources:'}</strong>{' '}
                    {valuation.sourceLabels.join(', ')}.
                  </p>
                )}
                <p className="mt-2 font-semibold text-slate-600">
                  {isAreaReference
                    ? (language === 'es'
                        ? 'Son precios solicitados en anuncios comparables, no operaciones cerradas. Esta referencia no es un avalúo ni sustituye la revisión de un perito autorizado.'
                        : 'These are asking prices from comparable listings, not closed transactions. This reference is not an appraisal and does not replace an authorized professional review.')
                    : (language === 'es'
                        ? 'Esta estimación automatizada es informativa y no sustituye un avalúo realizado por un perito autorizado.'
                        : 'This automated estimate is informational and does not replace an appraisal by an authorized professional.')}
                </p>
              </div>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}
