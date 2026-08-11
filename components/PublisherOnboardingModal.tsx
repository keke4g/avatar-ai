"use client";

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Check,
  HardHat,
  House,
  KeyRound,
  Landmark,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '../lib/context/LanguageContext';
import { useSwap } from '../lib/context/SwapContext';
import type { User } from '../lib/types';
import {
  saveMyPublisherProfile,
  type PublisherProfile,
  type PublisherRepresentativeType,
} from '../lib/services/PublisherProfileService';

interface PublisherOnboardingModalProps {
  isOpen: boolean;
  currentUser: User;
  onClose: () => void;
  onComplete: (profile: PublisherProfile) => void;
}

const ORGANIZATION_REQUIRED = new Set<PublisherRepresentativeType>([
  'REAL_ESTATE_ADVISOR',
  'REAL_ESTATE_AGENCY',
  'CONSTRUCTION_COMPANY',
  'DEVELOPER',
]);

const ROLE_OPTIONS: Array<{
  id: PublisherRepresentativeType;
  icon: typeof Building2;
  es: string;
  en: string;
  detailEs: string;
  detailEn: string;
}> = [
  {
    id: 'OWNER',
    icon: House,
    es: 'Propietario',
    en: 'Property owner',
    detailEs: 'Publicas una propiedad propia.',
    detailEn: 'You publish your own property.',
  },
  {
    id: 'REAL_ESTATE_ADVISOR',
    icon: BadgeCheck,
    es: 'Asesor de una inmobiliaria',
    en: 'Real estate agency advisor',
    detailEs: 'Publicas como parte de una firma.',
    detailEn: 'You publish as part of a firm.',
  },
  {
    id: 'INDEPENDENT_ADVISOR',
    icon: BriefcaseBusiness,
    es: 'Asesor independiente',
    en: 'Independent advisor',
    detailEs: 'Trabajas con tu propia cartera.',
    detailEn: 'You manage your own portfolio.',
  },
  {
    id: 'REAL_ESTATE_AGENCY',
    icon: Building2,
    es: 'Inmobiliaria',
    en: 'Real estate agency',
    detailEs: 'Representas a una agencia o equipo.',
    detailEn: 'You represent an agency or team.',
  },
  {
    id: 'CONSTRUCTION_COMPANY',
    icon: HardHat,
    es: 'Constructora',
    en: 'Construction company',
    detailEs: 'Comercializas proyectos construidos.',
    detailEn: 'You market construction projects.',
  },
  {
    id: 'DEVELOPER',
    icon: Landmark,
    es: 'Desarrollador',
    en: 'Developer',
    detailEs: 'Publicas desarrollos inmobiliarios.',
    detailEn: 'You publish real estate developments.',
  },
  {
    id: 'PROPERTY_MANAGER',
    icon: KeyRound,
    es: 'Administro propiedades',
    en: 'Property manager',
    detailEs: 'Gestionas inmuebles de terceros.',
    detailEn: 'You manage properties for others.',
  },
];

const digits = (value: string) => value.replace(/\D/g, '');
const validPhone = (value: string) => digits(value).length >= 10 && digits(value).length <= 15;
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export default function PublisherOnboardingModal({
  isOpen,
  currentUser,
  onClose,
  onComplete,
}: PublisherOnboardingModalProps) {
  const { language } = useTranslation();
  const { updateProfileMock } = useSwap();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [representativeType, setRepresentativeType] = useState<PublisherRepresentativeType | null>(null);
  const [fullName, setFullName] = useState(currentUser.name || '');
  const [organizationName, setOrganizationName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [sameWhatsapp, setSameWhatsapp] = useState(true);
  const [email, setEmail] = useState(currentUser.email || '');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const copy = language === 'es';
  const selectedRole = useMemo(
    () => ROLE_OPTIONS.find((option) => option.id === representativeType),
    [representativeType],
  );
  const organizationRequired = representativeType ? ORGANIZATION_REQUIRED.has(representativeType) : false;

  if (!isOpen) return null;

  const goNext = () => {
    setError('');
    if (step === 1 && !representativeType) {
      setError(copy ? 'Selecciona cómo representas la propiedad.' : 'Select how you represent the property.');
      return;
    }
    if (step === 2) {
      if (fullName.trim().length < 2) {
        setError(copy ? 'Escribe el nombre completo de la persona responsable.' : 'Enter the responsible person’s full name.');
        return;
      }
      if (organizationRequired && organizationName.trim().length < 2) {
        setError(copy ? 'Escribe el nombre de la empresa que representas.' : 'Enter the company you represent.');
        return;
      }
    }
    setStep((current) => Math.min(3, current + 1) as 1 | 2 | 3);
  };

  const submit = async () => {
    setError('');
    if (!validPhone(phone) || !validPhone(whatsapp)) {
      setError(copy ? 'Ingresa teléfono y WhatsApp válidos, de 10 a 15 dígitos.' : 'Enter valid phone and WhatsApp numbers, 10–15 digits each.');
      return;
    }
    if (!validEmail(email)) {
      setError(copy ? 'Ingresa un correo de contacto válido.' : 'Enter a valid contact email.');
      return;
    }
    if (!consent) {
      setError(copy ? 'Confirma que podremos compartir estos datos con personas interesadas.' : 'Confirm that we may share these details with interested people.');
      return;
    }
    if (!representativeType) return;

    setSubmitting(true);
    try {
      const profile = await saveMyPublisherProfile(currentUser.id, {
        representativeType,
        fullName: fullName.trim(),
        organizationName: organizationName.trim() || null,
        phone: phone.trim(),
        whatsapp: whatsapp.trim(),
        email: email.trim().toLowerCase(),
      });
      await updateProfileMock({ name: fullName.trim() });
      onComplete(profile);
    } catch (submissionError) {
      setError(submissionError instanceof Error
        ? submissionError.message
        : (copy ? 'No se pudo guardar la comprobación.' : 'We could not save the verification.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center overflow-hidden bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 18, scale: 0.985 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="publisher-onboarding-title"
        className="grid h-[94dvh] max-h-[94dvh] w-full max-w-5xl grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden rounded-t-[32px] bg-[#f8f7f3] shadow-2xl sm:h-[calc(100dvh-3rem)] sm:max-h-[900px] sm:rounded-[34px] lg:grid-cols-[310px_minmax(0,1fr)]"
      >
        <aside className="relative hidden overflow-hidden bg-[#171717] p-8 text-white lg:flex lg:flex-col">
          <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full border border-white/10" />
          <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full border border-white/10" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-[9px] font-black uppercase tracking-[0.18em] text-white/70">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              {copy ? 'Comprobación única' : 'One-time check'}
            </span>
            <h2 className="mt-7 text-3xl font-black leading-[1.05] tracking-[-0.04em]">
              {copy ? 'Tu pasaporte para publicar.' : 'Your publishing passport.'}
            </h2>
            <p className="mt-4 text-xs font-medium leading-relaxed text-white/55">
              {copy
                ? 'Completa estos datos una sola vez. Los usaremos para que las personas interesadas sepan con quién hablar.'
                : 'Complete these details once. We use them so interested people know who to contact.'}
            </p>
          </div>

          <div className="relative mt-10 space-y-3">
            {[
              copy ? 'Tu representación' : 'Your role',
              copy ? 'Identidad responsable' : 'Responsible identity',
              copy ? 'Datos de contacto' : 'Contact details',
            ].map((label, index) => {
              const number = index + 1;
              const active = step === number;
              const done = step > number;
              return (
                <div key={label} className={`flex items-center gap-3 rounded-2xl px-3 py-3 transition ${active ? 'bg-white/10' : ''}`}>
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black ${
                    done ? 'bg-emerald-400 text-[#171717]' : active ? 'bg-white text-[#171717]' : 'border border-white/15 text-white/40'
                  }`}>
                    {done ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : number}
                  </span>
                  <span className={`text-[11px] font-bold ${active ? 'text-white' : 'text-white/40'}`}>{label}</span>
                </div>
              );
            })}
          </div>

          <div className="relative mt-auto rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-emerald-300">
              <LockKeyhole className="h-3.5 w-3.5" />
              {copy ? 'Información protegida' : 'Protected information'}
            </div>
            <p className="mt-2 text-[10px] font-medium leading-relaxed text-white/45">
              {copy
                ? 'No mostraremos estos datos en listados públicos. Se usarán en el flujo de contacto de tus propiedades.'
                : 'We do not display this information in public lists. It is used in your property contact flow.'}
            </p>
          </div>
        </aside>

        <section className="flex h-full min-h-0 flex-col overflow-hidden">
          <header className="flex items-start justify-between border-b border-black/5 bg-white/70 px-5 py-5 sm:px-8 sm:py-6">
            <div>
              <div className="mb-2 flex items-center gap-2 lg:hidden">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-700">
                  {copy ? 'Comprobación única' : 'One-time check'}
                </span>
              </div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-brand-gray-400">
                {copy ? `Paso ${step} de 3` : `Step ${step} of 3`}
              </p>
              <h1 id="publisher-onboarding-title" className="mt-1 text-xl font-black tracking-tight text-brand-black sm:text-2xl">
                {step === 1
                  ? (copy ? '¿Cómo te representas en esta propiedad?' : 'How do you represent this property?')
                  : step === 2
                    ? (copy ? 'Identifiquemos al responsable' : 'Identify the responsible person')
                    : (copy ? '¿Cómo pueden contactarte?' : 'How can people contact you?')}
              </h1>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-black/5 bg-white text-brand-gray-500 transition hover:text-brand-black"
              aria-label={copy ? 'Cerrar' : 'Close'}
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
            {step === 1 && (
              <div>
                <p className="mb-5 max-w-xl text-xs font-semibold leading-relaxed text-brand-gray-500">
                  {copy
                    ? 'Elige la opción que mejor describe tu relación con las propiedades que publicarás.'
                    : 'Choose the option that best describes your relationship with the properties you will publish.'}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ROLE_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const selected = representativeType === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setRepresentativeType(option.id);
                          setError('');
                        }}
                        className={`group flex min-h-24 items-start gap-3 rounded-2xl border p-4 text-left transition ${
                          selected
                            ? 'border-brand-black bg-brand-black text-white shadow-lg'
                            : 'border-brand-gray-200 bg-white text-brand-black hover:-translate-y-0.5 hover:border-brand-gray-400 hover:shadow-sm'
                        }`}
                      >
                        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          selected ? 'bg-white/10 text-emerald-300' : 'bg-brand-gray-100 text-brand-black'
                        }`}>
                          <Icon className="h-5 w-5" />
                        </span>
                        <span>
                          <span className="block text-xs font-black">{copy ? option.es : option.en}</span>
                          <span className={`mt-1 block text-[10px] font-semibold leading-relaxed ${selected ? 'text-white/55' : 'text-brand-gray-500'}`}>
                            {copy ? option.detailEs : option.detailEn}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="mx-auto max-w-xl">
                <div className="mb-6 flex items-center gap-3 rounded-2xl border border-brand-gray-200 bg-white p-4">
                  {selectedRole && <selectedRole.icon className="h-5 w-5 text-brand-black" />}
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-wider text-brand-gray-400">{copy ? 'Publicarás como' : 'Publishing as'}</p>
                    <p className="mt-0.5 text-xs font-black text-brand-black">{selectedRole && (copy ? selectedRole.es : selectedRole.en)}</p>
                  </div>
                </div>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-black">
                    {copy ? 'Nombre completo del responsable' : 'Responsible person’s full name'}
                  </span>
                  <div className="relative mt-2">
                    <UserRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray-400" />
                    <input
                      autoFocus
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      autoComplete="name"
                      className="w-full rounded-2xl border border-brand-gray-200 bg-white py-3.5 pl-11 pr-4 text-xs font-bold text-brand-black outline-none transition focus:border-brand-black"
                      placeholder={copy ? 'Nombre y apellidos' : 'First and last name'}
                    />
                  </div>
                  <span className="mt-2 block text-[10px] font-semibold leading-relaxed text-brand-gray-500">
                    {copy ? 'Será la persona visible como responsable del anuncio.' : 'This person will appear as responsible for the listing.'}
                  </span>
                </label>

                <label className="mt-6 block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-black">
                    {copy ? 'Nombre de inmobiliaria o empresa' : 'Agency or company name'}
                    {!organizationRequired && <span className="ml-2 font-bold normal-case tracking-normal text-brand-gray-400">({copy ? 'opcional' : 'optional'})</span>}
                  </span>
                  <div className="relative mt-2">
                    <Building2 className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray-400" />
                    <input
                      value={organizationName}
                      onChange={(event) => setOrganizationName(event.target.value)}
                      autoComplete="organization"
                      className="w-full rounded-2xl border border-brand-gray-200 bg-white py-3.5 pl-11 pr-4 text-xs font-bold text-brand-black outline-none transition focus:border-brand-black"
                      placeholder={copy ? 'Ej. Gardens Towers' : 'e.g. Gardens Towers'}
                    />
                  </div>
                </label>
              </div>
            )}

            {step === 3 && (
              <div className="mx-auto max-w-xl space-y-5">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                  <p className="flex items-center gap-2 text-xs font-black text-emerald-900">
                    <Phone className="h-4 w-4" />
                    {copy ? 'Estos datos permiten que te contacten' : 'These details let people contact you'}
                  </p>
                  <p className="mt-1.5 text-[10px] font-semibold leading-relaxed text-emerald-800/75">
                    {copy
                      ? 'Cuando alguien se interese en una propiedad, Towers México podrá usar este contacto para conectar a ambas partes.'
                      : 'When someone is interested in a property, Towers México may use these details to connect both parties.'}
                  </p>
                </div>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-black">{copy ? 'Teléfono' : 'Phone'}</span>
                  <div className="relative mt-2">
                    <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray-400" />
                    <input
                      value={phone}
                      onChange={(event) => {
                        const nextPhone = event.target.value;
                        setPhone(nextPhone);
                        if (sameWhatsapp) setWhatsapp(nextPhone);
                      }}
                      inputMode="tel"
                      autoComplete="tel"
                      className="w-full rounded-2xl border border-brand-gray-200 bg-white py-3.5 pl-11 pr-4 text-xs font-bold text-brand-black outline-none transition focus:border-brand-black"
                      placeholder="+52 614 000 0000"
                    />
                  </div>
                </label>

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-brand-gray-200 bg-white p-4">
                  <input
                    type="checkbox"
                    checked={sameWhatsapp}
                    onChange={(event) => {
                      setSameWhatsapp(event.target.checked);
                      if (event.target.checked) setWhatsapp(phone);
                    }}
                    className="h-4 w-4 accent-black"
                  />
                  <span className="text-[11px] font-bold text-brand-black">
                    {copy ? 'Mi WhatsApp es el mismo número' : 'My WhatsApp uses the same number'}
                  </span>
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-black">WhatsApp</span>
                  <div className="relative mt-2">
                    <Phone className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray-400" />
                    <input
                      value={whatsapp}
                      onChange={(event) => setWhatsapp(event.target.value)}
                      disabled={sameWhatsapp}
                      inputMode="tel"
                      autoComplete="tel"
                      className="w-full rounded-2xl border border-brand-gray-200 bg-white py-3.5 pl-11 pr-4 text-xs font-bold text-brand-black outline-none transition focus:border-brand-black disabled:bg-brand-gray-100 disabled:text-brand-gray-500"
                      placeholder="+52 614 000 0000"
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-wider text-brand-black">{copy ? 'Correo de contacto' : 'Contact email'}</span>
                  <div className="relative mt-2">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray-400" />
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      type="email"
                      autoComplete="email"
                      className="w-full rounded-2xl border border-brand-gray-200 bg-white py-3.5 pl-11 pr-4 text-xs font-bold text-brand-black outline-none transition focus:border-brand-black"
                      placeholder="contacto@ejemplo.com"
                    />
                  </div>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-brand-gray-200 bg-white p-4">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-black"
                  />
                  <span className="text-[10px] font-semibold leading-relaxed text-brand-gray-600">
                    {copy
                      ? 'Confirmo que estos datos son correctos y autorizo que Towers México los utilice para ponerme en contacto con personas interesadas en mis propiedades.'
                      : 'I confirm these details are correct and authorize Towers México to use them to connect me with people interested in my properties.'}
                  </span>
                </label>
              </div>
            )}

            {error && (
              <p role="alert" className="mx-auto mt-5 max-w-xl rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[10px] font-bold text-rose-700">
                {error}
              </p>
            )}
          </div>

          <footer className="flex items-center justify-between border-t border-black/5 bg-white/75 px-5 py-4 sm:px-8">
            <button
              type="button"
              onClick={() => {
                setError('');
                if (step === 1) onClose();
                else setStep((current) => Math.max(1, current - 1) as 1 | 2 | 3);
              }}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-[10px] font-black uppercase tracking-wider text-brand-gray-500 transition hover:bg-brand-gray-100 hover:text-brand-black disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" />
              {step === 1 ? (copy ? 'Ahora no' : 'Not now') : (copy ? 'Atrás' : 'Back')}
            </button>
            <button
              type="button"
              onClick={step === 3 ? () => void submit() : goNext}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-brand-black px-5 py-3 text-[10px] font-black uppercase tracking-wider text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-black/90 disabled:translate-y-0 disabled:opacity-50"
            >
              {submitting
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : step === 3
                  ? <ShieldCheck className="h-4 w-4 text-emerald-300" />
                  : <ArrowRight className="h-4 w-4" />}
              {step === 3
                ? (copy ? 'Guardar y publicar' : 'Save and publish')
                : (copy ? 'Continuar' : 'Continue')}
            </button>
          </footer>
        </section>
      </motion.div>
    </div>
  );
}
