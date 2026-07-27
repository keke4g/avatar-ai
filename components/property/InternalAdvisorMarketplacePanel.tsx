"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Copy,
  ExternalLink,
  LockKeyhole,
  MapPin,
  Percent,
} from 'lucide-react';
import { useSwap } from '../../lib/context/SwapContext';
import {
  getInternalPropertyMarketplaceDossier,
  InternalPropertyMarketplaceDossier,
} from '../../lib/services/InternalPropertyDossierService';
import { Property } from '../../lib/types';

interface InternalAdvisorMarketplacePanelProps {
  property: Property;
  language: string;
}

interface MarketplaceField {
  id: string;
  label: string;
  value: string;
  multiline?: boolean;
}

const STAFF_ROLES = new Set(['ADMIN', 'INTERNAL_ADVISOR']);

const dedupeAddressParts = (address: string): string => {
  const seen = new Set<string>();
  return address
    .split(',')
    .map((part) => part.trim())
    .filter((part) => {
      if (!part) return false;
      const key = part
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('es-MX');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(', ');
};

const formatPercent = (value: number | null): string => {
  if (value === null) return 'No definido';
  return `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(value)}%`;
};

const fallbackCopy = (text: string): boolean => {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);
  return copied;
};

export default function InternalAdvisorMarketplacePanel({
  property,
  language,
}: InternalAdvisorMarketplacePanelProps) {
  const { currentUser } = useSwap();
  const [dossier, setDossier] = useState<InternalPropertyMarketplaceDossier | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const isSpanish = language === 'es';
  const isStaff = Boolean(currentUser?.role && STAFF_ROLES.has(currentUser.role));

  useEffect(() => {
    let cancelled = false;

    if (!isStaff) {
      setDossier(null);
      return;
    }

    setLoading(true);
    getInternalPropertyMarketplaceDossier(property.id)
      .then((result) => {
        if (!cancelled) setDossier(result);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isStaff, property.id]);

  const fields = useMemo<MarketplaceField[]>(() => {
    if (!dossier) return [];

    const fullBathrooms = Number(property.bathrooms) || 0;
    const halfBathrooms = Number(property.halfBathrooms) || 0;
    const bathrooms = fullBathrooms + (halfBathrooms * 0.5);
    const squareMeters = Number(property.surfaceBuilt) > 0
      ? Number(property.surfaceBuilt)
      : Number(property.surfaceTotal) > 0
        ? Number(property.surfaceTotal)
        : 0;
    const exactAddress = dedupeAddressParts(
      dossier.exactAddress
      || property.formattedAddress
      || [
        property.address,
        property.neighborhood,
        property.location,
        property.country,
      ].filter(Boolean).join(', '),
    );
    const amenities = (property.amenities || []).filter(Boolean);
    const descriptionParts = [
      property.title,
      property.description?.trim(),
      `${Number(property.bedrooms) || 0} recámaras · ${bathrooms} baños${Number(property.parkingSpaces) >= 0 ? ` · ${Number(property.parkingSpaces) || 0} estacionamientos` : ''}`,
      squareMeters > 0 ? `${squareMeters} m²` : '',
      amenities.length > 0 ? `Amenidades: ${amenities.join(', ')}.` : '',
      property.internalCode ? `Folio AuraSwap: ${property.internalCode}` : '',
    ].filter(Boolean);

    return [
      {
        id: 'bedrooms',
        label: isSpanish ? 'Número de habitaciones' : 'Number of bedrooms',
        value: String(Number(property.bedrooms) || 0),
      },
      {
        id: 'bathrooms',
        label: isSpanish ? 'Número de baños' : 'Number of bathrooms',
        value: String(bathrooms),
      },
      {
        id: 'price',
        label: isSpanish ? 'Precio' : 'Price',
        value: dossier.capturedPriceAmount === null
          ? ''
          : String(Math.round(dossier.capturedPriceAmount)),
      },
      {
        id: 'address',
        label: isSpanish ? 'Dirección' : 'Address',
        value: exactAddress,
      },
      {
        id: 'squareMeters',
        label: isSpanish ? 'Metros cuadrados' : 'Square meters',
        value: squareMeters > 0 ? String(squareMeters) : '',
      },
      {
        id: 'description',
        label: isSpanish ? 'Descripción de la propiedad' : 'Property description',
        value: descriptionParts.join('\n\n'),
        multiline: true,
      },
    ];
  }, [dossier, isSpanish, property]);

  const copyField = async (fieldId: string, value: string) => {
    if (!value) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else if (!fallbackCopy(value)) {
        throw new Error('Clipboard unavailable');
      }
      setCopiedField(fieldId);
      window.setTimeout(() => setCopiedField((current) => current === fieldId ? null : current), 1800);
    } catch {
      if (fallbackCopy(value)) {
        setCopiedField(fieldId);
        window.setTimeout(() => setCopiedField((current) => current === fieldId ? null : current), 1800);
      }
    }
  };

  if (!isStaff) return null;

  if (loading) {
    return (
      <section aria-label="Cargando herramientas internas" className="overflow-hidden rounded-[28px] border border-slate-200 bg-slate-950 p-5 shadow-[0_24px_60px_-38px_rgba(15,23,42,0.7)] sm:p-6">
        <div className="h-4 w-44 animate-pulse rounded-full bg-white/15" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.07]" />
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.07]" />
        </div>
      </section>
    );
  }

  if (!dossier) return null;

  const priceLabel = dossier.capturedPriceAmount === null
    ? (isSpanish ? 'No definido' : 'Not set')
    : new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: dossier.currency || 'MXN',
        maximumFractionDigits: 0,
      }).format(dossier.capturedPriceAmount);

  return (
    <section
      data-eterna-section="internal-marketplace"
      className="relative overflow-hidden rounded-[28px] border border-slate-800 bg-slate-950 text-white shadow-[0_30px_80px_-48px_rgba(15,23,42,0.95)]"
    >
      <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-violet-500/15 blur-3xl" />

      <div className="relative border-b border-white/10 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/25 bg-violet-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-violet-200">
              <LockKeyhole className="h-3 w-3" aria-hidden="true" />
              {isSpanish ? 'Solo equipo interno' : 'Internal staff only'}
            </span>
            <h3 className="mt-3 text-xl font-black tracking-[-0.03em] text-white">
              {isSpanish ? 'Ficha de captación y Marketplace' : 'Acquisition & Marketplace kit'}
            </h3>
            <p className="mt-1 max-w-xl text-xs font-medium leading-relaxed text-slate-400">
              {isSpanish
                ? 'Datos comerciales privados y textos listos para publicar sin volver a capturar la propiedad.'
                : 'Private commercial data and copy-ready Marketplace fields.'}
            </p>
          </div>

          <a
            href="https://www.facebook.com/marketplace/create/sale"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-white px-4 text-xs font-black text-slate-950 transition hover:bg-violet-100 active:scale-[0.98]"
          >
            {isSpanish ? 'Ir a Marketplace' : 'Open Marketplace'}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
            <dt className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
              <Building2 className="h-3.5 w-3.5 text-violet-300" aria-hidden="true" />
              {isSpanish ? 'Precio de captación' : 'Captured price'}
            </dt>
            <dd className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">{priceLabel}</dd>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
            <dt className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">
              <Percent className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
              {isSpanish ? 'Comisión compartida' : 'Shared commission'}
            </dt>
            <dd className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">
              {formatPercent(dossier.commissionSharedPct)}
            </dd>
          </div>
        </dl>
      </div>

      <div className="relative px-5 py-5 sm:px-7 sm:py-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black text-white">
              {isSpanish ? 'Campos para Facebook Marketplace' : 'Facebook Marketplace fields'}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-slate-500">
              {isSpanish ? 'Copia cada valor y pégalo en el campo correspondiente.' : 'Copy each value into its matching field.'}
            </p>
          </div>
          <MapPin className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {fields.map((field) => (
            <article
              key={field.id}
              className={`flex min-w-0 flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-3.5 ${field.multiline ? 'sm:col-span-2' : ''}`}
            >
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                {field.label}
              </span>
              <p className={`mt-2 min-h-5 break-words text-xs font-semibold leading-relaxed text-slate-200 ${field.multiline ? 'max-h-36 overflow-y-auto whitespace-pre-line pr-2' : 'line-clamp-2'}`}>
                {field.value || (isSpanish ? 'Sin dato' : 'No data')}
              </p>
              <button
                type="button"
                disabled={!field.value}
                onClick={() => copyField(field.id, field.value)}
                className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.07] px-3 text-[10px] font-black text-white transition hover:border-violet-300/35 hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-35 sm:ml-auto sm:w-fit"
              >
                {copiedField === field.id ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-300" aria-hidden="true" />
                    {isSpanish ? 'Copiado' : 'Copied'}
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    {isSpanish ? 'Copiar' : 'Copy'}
                  </>
                )}
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
