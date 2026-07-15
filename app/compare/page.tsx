"use client";

import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Bath, BedDouble, Car, Check, CircleHelp, MapPin, MessageCircle, Scale, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react';
import JourneyProgress from '../../components/v2/JourneyProgress';
import { useAuraV2 } from '../../lib/context/AuraV2Context';
import { useSwap } from '../../lib/context/SwapContext';
import { buildDecisionSummary, estimateOwnershipCost, getPropertyPrice } from '../../lib/auraswap2/decision';
import { formatPropertyLocation } from '../../lib/textHelpers';
import { useLiveContext } from '../../lib/context/LiveContext';

const money = (value: number, currency = 'MXN') => `${currency} $${Math.round(value).toLocaleString('es-MX')}`;

export default function ComparePage() {
  const { properties, loading } = useSwap();
  const { comparisonIds, toggleComparison, clearComparison, brief } = useAuraV2();
  const { sendPrompt } = useLiveContext();
  const selected = comparisonIds.map((id) => properties.find((property) => property.id === id)).filter(Boolean);
  const comparisonAnalysis = selected.map((property) => {
    if (!property) return null;
    const summary = buildDecisionSummary(property, brief, { comparisonCount: selected.length });
    return {
      property,
      summary,
      met: summary.requirements.filter((requirement) => requirement.met).length,
      pending: summary.missingInformation.length,
      price: getPropertyPrice(property).amount || Number.MAX_SAFE_INTEGER,
    };
  }).filter(Boolean).sort((a, b) => {
    if (!a || !b) return 0;
    return b.met - a.met || a.pending - b.pending || a.price - b.price;
  });
  const mostAligned = comparisonAnalysis[0];
  const hasDecisionCriteria = comparisonAnalysis.some((item) => (item?.summary.requirementCount || 0) > 0);

  if (loading) {
    return <div className="mx-auto max-w-7xl px-5 py-16 text-center text-base font-bold text-zinc-600">Preparando tu comparación…</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href="/explore" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-800 hover:border-zinc-400"><ArrowLeft className="h-4 w-4" /> Seguir explorando</Link>
        {selected.length > 0 && <button type="button" onClick={clearComparison} className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-rose-700 hover:bg-rose-50"><Trash2 className="h-4 w-4" /> Limpiar comparación</button>}
      </div>

      <JourneyProgress />

      <header className="mb-8 mt-10 max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Comparación explicable</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-5xl">Elige por lo que importa, no por una puntuación.</h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-600">Comparamos hasta tres propiedades con tus prioridades, los costos orientativos y los datos que todavía requieren confirmación.</p>
      </header>

      {selected.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-zinc-300 bg-white p-10 text-center">
          <Scale className="mx-auto h-10 w-10 text-indigo-600" />
          <h2 className="mt-4 text-xl font-black text-zinc-950">Aún no seleccionas propiedades</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-zinc-500">Añade opciones desde el explorador o desde la ficha de una propiedad. Te avisaremos al llegar al límite de tres.</p>
          <Link href="/explore" className="mt-5 inline-flex min-h-12 items-center rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white">Buscar propiedades</Link>
        </div>
      ) : (
        <>
        {selected.length >= 2 && mostAligned && (
          <section className="mb-6 grid gap-5 rounded-[28px] border border-indigo-200 bg-indigo-50/70 p-5 sm:p-7 lg:grid-cols-[1fr_auto] lg:items-center" aria-labelledby="compare-guidance-title">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-700"><Sparkles className="h-4 w-4" /> Lectura transparente</p>
              <h2 id="compare-guidance-title" className="mt-2 text-xl font-black text-zinc-950">{hasDecisionCriteria ? `${mostAligned.property.title} coincide con más prioridades registradas` : 'Completa tus prioridades para ordenar estas opciones con sentido'}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600">{hasDecisionCriteria ? `Coincide con ${mostAligned.met} de ${mostAligned.summary.requirements.length} criterios visibles y tiene ${mostAligned.pending} dato${mostAligned.pending === 1 ? '' : 's'} pendiente${mostAligned.pending === 1 ? '' : 's'}. Esto no decide por ti: explica por qué aparece primero.` : 'Sin ciudad, presupuesto o necesidades indispensables, AuraSwap no afirma que una propiedad sea mejor. Puedes completar esos datos en Mi Ruta.'}</p>
            </div>
            <button type="button" onClick={() => sendPrompt(`Compara estas propiedades usando mi presupuesto y prioridades guardadas: ${selected.map((property) => property?.title).filter(Boolean).join(', ')}. No elijas por mí: explícame diferencias, riesgos y qué debo confirmar antes de decidir.`)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white hover:bg-indigo-700"><MessageCircle className="h-4 w-4" /> Preguntar a Eterna</button>
          </section>
        )}
        <div className={`grid gap-5 ${selected.length === 1 ? 'lg:grid-cols-1' : selected.length === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
          {selected.map((property) => {
            if (!property) return null;
            const summary = buildDecisionSummary(property, brief, { comparisonCount: selected.length });
            const price = getPropertyPrice(property);
            const costs = estimateOwnershipCost(property);
            return (
              <article key={property.id} className="overflow-hidden rounded-[28px] border border-zinc-200 bg-white shadow-[0_18px_50px_rgba(24,24,27,0.06)]">
                <div className="relative aspect-[16/10] bg-zinc-100">
                  <Image src={property.images?.[0] || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'} alt={`Vista principal de ${property.title}`} fill sizes="(min-width: 1024px) 33vw, 100vw" className="object-cover" unoptimized />
                  <button type="button" onClick={() => toggleComparison(property.id)} className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-900 shadow-lg" aria-label={`Quitar ${property.title} de la comparación`}><X className="h-5 w-5" /></button>
                </div>
                <div className="p-5 sm:p-6">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">{summary.matchLabel}</p>
                  <h2 className="mt-2 text-xl font-black leading-tight text-zinc-950">{property.title}</h2>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-zinc-500"><MapPin className="h-4 w-4" /> {formatPropertyLocation(property.location, property.country)}</p>
                  <p className="mt-4 text-2xl font-black text-zinc-950">{price.amount ? money(price.amount, price.currency) : 'Precio por confirmar'}</p>

                  <div className="mt-5 grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-zinc-50 p-3"><BedDouble className="h-4 w-4 text-zinc-500" /><p className="mt-2 text-sm font-black text-zinc-950">{property.bedrooms || 0}</p><p className="text-xs text-zinc-500">Recámaras</p></div>
                    <div className="rounded-xl bg-zinc-50 p-3"><Bath className="h-4 w-4 text-zinc-500" /><p className="mt-2 text-sm font-black text-zinc-950">{property.bathrooms || 0}</p><p className="text-xs text-zinc-500">Baños</p></div>
                    <div className="rounded-xl bg-zinc-50 p-3"><Car className="h-4 w-4 text-zinc-500" /><p className="mt-2 text-sm font-black text-zinc-950">{property.parkingSpaces || 0}</p><p className="text-xs text-zinc-500">Estac.</p></div>
                  </div>

                  {costs && (
                    <div className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                      <p className="text-xs font-bold text-indigo-700">Costo mensual orientativo</p>
                      <p className="mt-1 text-lg font-black text-zinc-950">{money(costs.estimatedMonthlyTotal, costs.currency)}</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-500">Escenario: 20% de enganche, {costs.termYears} años y tasa ilustrativa de {costs.annualRate}%.</p>
                    </div>
                  )}

                  <div className="mt-5 space-y-2">
                    {summary.requirements.map((requirement) => (
                      <div key={requirement.id} className="flex items-start gap-2 text-sm">
                        {requirement.met ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <X className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                        <span className={requirement.met ? 'text-zinc-700' : 'text-zinc-500'}>{requirement.label}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-5 rounded-2xl border border-zinc-200 p-4">
                    <p className="flex items-center gap-2 text-sm font-black text-zinc-950"><ShieldCheck className="h-4 w-4 text-indigo-600" /> Pendientes por confirmar</p>
                    {summary.missingInformation.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-sm text-zinc-600">{summary.missingInformation.map((item) => <li key={item} className="flex gap-2"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /> {item}</li>)}</ul>
                    ) : <p className="mt-2 text-sm text-emerald-700">No detectamos campos esenciales pendientes.</p>}
                  </div>

                  <Link href={`/property/${property.id}`} className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white hover:bg-indigo-700">Revisar propiedad</Link>
                </div>
              </article>
            );
          })}
        </div>
        </>
      )}
    </div>
  );
}
