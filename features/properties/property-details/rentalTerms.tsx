import { memo, type ComponentType } from 'react';
import {
  Banknote,
  CalendarDays,
  PawPrint,
  ScrollText,
  Sofa,
  Timer,
  UserCheck,
  Wifi,
  Wrench,
} from 'lucide-react';
import type { LanguageType } from '@/lib/context/LanguageContext';
import { calculateRentalSigningCosts } from '@/lib/rentalTerms';
import type { Property, PropertyOffering } from '@/lib/types';

const RENTAL_TERM_TONES = {
  confirmed: {
    shell: 'border-emerald-200 bg-emerald-50/60',
    icon: 'bg-emerald-100 text-emerald-700',
    value: 'text-emerald-800',
  },
  required: {
    shell: 'border-amber-200 bg-amber-50/65',
    icon: 'bg-amber-100 text-amber-700',
    value: 'text-amber-800',
  },
  neutral: {
    shell: 'border-slate-200 bg-white',
    icon: 'bg-slate-100 text-slate-700',
    value: 'text-slate-950',
  },
  pending: {
    shell: 'border-dashed border-slate-300 bg-slate-50/70',
    icon: 'bg-white text-slate-400 ring-1 ring-slate-200',
    value: 'text-slate-500',
  },
} as const;

type RentalTermTone = keyof typeof RENTAL_TERM_TONES;

export interface RentalTermItem {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone: RentalTermTone;
}

export interface RentalTermsModel {
  rentAmountDueAtSigning: number | null;
  rentCurrency: string;
  rentMonthsDueAtSigning: number;
  rentSecurityDeposit: number | null;
  rentTotalDueAtSigning: number | null;
  rentalTermItems: RentalTermItem[];
}

interface RentalTermCollectionProps {
  items: RentalTermItem[];
}

type RentalTermCardProps = RentalTermItem;

export function formatRentalMoney(amount: number, currency: string): string {
  return `$${amount.toLocaleString()} ${currency}`;
}

export function buildRentalTerms(
  property: Property | undefined,
  activeRentOffering: PropertyOffering | null,
  language: LanguageType,
): RentalTermsModel {
  const rentalFurnishingStatus = (
    property?.metadata?.rentalFurnishingStatus
    || activeRentOffering?.metadata?.rentalFurnishingStatus
  ) as 'UNFURNISHED' | 'SEMI_FURNISHED' | 'FURNISHED' | undefined;
  const includedRentalServicesValue =
    property?.metadata?.includedRentalServices
    || activeRentOffering?.metadata?.includedRentalServices;
  const includedRentalServices = Array.isArray(includedRentalServicesValue)
    ? includedRentalServicesValue.filter((service): service is string => typeof service === 'string')
    : [];
  const hasLegacyIncludedServices = property?.metadata?.includesServices === true;
  const rentRequiresGuarantor = typeof activeRentOffering?.metadata?.requiresGuarantor === 'boolean'
    ? activeRentOffering.metadata.requiresGuarantor
    : activeRentOffering?.requiresGuarantor;
  const rentRequiresLegalPolicy = typeof activeRentOffering?.metadata?.requiresLegalPolicy === 'boolean'
    ? activeRentOffering.metadata.requiresLegalPolicy
    : activeRentOffering?.requiresLegalPolicy;
  const acceptsPets =
    activeRentOffering?.metadata?.acceptsPets
    ?? property?.metadata?.acceptsPets
    ?? property?.metadata?.petsAllowed;
  const includesMaintenance =
    activeRentOffering?.metadata?.includesMaintenance
    ?? property?.metadata?.includesMaintenance
    ?? property?.metadata?.maintenanceFeeIncluded;
  const rentSecurityDeposit =
    activeRentOffering?.securityDepositAmount
    ?? activeRentOffering?.depositAmount
    ?? null;
  const rentCurrency = activeRentOffering?.currency || 'MXN';
  const rentalSigningCosts = calculateRentalSigningCosts({
    monthlyRent: activeRentOffering?.priceAmount,
    advanceMonths: activeRentOffering?.advanceMonths,
    securityDeposit: rentSecurityDeposit,
  });
  const rentMonthsDueAtSigning = rentalSigningCosts.monthsDueAtSigning;
  const rentalServicesLabel = includedRentalServices.length > 0
    ? includedRentalServices.map((service) => {
        if (service === 'WATER') return language === 'es' ? 'Agua' : 'Water';
        if (service === 'ELECTRICITY') return language === 'es' ? 'Luz' : 'Electricity';
        if (service === 'INTERNET') return 'Internet';
        return service;
      }).join(', ')
    : hasLegacyIncludedServices
      ? (language === 'es' ? 'Agua, luz e internet' : 'Water, electricity and internet')
      : (language === 'es' ? 'Ninguno declarado' : 'None declared');
  const rentalFurnishingLabel = rentalFurnishingStatus === 'SEMI_FURNISHED'
    ? (language === 'es' ? 'Semi-amueblado' : 'Semi-furnished')
    : rentalFurnishingStatus === 'FURNISHED' || property?.metadata?.isFurnished === true
      ? (language === 'es' ? 'Amueblado' : 'Furnished')
      : rentalFurnishingStatus === 'UNFURNISHED' || property?.metadata?.isFurnished === false
        ? (language === 'es' ? 'Sin amueblar' : 'Unfurnished')
        : (language === 'es' ? 'Por confirmar' : 'To be confirmed');

  const rentalTermItems: RentalTermItem[] = activeRentOffering ? [
    {
      icon: Banknote,
      label: language === 'es' ? 'Depósito de garantía' : 'Security deposit',
      value: rentSecurityDeposit != null
        ? formatRentalMoney(rentSecurityDeposit, rentCurrency)
        : (language === 'es' ? 'Por confirmar' : 'To be confirmed'),
      tone: rentSecurityDeposit != null ? 'confirmed' : 'pending',
    },
    {
      icon: CalendarDays,
      label: language === 'es' ? 'Renta adelantada' : 'Rent in advance',
      value: `${rentMonthsDueAtSigning} ${rentMonthsDueAtSigning === 1
        ? (language === 'es' ? 'mes' : 'month')
        : (language === 'es' ? 'meses' : 'months')}`,
      tone: 'neutral',
    },
    {
      icon: UserCheck,
      label: language === 'es' ? 'Aval u obligado solidario' : 'Guarantor / co-signer',
      value: rentRequiresGuarantor === true
        ? (language === 'es' ? 'Requerido' : 'Required')
        : rentRequiresGuarantor === false
          ? (language === 'es' ? 'No requerido' : 'Not required')
          : (language === 'es' ? 'Por confirmar' : 'To be confirmed'),
      tone: rentRequiresGuarantor === true ? 'required' : rentRequiresGuarantor === false ? 'confirmed' : 'pending',
    },
    {
      icon: ScrollText,
      label: language === 'es' ? 'Póliza jurídica' : 'Legal lease policy',
      value: rentRequiresLegalPolicy === true
        ? (language === 'es' ? 'Requerida' : 'Required')
        : rentRequiresLegalPolicy === false
          ? (language === 'es' ? 'No requerida' : 'Not required')
          : (language === 'es' ? 'Por confirmar' : 'To be confirmed'),
      tone: rentRequiresLegalPolicy === true ? 'required' : rentRequiresLegalPolicy === false ? 'confirmed' : 'pending',
    },
    {
      icon: Timer,
      label: language === 'es' ? 'Contrato mínimo' : 'Minimum lease',
      value: activeRentOffering.minMonths != null
        ? `${activeRentOffering.minMonths} ${language === 'es' ? 'meses' : 'months'}`
        : (language === 'es' ? 'Por confirmar' : 'To be confirmed'),
      tone: activeRentOffering.minMonths != null ? 'neutral' : 'pending',
    },
    {
      icon: PawPrint,
      label: language === 'es' ? 'Mascotas' : 'Pets',
      value: acceptsPets === true
        ? (language === 'es' ? 'Permitidas' : 'Allowed')
        : acceptsPets === false
          ? (language === 'es' ? 'No permitidas' : 'Not allowed')
          : (language === 'es' ? 'Por confirmar' : 'To be confirmed'),
      tone: acceptsPets === true ? 'confirmed' : acceptsPets === false ? 'neutral' : 'pending',
    },
    {
      icon: Sofa,
      label: language === 'es' ? 'Mobiliario' : 'Furnishing',
      value: rentalFurnishingLabel,
      tone: rentalFurnishingStatus ? 'confirmed' : 'pending',
    },
    {
      icon: Wifi,
      label: language === 'es' ? 'Servicios incluidos' : 'Included utilities',
      value: rentalServicesLabel,
      tone: includedRentalServices.length > 0 || hasLegacyIncludedServices ? 'confirmed' : 'neutral',
    },
    {
      icon: Wrench,
      label: language === 'es' ? 'Mantenimiento' : 'Maintenance',
      value: includesMaintenance === true
        ? (language === 'es' ? 'Incluido' : 'Included')
        : includesMaintenance === false
          ? (language === 'es' ? 'Se paga por separado' : 'Paid separately')
          : (language === 'es' ? 'Por confirmar' : 'To be confirmed'),
      tone: includesMaintenance === true ? 'confirmed' : includesMaintenance === false ? 'neutral' : 'pending',
    },
  ] : [];

  return {
    rentAmountDueAtSigning: rentalSigningCosts.rentDueAtSigning,
    rentCurrency,
    rentMonthsDueAtSigning,
    rentSecurityDeposit,
    rentTotalDueAtSigning: rentalSigningCosts.totalDueAtSigning,
    rentalTermItems,
  };
}

const RentalTermCard = memo(function RentalTermCard({
  icon: Icon,
  label,
  value,
  tone = 'neutral',
}: RentalTermCardProps) {
  const styles = RENTAL_TERM_TONES[tone];
  return (
    <div className={`group min-h-[116px] rounded-[22px] border p-3.5 transition-colors sm:min-h-[104px] sm:p-4 ${styles.shell}`}>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:gap-3.5">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl ${styles.icon}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 sm:pt-0.5">
          <p className="text-[8px] font-black uppercase tracking-[0.12em] text-slate-500 sm:text-[9px] sm:tracking-[0.14em]">{label}</p>
          <p className={`mt-1.5 text-[13px] font-black leading-snug sm:mt-2 sm:text-sm ${styles.value}`}>{value}</p>
        </div>
      </div>
    </div>
  );
});

export const RentalTermCardGrid = memo(function RentalTermCardGrid({ items }: RentalTermCollectionProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {items.map((item) => (
        <RentalTermCard key={item.label} {...item} />
      ))}
    </div>
  );
});

export const RentalTermList = memo(function RentalTermList({ items }: RentalTermCollectionProps) {
  return (
    <dl className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50/70">
      {items.map((item, index) => {
        const Icon = item.icon;
        const tone = RENTAL_TERM_TONES[item.tone];
        return (
          <div
            key={item.label}
            className={`grid grid-cols-[34px_minmax(0,1fr)] gap-3 px-4 py-3.5 ${
              index < items.length - 1 ? 'border-b border-slate-200/80' : ''
            }`}
          >
            <span className={`flex h-[34px] w-[34px] items-center justify-center rounded-xl ${tone.icon}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div className="flex min-w-0 items-center justify-between gap-3">
              <dt className="text-[10px] font-bold leading-tight text-slate-500">{item.label}</dt>
              <dd className={`max-w-[58%] text-right text-[11px] font-black leading-tight ${tone.value}`}>
                {item.value}
              </dd>
            </div>
          </div>
        );
      })}
    </dl>
  );
});
