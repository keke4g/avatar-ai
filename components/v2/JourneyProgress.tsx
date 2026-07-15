"use client";

import Link from 'next/link';
import { ArrowRight, Check, Circle, Scale, Search, ShieldCheck } from 'lucide-react';
import { useAuraV2 } from '../../lib/context/AuraV2Context';

const STEPS = [
  { id: 'DEFINE', label: 'Definir', icon: Circle },
  { id: 'EXPLORE', label: 'Explorar', icon: Search },
  { id: 'COMPARE', label: 'Comparar', icon: Scale },
  { id: 'VALIDATE', label: 'Validar', icon: ShieldCheck },
  { id: 'ACT', label: 'Contactar', icon: Check },
] as const;

export default function JourneyProgress({ compact = false }: { compact?: boolean }) {
  const { journeyStage, comparisonIds, brief } = useAuraV2();
  const activeIndex = STEPS.findIndex((step) => step.id === journeyStage);

  return (
    <section aria-label="Tu ruta de decisión" className={`rounded-[24px] border border-zinc-200 bg-white shadow-[0_12px_40px_rgba(24,24,27,0.04)] ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Tu ruta de decisión</p>
          <h2 className="mt-1 text-lg font-black tracking-tight text-zinc-950">
            {journeyStage === 'DEFINE' && 'Cuéntanos lo esencial'}
            {journeyStage === 'EXPLORE' && 'Encuentra tus primeras opciones'}
            {journeyStage === 'COMPARE' && 'Añade otra propiedad para comparar'}
            {journeyStage === 'VALIDATE' && 'Resuelve lo importante antes de contactar'}
            {journeyStage === 'ACT' && 'Da seguimiento a tus solicitudes'}
          </h2>
          {!compact && (
            <p className="mt-1 text-sm text-zinc-500">
              {brief.city ? `${brief.city}${brief.budget ? ` · Hasta ${brief.currency} $${brief.budget.toLocaleString('es-MX')}` : ''}` : 'Tus prioridades aparecerán aquí y podrás corregirlas.'}
            </p>
          )}
        </div>

        <ol className="flex min-w-0 flex-1 items-center justify-between gap-1 lg:max-w-2xl" aria-label="Progreso">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const completed = index < activeIndex;
            const active = index === activeIndex;
            return (
              <li key={step.id} className="flex min-w-0 flex-1 items-center last:flex-none">
                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-full border ${completed ? 'border-emerald-600 bg-emerald-600 text-white' : active ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-zinc-200 bg-zinc-50 text-zinc-400'}`} aria-current={active ? 'step' : undefined}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className={`hidden text-xs font-bold sm:block ${active ? 'text-zinc-950' : 'text-zinc-500'}`}>{step.label}</span>
                </div>
                {index < STEPS.length - 1 && <span className={`mx-1 h-px flex-1 ${completed ? 'bg-emerald-500' : 'bg-zinc-200'}`} aria-hidden="true" />}
              </li>
            );
          })}
        </ol>

        <Link href="/decision" className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-sm font-bold text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          Abrir mi carpeta {comparisonIds.length > 0 && `(${comparisonIds.length})`}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}

