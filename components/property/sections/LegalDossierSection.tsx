'use client';

import React from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CircleDashed,
  FileCheck2,
  FileText,
  Landmark,
  ShieldQuestion,
} from 'lucide-react';
import type { Property, PropertyDocument } from '../../../lib/types';
import { PropertySectionCard, PropertySubIcon } from '../PropertySectionCard';

interface LegalDossierSectionProps {
  property: Property;
  language: 'es' | 'en';
}

const hasApprovedDocument = (
  documents: PropertyDocument[] | undefined,
  type: PropertyDocument['documentType'],
) => documents?.some((document) => document.documentType === type && document.status === 'APPROVED') === true;

export const LegalDossierSection: React.FC<LegalDossierSectionProps> = ({
  property,
  language,
}) => {
  const deedEvidence = hasApprovedDocument(property.documents, 'DEED');
  const taxEvidence = hasApprovedDocument(property.documents, 'TAX_RECIPET');
  const dossierReviewed = property.legalDocumentationComplete === true
    && Boolean(property.legalLastUpdate)
    && Boolean(property.legalJuridicalResponsible);
  const hasAnyEvidence = deedEvidence || taxEvidence || dossierReviewed;

  const items = [
    {
      id: 'deed',
      label: language === 'es' ? 'Escritura pública' : 'Public deed',
      icon: FileText,
      value: deedEvidence && property.legalPublicDeed === true
        ? (language === 'es' ? 'Documento revisado' : 'Document reviewed')
        : property.legalPublicDeed === true
          ? (language === 'es' ? 'Escritura declarada' : 'Deed declared')
          : (language === 'es' ? 'Información no proporcionada' : 'Information not provided'),
      verified: deedEvidence && property.legalPublicDeed === true,
      positive: property.legalPublicDeed === true,
    },
    {
      id: 'tax',
      label: language === 'es' ? 'Predial' : 'Property tax',
      icon: Landmark,
      value: taxEvidence && property.legalTaxCurrent === true
        ? (language === 'es' ? 'Comprobante revisado' : 'Receipt reviewed')
        : property.legalTaxCurrent === true
          ? (language === 'es' ? 'Declarado al corriente' : 'Declared up to date')
          : (language === 'es' ? 'Información no proporcionada' : 'Information not provided'),
      verified: taxEvidence && property.legalTaxCurrent === true,
      positive: property.legalTaxCurrent === true,
    },
    {
      id: 'lien',
      label: language === 'es' ? 'Gravamen' : 'Lien status',
      icon: ShieldQuestion,
      value: dossierReviewed && property.legalDebtFree === true
        ? (language === 'es' ? 'Revisión registrada' : 'Review recorded')
        : property.legalDebtFree === true
          ? (language === 'es' ? 'Declarado libre' : 'Declared clear')
          : (language === 'es' ? 'Información no proporcionada' : 'Information not provided'),
      verified: dossierReviewed && property.legalDebtFree === true,
      positive: property.legalDebtFree === true,
    },
    ...(property.legalLastUpdate ? [{
      id: 'updated',
      label: language === 'es' ? 'Última revisión declarada' : 'Declared last review',
      icon: CalendarClock,
      value: property.legalLastUpdate,
      verified: dossierReviewed,
      positive: dossierReviewed,
    }] : []),
  ];

  return (
    <PropertySectionCard
      icon={FileCheck2}
      eyebrow={language === 'es' ? 'Debida diligencia' : 'Due diligence'}
      title={language === 'es' ? 'Situación documental' : 'Document status'}
      description={hasAnyEvidence
        ? (language === 'es'
            ? 'Los documentos revisados se distinguen claramente de la información declarada.'
            : 'Reviewed documents are clearly distinguished from declared information.')
        : (language === 'es'
            ? 'Consulta aquí la situación documental capturada para esta propiedad.'
            : 'Review the document status reported for this property.')}
      action={(
        <span className={`inline-flex self-start items-center gap-1.5 rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${
          hasAnyEvidence
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : 'border-neutral-200 bg-neutral-50 text-neutral-600'
        }`}>
          {hasAnyEvidence ? <FileCheck2 className="h-3 w-3" /> : <CircleDashed className="h-3 w-3" />}
          {hasAnyEvidence
            ? (language === 'es' ? 'Evidencia parcial' : 'Partial evidence')
            : (language === 'es' ? 'Expediente declarado' : 'Declared dossier')}
        </span>
      )}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <article
              key={item.id}
              className="flex min-h-32 flex-col rounded-2xl border border-neutral-200/80 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <PropertySubIcon
                  icon={Icon}
                  className={item.positive
                    ? '!border-emerald-300 !bg-emerald-50/80 !text-emerald-700'
                    : ''}
                />
                <span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase tracking-[0.11em] ${
                  item.verified
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : item.positive
                      ? 'border-emerald-100 bg-emerald-50/50 text-emerald-700'
                      : 'border-neutral-200 bg-neutral-50 text-neutral-500'
                }`}>
                  {item.verified
                    ? (language === 'es' ? 'Con evidencia' : 'Evidence-backed')
                    : item.positive
                      ? (language === 'es' ? 'Declarado' : 'Declared')
                      : (language === 'es' ? 'Pendiente' : 'Pending')}
                </span>
              </div>
              <div className="mt-auto pt-4">
                <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                  {item.label}
                </span>
                <span className="mt-1 block text-xs font-extrabold leading-snug text-neutral-900">
                  {item.value}
                </span>
              </div>
            </article>
          );
        })}
      </div>

      {(property.legalRestrictions || property.legalLienType) && (
        <div className="mt-1 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-800">
              {language === 'es' ? 'Información declarada que requiere revisión' : 'Declared information requiring review'}
            </p>
            <p className="mt-1 text-xs font-semibold leading-relaxed">
              {[property.legalLienType, property.legalRestrictions].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
      )}

      <p className="flex items-start gap-2 border-t border-neutral-100 pt-4 text-[10px] font-semibold leading-relaxed text-neutral-500">
        <ShieldQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {language === 'es'
          ? 'Esta ficha no sustituye la revisión de notaría, Registro Público ni de la institución financiera.'
          : 'This listing does not replace review by a notary, public registry, or financial institution.'}
      </p>
    </PropertySectionCard>
  );
};
