"use client";

import Link from 'next/link';
import { ArrowRight, Bell, Check, CircleHelp, Clock3, FolderHeart, MessageCircle, RotateCcw, Scale, Search, ShieldCheck, Trash2 } from 'lucide-react';
import JourneyProgress from '../../components/v2/JourneyProgress';
import { useAuraV2 } from '../../lib/context/AuraV2Context';
import { useSwap } from '../../lib/context/SwapContext';

const STATUS_LABELS = {
  sent: 'Enviada', seen: 'Vista', responded: 'Respondida', visit_proposed: 'Visita propuesta', visit_confirmed: 'Visita confirmada', closed: 'Cerrada',
};

export default function DecisionFolderPage() {
  const { brief, patchBrief, resetBrief, comparisonIds, notes, contacts, alerts, removeAlert } = useAuraV2();
  const { properties, favorites } = useSwap();
  const compared = properties.filter((property) => comparisonIds.includes(property.id));
  const saved = properties.filter((property) => favorites.includes(property.id));
  const pendingNotes = Object.values(notes).filter((note) => note.trim()).length;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-8">
      <JourneyProgress />
      <header className="mb-8 mt-10 max-w-3xl">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Carpeta de decisión</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-zinc-950 sm:text-5xl">Todo lo necesario para decidir, en un solo lugar.</h1>
        <p className="mt-3 text-base leading-relaxed text-zinc-600">Tus prioridades, propiedades, dudas y solicitudes permanecen conectadas. Eterna usa este resumen para no volver a preguntarte lo mismo.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className="rounded-[28px] border border-zinc-200 bg-white p-5 shadow-[0_16px_40px_rgba(24,24,27,0.05)] sm:p-7">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">Lo que busco</p><h2 className="mt-1 text-xl font-black text-zinc-950">Resumen editable</h2></div>
            <button type="button" onClick={() => { if (window.confirm('¿Borrar las prioridades que Eterna recuerda para esta búsqueda?')) resetBrief(); }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-200 px-3 text-xs font-bold text-zinc-600 hover:border-rose-300 hover:text-rose-700"><RotateCcw className="h-4 w-4" /> Borrar memoria</button>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-bold text-zinc-800">Objetivo
              <select value={brief.goal || ''} onChange={(event) => patchBrief({ goal: (event.target.value || null) as typeof brief.goal })} className="mt-1.5 min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base font-medium"><option value="">Seleccionar</option><option value="BUY">Comprar</option><option value="RENT">Rentar</option><option value="INVEST">Invertir</option><option value="SELL">Vender</option><option value="SWAP">Intercambiar</option></select>
            </label>
            <label className="text-sm font-bold text-zinc-800">Ciudad
              <input value={brief.city} onChange={(event) => patchBrief({ city: event.target.value })} className="mt-1.5 min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base font-medium" placeholder="Ej. Guadalajara" />
            </label>
            <label className="text-sm font-bold text-zinc-800">Presupuesto máximo
              <input type="number" inputMode="numeric" value={brief.budget ?? ''} onChange={(event) => patchBrief({ budget: event.target.value ? Number(event.target.value) : null })} className="mt-1.5 min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base font-medium" placeholder="Ej. 2000000" />
            </label>
            <label className="text-sm font-bold text-zinc-800">Recámaras mínimas
              <input type="number" min="0" value={brief.bedrooms ?? ''} onChange={(event) => patchBrief({ bedrooms: event.target.value ? Number(event.target.value) : null })} className="mt-1.5 min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base font-medium" placeholder="Ej. 2" />
            </label>
            <label className="text-sm font-bold text-zinc-800">Estacionamiento
              <select value={brief.needsParking === null ? '' : brief.needsParking ? 'yes' : 'no'} onChange={(event) => patchBrief({ needsParking: event.target.value === '' ? null : event.target.value === 'yes' })} className="mt-1.5 min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base font-medium"><option value="">Aún no lo decido</option><option value="yes">Es indispensable</option><option value="no">No es indispensable</option></select>
            </label>
            <label className="text-sm font-bold text-zinc-800">Forma de pago
              <select value={brief.financing || ''} onChange={(event) => patchBrief({ financing: (event.target.value || null) as typeof brief.financing })} className="mt-1.5 min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base font-medium"><option value="">Aún no lo decido</option><option value="BANK">Crédito bancario</option><option value="INFONAVIT">Infonavit</option><option value="FOVISSSTE">Fovissste</option><option value="CASH">Recursos propios</option><option value="UNDECIDED">Quiero orientación</option></select>
            </label>
            <label className="text-sm font-bold text-zinc-800 sm:col-span-2">Indispensables
              <input value={brief.mustHaves.join(', ')} onChange={(event) => patchBrief({ mustHaves: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} className="mt-1.5 min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base font-medium" placeholder="Ej. elevador, terraza, acepta mascotas" />
              <span className="mt-1 block text-xs font-medium text-zinc-500">Separa cada necesidad con una coma.</span>
            </label>
            <label className="text-sm font-bold text-zinc-800 sm:col-span-2">Cuándo quieres decidir
              <input value={brief.timeline} onChange={(event) => patchBrief({ timeline: event.target.value })} className="mt-1.5 min-h-12 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 text-base font-medium" placeholder="Ej. En los próximos 3 meses" />
            </label>
          </div>
          <p className="mt-4 rounded-xl bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-800">Eterna solo debe usar estos datos para la búsqueda actual. Puedes corregirlos o eliminarlos cuando quieras.</p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Link href="/compare" className="group rounded-[24px] border border-zinc-200 bg-zinc-950 p-5 text-white shadow-[0_16px_40px_rgba(24,24,27,0.12)] transition hover:-translate-y-1">
            <Scale className="h-6 w-6 text-indigo-300" /><p className="mt-6 text-3xl font-black">{compared.length}</p><h2 className="mt-1 text-base font-bold">En comparación</h2><p className="mt-2 text-sm leading-relaxed text-white/60">Precio, costo mensual, prioridades y datos pendientes.</p><span className="mt-5 flex items-center gap-2 text-sm font-bold text-indigo-200">Abrir comparación <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
          </Link>
          <Link href="/dashboard?tab=favorites" className="group rounded-[24px] border border-zinc-200 bg-white p-5 transition hover:-translate-y-1 hover:shadow-lg">
            <FolderHeart className="h-6 w-6 text-rose-500" /><p className="mt-6 text-3xl font-black text-zinc-950">{saved.length}</p><h2 className="mt-1 text-base font-bold text-zinc-950">Propiedades guardadas</h2><p className="mt-2 text-sm leading-relaxed text-zinc-500">Tu lista corta para revisar después.</p><span className="mt-5 flex items-center gap-2 text-sm font-bold text-indigo-700">Ver guardadas <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
          </Link>
          <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
            <CircleHelp className="h-6 w-6 text-amber-600" /><p className="mt-6 text-3xl font-black text-zinc-950">{pendingNotes}</p><h2 className="mt-1 text-base font-bold text-zinc-950">Notas privadas</h2><p className="mt-2 text-sm leading-relaxed text-zinc-500">Dudas y observaciones guardadas en las propiedades.</p>
          </div>
          <div className="rounded-[24px] border border-zinc-200 bg-white p-5">
            <Bell className="h-6 w-6 text-emerald-600" /><p className="mt-6 text-3xl font-black text-zinc-950">{alerts.length}</p><h2 className="mt-1 text-base font-bold text-zinc-950">Alertas activas</h2><p className="mt-2 text-sm leading-relaxed text-zinc-500">Búsquedas que quieres revisar cuando cambien precio o disponibilidad.</p>
          </div>
        </section>
      </div>

      <section className="mt-7 rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-600">Seguimiento</p><h2 className="mt-1 text-xl font-black text-zinc-950">Mis solicitudes</h2></div>
          <Link href="/explore" className="flex min-h-11 items-center gap-2 rounded-full border border-zinc-200 px-4 text-sm font-bold text-zinc-800"><Search className="h-4 w-4" /> Explorar</Link>
        </div>
        {contacts.length === 0 ? (
          <div className="mt-5 rounded-2xl bg-zinc-50 p-6 text-center"><MessageCircle className="mx-auto h-8 w-8 text-zinc-400" /><p className="mt-3 text-sm font-bold text-zinc-900">Aún no has enviado solicitudes desde AuraSwap 2</p><p className="mt-1 text-sm text-zinc-500">Cuando contactes o solicites una visita, podrás seguir su estado aquí.</p></div>
        ) : (
          <div className="mt-5 divide-y divide-zinc-100">
            {contacts.map((contact) => (
              <div key={contact.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div><p className="text-sm font-black text-zinc-950">{contact.propertyTitle}</p><p className="mt-1 flex items-center gap-2 text-xs text-zinc-500"><Clock3 className="h-4 w-4" /> {contact.channel === 'visit' ? 'Visita' : contact.channel === 'call' ? 'Llamada' : contact.channel === 'whatsapp' ? 'WhatsApp' : 'Mensaje'} · {new Date(contact.createdAt).toLocaleString('es-MX')}</p></div>
                <span className="inline-flex min-h-9 items-center gap-2 self-start rounded-full bg-indigo-50 px-3 text-xs font-bold text-indigo-700 sm:self-auto"><Check className="h-4 w-4" /> {STATUS_LABELS[contact.status]}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {alerts.length > 0 && (
        <section className="mt-7 rounded-[28px] border border-zinc-200 bg-white p-5 sm:p-7">
          <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">Alertas guardadas</p><h2 className="mt-1 text-xl font-black text-zinc-950">Búsquedas que seguimos contigo</h2></div>
          <div className="mt-5 divide-y divide-zinc-100">
            {alerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between gap-4 py-4">
                <div><p className="text-sm font-black text-zinc-950">{alert.label}</p><p className="mt-1 text-xs text-zinc-500">Creada {new Date(alert.createdAt).toLocaleDateString('es-MX')}</p></div>
                <button type="button" onClick={() => removeAlert(alert.id)} aria-label={`Eliminar alerta ${alert.label}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition hover:border-rose-300 hover:text-rose-600"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-7 rounded-[28px] border border-emerald-200 bg-emerald-50/70 p-5 sm:p-7">
        <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-emerald-700" /><div><h2 className="text-base font-black text-emerald-950">Tu decisión sigue siendo tuya</h2><p className="mt-1 text-sm leading-relaxed text-emerald-900/75">Las estimaciones y explicaciones de Eterna son informativas. Los documentos legales, disponibilidad y financiamiento deben confirmarse con las personas e instituciones responsables.</p></div></div>
      </section>
    </div>
  );
}
