'use client';

import { motion } from 'framer-motion';
import { Clock3, Gauge, TrendingUp } from 'lucide-react';
import { Property } from '../../../lib/types';

interface EternaMarketAnalysisProps {
  property: Property;
  language: 'es' | 'en';
}

export function EternaMarketAnalysis({
  property,
  language,
}: EternaMarketAnalysisProps) {
  const isProp1 = property.id === 'prop-1';
  const speedLabel = isProp1
    ? (language === 'es' ? 'Rápida' : 'Fast')
    : (language === 'es' ? 'Media–alta' : 'Moderate–high');
  const speedPercentage = isProp1 ? 88 : 72;
  const estimatedTime = isProp1
    ? (language === 'es' ? '45–60 días' : '45–60 days')
    : (language === 'es' ? '60–90 días' : '60–90 days');
  const estimatedDays = isProp1 ? 52 : 75;
  const appreciationRate = isProp1 ? '8.5%' : '8.2%';
  const appreciationValue = isProp1 ? 8.5 : 8.2;

  const metrics = [
    {
      key: 'velocity',
      Icon: Gauge,
      label: language === 'es' ? 'Velocidad comercial' : 'Commercial velocity',
      value: speedLabel,
      detail: language === 'es' ? 'Ritmo estimado de colocación' : 'Estimated placement pace',
    },
    {
      key: 'time',
      Icon: Clock3,
      label: language === 'es' ? 'Tiempo estimado' : 'Estimated time',
      value: estimatedTime,
      detail: language === 'es' ? 'Ventana comercial orientativa' : 'Indicative commercial window',
    },
    {
      key: 'appreciation',
      Icon: TrendingUp,
      label: language === 'es' ? 'Plusvalía anual' : 'Annual appreciation',
      value: appreciationRate,
      detail: language === 'es' ? 'Proyección anual de la zona' : 'Annual area projection',
    },
  ];

  return (
    <section className="mb-6 overflow-hidden rounded-3xl border border-brand-gray-200/80 bg-white shadow-[0_12px_35px_rgba(15,23,42,0.045)]" aria-labelledby="market-analysis-heading">
      <div className="flex flex-col gap-2 border-b border-brand-gray-200/80 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
        <div>
          <span className="text-[9px] font-black uppercase tracking-[0.18em] text-brand-accent">
            {language === 'es' ? 'Inteligencia inmobiliaria' : 'Real estate intelligence'}
          </span>
          <h3 id="market-analysis-heading" className="mt-1 text-lg font-black tracking-tight text-brand-black">
            {language === 'es' ? 'Indicadores comerciales estimados' : 'Estimated commercial indicators'}
          </h3>
        </div>
        <p className="max-w-sm text-[10px] font-semibold leading-relaxed text-brand-gray-500 sm:text-right">
          {language === 'es'
            ? 'Estimaciones orientativas de Eterna; confirma las condiciones actuales con el responsable.'
            : 'Indicative Eterna estimates; confirm current conditions with the representative.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 sm:p-5">
        {metrics.map(({ key, Icon, label, value, detail }) => (
          <article key={key} className="flex min-h-[150px] flex-col rounded-2xl border border-brand-gray-200/80 bg-brand-gray-50/55 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-black shadow-xs ring-1 ring-brand-gray-200/70">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="text-right text-[9px] font-black uppercase tracking-[0.11em] text-brand-gray-500">
                {label}
              </span>
            </div>
            <data
              value={key === 'time' ? estimatedDays : key === 'appreciation' ? appreciationValue : speedPercentage}
              className={`mt-5 block text-2xl font-black tracking-tight ${key === 'appreciation' ? 'text-emerald-600' : 'text-brand-black'}`}
            >
              {value}
            </data>
            <p className="mt-1 text-[10px] font-semibold text-brand-gray-500">{detail}</p>
            {key === 'velocity' && (
              <div className="mt-auto h-1.5 overflow-hidden rounded-full bg-brand-gray-200" aria-hidden="true">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${speedPercentage}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full bg-brand-black"
                />
              </div>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
