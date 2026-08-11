'use client';

import React from 'react';
import {
  BadgeDollarSign,
  Building2,
  CircleDashed,
  HandCoins,
  Info,
  Landmark,
  WalletCards,
} from 'lucide-react';
import type { Property } from '../../../lib/types';
import { PropertySectionCard, PropertySubIcon } from '../PropertySectionCard';

interface FinancingCompatibilityProps {
  property: Property;
  language: 'es' | 'en';
}

export const FinancingCompatibility: React.FC<FinancingCompatibilityProps> = ({
  property,
  language,
}) => {
  const saleOfferings = (property.offerings || []).filter(
    (offering) => offering.mode === 'SALE' && offering.status === 'ACTIVE' && offering.visibility === 'PUBLIC',
  );

  const declaredMethods = [
    {
      key: 'cash',
      label: language === 'es' ? 'Recursos propios' : 'Cash / own funds',
      icon: HandCoins,
      declared: saleOfferings.some((offering) => offering.acceptsCash === true),
    },
    {
      key: 'bank',
      label: language === 'es' ? 'Crédito bancario' : 'Bank mortgage',
      icon: Building2,
      declared: saleOfferings.some((offering) => offering.acceptsBankCredit === true),
    },
    {
      key: 'infonavit',
      label: 'Infonavit',
      icon: Landmark,
      declared: saleOfferings.some((offering) => offering.acceptsInfonavit === true),
    },
    {
      key: 'fovissste',
      label: 'FOVISSSTE',
      icon: WalletCards,
      declared: saleOfferings.some((offering) => offering.acceptsFovissste === true),
    },
    {
      key: 'developer',
      label: language === 'es' ? 'Financiamiento del desarrollador' : 'Developer financing',
      icon: BadgeDollarSign,
      declared: saleOfferings.some((offering) => offering.developerFinancing === true),
    },
  ].filter((method) => method.declared);

  return (
    <PropertySectionCard
      icon={WalletCards}
      eyebrow={language === 'es' ? 'Adquisición' : 'Acquisition'}
      title={language === 'es' ? 'Métodos de pago declarados' : 'Declared payment methods'}
      description={declaredMethods.length > 0
        ? (language === 'es'
            ? 'El responsable indicó que considera estas opciones; aún requieren validación con la institución correspondiente.'
            : 'The representative stated that these options may be considered; each still requires validation by the relevant institution.')
        : (language === 'es'
            ? 'El anuncio no documenta métodos de pago o financiamiento aceptados.'
            : 'The listing does not document accepted payment or financing methods.')}
      action={(
        <span className="inline-flex self-start items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-amber-800">
          <CircleDashed className="h-3 w-3" />
          {language === 'es' ? 'Por confirmar' : 'To be confirmed'}
        </span>
      )}
    >
      {declaredMethods.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {declaredMethods.map((method) => {
            const Icon = method.icon;
            return (
              <article key={method.key} className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white p-4">
                <PropertySubIcon icon={Icon} />
                <div>
                  <p className="text-xs font-black text-neutral-900">{method.label}</p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.11em] text-neutral-500">
                    {language === 'es' ? 'Declarado por el anunciante' : 'Declared by the listing party'}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50/70 p-5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" />
          <p className="text-xs font-semibold leading-relaxed text-neutral-600">
            {language === 'es'
              ? 'Solicita las condiciones directamente al responsable cuando el anuncio tenga un perfil de contacto validado.'
              : 'Request terms directly from the representative once the listing has a validated contact profile.'}
          </p>
        </div>
      )}

      <p className="flex items-start gap-2 border-t border-neutral-100 pt-4 text-[10px] font-semibold leading-relaxed text-neutral-500">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        {language === 'es'
          ? '“Declarado” no significa aprobado. La elegibilidad depende del inmueble, el expediente y el perfil del comprador.'
          : '“Declared” does not mean approved. Eligibility depends on the property, its documentation, and the buyer profile.'}
      </p>
    </PropertySectionCard>
  );
};
