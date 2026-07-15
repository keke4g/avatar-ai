"use client";

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Calculator, Check, CheckCircle2, ChevronDown, CircleHelp, MessageCircle, Scale, ShieldCheck, X } from 'lucide-react';
import type { Property } from '../../lib/types';
import { buildDecisionSummary, estimateOwnershipCost } from '../../lib/auraswap2/decision';
import { useAuraV2 } from '../../lib/context/AuraV2Context';
import { useLiveContext } from '../../lib/context/LiveContext';

const money = (value: number, currency = 'MXN') => `${currency} $${Math.round(value).toLocaleString('es-MX')}`;

export default function PropertyDecisionSummary({ property }: { property: Property }) {
  const { brief, patchBrief, comparisonIds, toggleComparison, notes, setPropertyNote } = useAuraV2();
  const { sendPrompt } = useLiveContext();
  const [editingBrief, setEditingBrief] = useState(false);
  const [compareNotice, setCompareNotice] = useState('');
  const [showCosts, setShowCosts] = useState(false);
  const [costScenario, setCostScenario] = useState({ downPaymentPercent: 20, annualRate: 10.5, termYears: 20 });

  const decision = useMemo(() => buildDecisionSummary(property, brief, { comparisonCount: comparisonIds.length }), [property, brief, comparisonIds.length]);
  const costs = useMemo(() => estimateOwnershipCost(property, costScenario), [property, costScenario]);
  const isCompared = comparisonIds.includes(property.id);

  const handlePrimary = () => {
    if (decision.nextAction.id === 'COMPLETE_BRIEF') {
      setEditingBrief(true);
      return;
    }
    if (decision.nextAction.id === 'COMPARE') {
      const result = toggleComparison(property.id);
      setCompareNotice(result.reason || (result.added ? 'Propiedad añadida a tu comparación.' : 'Propiedad retirada de la comparación.'));
      return;
    }
    if (decision.nextAction.id === 'CALCULATE') {
      setShowCosts(true);
      return;
    }
    if (decision.nextAction.id === 'VERIFY') {
      sendPrompt(`Ayúdame a confirmar ${decision.missingInformation[0]?.toLowerCase() || 'los datos pendientes'} de esta propiedad. Dime qué está confirmado y qué debe preguntarse al propietario.`);
      return;
    }
    window.dispatchEvent(new CustomEvent('eterna:open-property-contact', { detail: { propertyId: property.id, channel: 'message' } }));
  };

  return (
    <section className="mb-8 overflow-hidden rounded-[28px] border border-zinc-200 bg-[#fbfbfa] shadow-[0_18px_50px_rgba(24,24,27,0.06)]" aria-labelledby="decision-title">
      <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-600">Resumen para decidir</p>
              <h2 id="decision-title" className="mt-1 text-2xl font-black tracking-tight text-zinc-950">{decision.matchLabel}</h2>
            </div>
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 text-xs font-bold text-zinc-700">
              Sin puntuaciones ocultas
              <CircleHelp className="h-4 w-4 text-zinc-400" aria-hidden="true" />
            </span>
          </div>

          {decision.requirements.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {decision.requirements.map((requirement) => (
                <div key={requirement.id} className={`rounded-2xl border p-3.5 ${requirement.met ? 'border-emerald-200 bg-emerald-50/70' : 'border-amber-200 bg-amber-50/70'}`}>
                  <div className="flex items-start gap-2.5">
                    {requirement.met ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />}
                    <div>
                      <p className="text-sm font-bold text-zinc-950">{requirement.label}</p>
                      <p className="mt-1 text-xs leading-relaxed text-zinc-600">{requirement.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <button type="button" onClick={() => setEditingBrief(true)} className="flex min-h-14 w-full items-center justify-between rounded-2xl border border-dashed border-indigo-300 bg-indigo-50/60 px-4 text-left text-sm font-bold text-indigo-800">
              Define ciudad, presupuesto y necesidades para recibir una explicación personalizada.
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </button>
          )}

          {editingBrief && (
            <div className="mt-4 rounded-2xl border border-indigo-200 bg-white p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-zinc-950">Lo que estoy buscando</p>
                  <p className="text-xs text-zinc-500">Puedes corregirlo en cualquier momento.</p>
                </div>
                <button type="button" onClick={() => setEditingBrief(false)} className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200" aria-label="Cerrar editor de prioridades"><X className="h-4 w-4" /></button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-bold text-zinc-800">Ciudad
                  <input value={brief.city} onChange={(event) => patchBrief({ city: event.target.value })} placeholder="Ej. Guadalajara" className="mt-1.5 min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base font-medium outline-none focus:border-indigo-500" />
                </label>
                <label className="text-sm font-bold text-zinc-800">Presupuesto máximo
                  <input type="number" inputMode="numeric" value={brief.budget ?? ''} onChange={(event) => patchBrief({ budget: event.target.value ? Number(event.target.value) : null })} placeholder="Ej. 2000000" className="mt-1.5 min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base font-medium outline-none focus:border-indigo-500" />
                </label>
                <label className="text-sm font-bold text-zinc-800">Recámaras mínimas
                  <input type="number" min="0" value={brief.bedrooms ?? ''} onChange={(event) => patchBrief({ bedrooms: event.target.value ? Number(event.target.value) : null })} placeholder="Ej. 2" className="mt-1.5 min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base font-medium outline-none focus:border-indigo-500" />
                </label>
                <label className="text-sm font-bold text-zinc-800">Estacionamiento
                  <select value={brief.needsParking === null ? '' : brief.needsParking ? 'yes' : 'no'} onChange={(event) => patchBrief({ needsParking: event.target.value === '' ? null : event.target.value === 'yes' })} className="mt-1.5 min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-base font-medium outline-none focus:border-indigo-500">
                    <option value="">Aún no lo decido</option><option value="yes">Es indispensable</option><option value="no">No es indispensable</option>
                  </select>
                </label>
              </div>
              <button type="button" onClick={() => setEditingBrief(false)} className="mt-4 min-h-12 w-full rounded-xl bg-zinc-950 px-4 text-sm font-bold text-white">Guardar prioridades</button>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
            <button type="button" onClick={handlePrimary} className="aura-primary-action flex min-h-14 items-center justify-between rounded-2xl bg-zinc-950 px-5 text-left text-sm font-bold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <span><span className="block">{decision.nextAction.label}</span><span className="mt-0.5 block text-xs font-medium text-white/65">{decision.nextAction.reason}</span></span>
              <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
            </button>
            <button type="button" onClick={() => {
              const result = toggleComparison(property.id);
              setCompareNotice(result.reason || (result.added ? 'Añadida a comparación.' : 'Retirada de comparación.'));
            }} className={`flex min-h-14 items-center justify-center gap-2 rounded-2xl border px-5 text-sm font-bold ${isCompared ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-zinc-300 bg-white text-zinc-800'}`}>
              <Scale className="h-5 w-5" aria-hidden="true" /> {isCompared ? 'En comparación' : 'Comparar'}
            </button>
          </div>
          {compareNotice && <p className="mt-2 text-sm font-medium text-indigo-700" role="status">{compareNotice}</p>}
        </div>

        <aside className="border-t border-zinc-200 bg-white p-5 sm:p-7 lg:border-l lg:border-t-0">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-indigo-600" aria-hidden="true" />
            <h3 className="text-base font-black text-zinc-950">Qué sabemos realmente</h3>
          </div>
          <div className="space-y-3">
            {decision.verification.map((item) => (
              <div key={item.label} className="flex items-start gap-3 rounded-2xl border border-zinc-200 p-3.5">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${item.status === 'verified' ? 'bg-emerald-100 text-emerald-700' : item.status === 'declared' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                  {item.status === 'verified' ? <Check className="h-3.5 w-3.5" /> : item.status === 'declared' ? <MessageCircle className="h-3.5 w-3.5" /> : <CircleHelp className="h-3.5 w-3.5" />}
                </span>
                <div><p className="text-sm font-bold text-zinc-950">{item.label}</p><p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{item.detail}</p></div>
              </div>
            ))}
          </div>

          {costs && (
            <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50">
              <button type="button" onClick={() => setShowCosts((current) => !current)} className="flex min-h-14 w-full items-center justify-between px-4 text-left">
                <span className="flex items-center gap-2 text-sm font-black text-zinc-950"><Calculator className="h-4 w-4 text-indigo-600" /> Costo orientativo</span>
                <ChevronDown className={`h-4 w-4 transition ${showCosts ? 'rotate-180' : ''}`} />
              </button>
              {showCosts && (
                <div className="border-t border-zinc-200 bg-white p-4">
                  <div className="mb-4 grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-bold text-zinc-600">Enganche
                      <select value={costScenario.downPaymentPercent} onChange={(event) => setCostScenario((current) => ({ ...current, downPaymentPercent: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2 text-sm font-bold"><option value="10">10%</option><option value="20">20%</option><option value="30">30%</option><option value="40">40%</option></select>
                    </label>
                    <label className="text-xs font-bold text-zinc-600">Plazo
                      <select value={costScenario.termYears} onChange={(event) => setCostScenario((current) => ({ ...current, termYears: Number(event.target.value) }))} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2 text-sm font-bold"><option value="10">10 años</option><option value="15">15 años</option><option value="20">20 años</option><option value="25">25 años</option></select>
                    </label>
                    <label className="text-xs font-bold text-zinc-600">Tasa anual
                      <input type="number" min="0" max="30" step="0.1" value={costScenario.annualRate} onChange={(event) => setCostScenario((current) => ({ ...current, annualRate: Number(event.target.value) || 0 }))} className="mt-1 min-h-11 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-sm font-bold" />
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><p className="text-xs text-zinc-500">Enganche estimado</p><p className="mt-1 text-sm font-black text-zinc-950">{money(costs.downPayment, costs.currency)}</p></div>
                    <div><p className="text-xs text-zinc-500">Mensualidad + mantenimiento</p><p className="mt-1 text-sm font-black text-zinc-950">{money(costs.estimatedMonthlyTotal, costs.currency)}</p></div>
                    <div><p className="text-xs text-zinc-500">Cierre estimado</p><p className="mt-1 text-sm font-black text-zinc-950">{money(costs.estimatedClosingCosts, costs.currency)}</p></div>
                    <div><p className="text-xs text-zinc-500">Escenario</p><p className="mt-1 text-sm font-black text-zinc-950">{costs.termYears} años · {costs.annualRate}%</p></div>
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-zinc-500">Estimación informativa. No constituye una oferta de crédito ni sustituye una cotización bancaria o notarial.</p>
                </div>
              )}
            </div>
          )}

          <label className="mt-5 block text-sm font-bold text-zinc-800">Mi nota privada
            <textarea value={notes[property.id] || ''} onChange={(event) => setPropertyNote(property.id, event.target.value)} placeholder="Lo que me gustó, dudas para la visita…" className="mt-2 min-h-24 w-full resize-y rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm font-medium outline-none focus:border-indigo-500" />
          </label>
          {comparisonIds.length > 0 && <Link href="/compare" className="mt-3 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-zinc-300 bg-white text-sm font-bold text-zinc-900 hover:border-indigo-500">Ver comparación ({comparisonIds.length}) <ArrowRight className="h-4 w-4" /></Link>}
        </aside>
      </div>
    </section>
  );
}
