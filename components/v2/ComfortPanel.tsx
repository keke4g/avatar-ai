"use client";

import { useEffect, useRef, useState } from 'react';
import { Accessibility, Check, Eye, Minus, Pause, Plus, Type, X } from 'lucide-react';
import { useAuraV2 } from '../../lib/context/AuraV2Context';

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left transition hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      <span>
        <span className="block text-sm font-bold text-zinc-950">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{description}</span>
      </span>
      <span className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition ${checked ? 'justify-end bg-indigo-600' : 'justify-start bg-zinc-200'}`}>
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white shadow-sm">
          {checked && <Check className="h-3 w-3 text-indigo-600" aria-hidden="true" />}
        </span>
      </span>
    </button>
  );
}

export default function ComfortPanel() {
  const { comfort, updateComfort } = useAuraV2();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === 'Tab' && panelRef.current) {
        const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute('disabled'));
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    panelRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-[75] flex min-h-12 items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 text-sm font-bold text-zinc-900 shadow-[0_12px_36px_rgba(24,24,27,0.12)] transition hover:-translate-y-0.5 hover:border-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label="Abrir opciones de comodidad y accesibilidad"
      >
        <Accessibility className="h-5 w-5 text-indigo-600" aria-hidden="true" />
        <span className="hidden sm:inline">Comodidad</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-end justify-start bg-black/25 p-3 backdrop-blur-sm sm:items-center sm:justify-center" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}>
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="comfort-title"
            className="max-h-[90vh] w-full overflow-y-auto rounded-[28px] border border-zinc-200 bg-[#fbfbfa] p-5 shadow-2xl sm:max-w-lg sm:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <span className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                  <Eye className="h-4 w-4" aria-hidden="true" /> Preferencias personales
                </span>
                <h2 id="comfort-title" className="text-2xl font-black tracking-tight text-zinc-950">Haz AuraSwap cómodo para ti</h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">Estas opciones se guardan en este dispositivo. No intentamos deducir tu edad ni tus capacidades.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-100" aria-label="Cerrar opciones de comodidad">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mb-4 rounded-2xl border border-zinc-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-950">
                <Type className="h-4 w-4 text-indigo-600" aria-hidden="true" /> Tamaño del texto
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => updateComfort({ textSize: 'normal' })} className={`min-h-12 rounded-xl border px-3 text-sm font-bold ${comfort.textSize === 'normal' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-zinc-200 text-zinc-700'}`}>
                  <Minus className="mr-1 inline h-4 w-4" aria-hidden="true" /> Normal
                </button>
                <button type="button" onClick={() => updateComfort({ textSize: 'large' })} className={`min-h-12 rounded-xl border px-3 text-base font-bold ${comfort.textSize === 'large' ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-zinc-200 text-zinc-700'}`}>
                  <Plus className="mr-1 inline h-4 w-4" aria-hidden="true" /> Grande
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <ToggleRow label="Vista sencilla" description="Reduce contenido secundario y destaca una acción por vez." checked={comfort.simpleView} onChange={() => updateComfort({ simpleView: !comfort.simpleView })} />
              <ToggleRow label="Alto contraste" description="Aumenta la separación visual de textos, bordes y controles." checked={comfort.highContrast} onChange={() => updateComfort({ highContrast: !comfort.highContrast })} />
              <ToggleRow label="Reducir movimiento" description="Detiene animaciones decorativas y transiciones intensas." checked={comfort.reducedMotion} onChange={() => updateComfort({ reducedMotion: !comfort.reducedMotion })} />
              <ToggleRow label="Subtítulos de Eterna" description="Mantiene visible el texto de todo lo que Eterna dice." checked={comfort.voiceCaptions} onChange={() => updateComfort({ voiceCaptions: !comfort.voiceCaptions })} />
            </div>

            <button type="button" onClick={() => setOpen(false)} className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 px-5 text-sm font-bold text-white hover:bg-zinc-800">
              <Pause className="h-4 w-4" aria-hidden="true" /> Guardar y continuar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
