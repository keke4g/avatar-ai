"use client";

import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Home,
  Mail,
  MapPin,
  MessageCircle,
  PhoneCall,
  ShieldCheck,
} from 'lucide-react';
import ProfileAvatar from '../../../components/ProfileAvatar';
import PropertyCard from '../../../components/PropertyCard';
import { useTranslation } from '../../../lib/context/LanguageContext';
import { useSwap } from '../../../lib/context/SwapContext';
import type { Property } from '../../../lib/types';

interface PublicProfileClientProps {
  profileId: string;
}

type RepresentativeType = NonNullable<NonNullable<Property['brokerProfile']>['representativeType']>;

const REPRESENTATIVE_LABELS: Record<RepresentativeType, { es: string; en: string }> = {
  OWNER: { es: 'Propietario', en: 'Owner' },
  REAL_ESTATE_ADVISOR: { es: 'Asesor de una inmobiliaria', en: 'Real estate advisor' },
  INDEPENDENT_ADVISOR: { es: 'Asesor independiente', en: 'Independent advisor' },
  REAL_ESTATE_AGENCY: { es: 'Inmobiliaria', en: 'Real estate agency' },
  CONSTRUCTION_COMPANY: { es: 'Constructora', en: 'Construction company' },
  DEVELOPER: { es: 'Desarrollador', en: 'Developer' },
  PROPERTY_MANAGER: { es: 'Administrador de propiedades', en: 'Property manager' },
};

const phoneHref = (value?: string) => {
  if (!value) return null;
  const normalized = value.replace(/[^\d+]/g, '');
  return normalized.replace(/\D/g, '').length >= 10 ? `tel:${normalized}` : null;
};

const whatsappHref = (value?: string, name?: string, language?: 'es' | 'en') => {
  if (!value) return null;
  const normalized = value.replace(/\D/g, '');
  if (normalized.length < 10) return null;
  const message = language === 'en'
    ? `Hello ${name || ''}, I saw your property profile on Towers México and would like more information.`
    : `Hola ${name || ''}, vi tu perfil inmobiliario en Towers México y me gustaría recibir más información.`;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
};

export default function PublicProfileClient({ profileId }: PublicProfileClientProps) {
  const { properties, users, loading } = useSwap();
  const { language } = useTranslation();

  const publicProperties = properties.filter((property) => (
    property.hostId === profileId
    && property.isPublished === true
    && property.folderStatus === 'PUBLISHED'
    && !property.isDemo
    && !property.is_demo
  ));
  const leadProperty = publicProperties[0];
  const publicUser = users.find((user) => user.id === profileId);
  const publisher = leadProperty?.brokerProfile;
  const name = publisher?.name || leadProperty?.hostName || publicUser?.name || '';
  const avatar = publisher?.photo || leadProperty?.hostAvatar || publicUser?.avatar || '';
  const company = publisher?.company || '';
  const representativeType = publisher?.representativeType;
  const roleLabel = representativeType
    ? REPRESENTATIVE_LABELS[representativeType][language]
    : (language === 'es' ? 'Publicador inmobiliario' : 'Property publisher');
  const locations = Array.from(new Set(
    publicProperties
      .map((property) => property.city || property.location)
      .filter(Boolean),
  ));
  const phone = phoneHref(publisher?.phone);
  const whatsapp = whatsappHref(publisher?.whatsapp, name, language);
  const email = publisher?.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(publisher.email)
    ? publisher.email
    : null;

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
        <div className="h-[340px] animate-pulse rounded-[36px] bg-neutral-200" />
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="aspect-[4/3] animate-pulse rounded-3xl bg-neutral-200" />
          ))}
        </div>
      </main>
    );
  }

  if (!name || (!leadProperty && !publicUser)) {
    return (
      <main className="mx-auto flex min-h-[65vh] w-full max-w-xl items-center px-5 py-16 text-center">
        <div className="w-full rounded-[32px] border border-neutral-200 bg-white p-8 shadow-[0_24px_70px_-45px_rgba(0,0,0,0.45)]">
          <ProfileAvatar name="Towers México" className="mx-auto h-20 w-20" textClassName="text-xl" />
          <h1 className="mt-5 text-2xl font-black text-neutral-950">
            {language === 'es' ? 'Perfil no disponible' : 'Profile unavailable'}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm font-medium leading-relaxed text-neutral-500">
            {language === 'es'
              ? 'Este perfil no existe o todavía no cuenta con información pública.'
              : 'This profile does not exist or does not have public information yet.'}
          </p>
          <Link
            href="/explore"
            className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-neutral-950 px-6 text-xs font-black uppercase tracking-[0.08em] text-white"
          >
            {language === 'es' ? 'Explorar propiedades' : 'Explore properties'}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
      <Link
        href="/explore"
        className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 text-xs font-extrabold text-neutral-700 transition hover:border-neutral-950"
      >
        <ArrowLeft className="h-4 w-4" />
        {language === 'es' ? 'Volver a explorar' : 'Back to explore'}
      </Link>

      <section className="relative overflow-hidden rounded-[34px] bg-neutral-950 text-white shadow-[0_38px_100px_-56px_rgba(0,0,0,0.85)] sm:rounded-[42px]">
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:radial-gradient(circle_at_78%_18%,rgba(91,92,255,0.72),transparent_26%),radial-gradient(circle_at_12%_100%,rgba(16,185,129,0.34),transparent_30%)]" />
        <div className="pointer-events-none absolute -right-24 top-2 h-72 w-72 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-10 top-16 h-48 w-48 rounded-full border border-white/10" />

        <div className="relative grid gap-8 px-6 py-7 sm:px-9 sm:py-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
          <div>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <ProfileAvatar
                src={avatar}
                name={name}
                alt={language === 'es' ? `Perfil de ${name}` : `${name}'s profile`}
                className="h-24 w-24 border border-white/20 shadow-2xl sm:h-28 sm:w-28"
                textClassName="text-3xl"
              />
              <div className="min-w-0">
                <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-white/85">
                  {roleLabel}
                </span>
                <h1 className="mt-3 break-words text-3xl font-black leading-none tracking-[-0.04em] sm:text-5xl">
                  {name}
                </h1>
                {company && (
                  <p className="mt-3 flex items-center gap-2 text-sm font-bold text-white/65">
                    <Building2 className="h-4 w-4" />
                    {company}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-7 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/12 px-3 py-2 text-[10px] font-extrabold text-emerald-300 ring-1 ring-inset ring-emerald-300/20">
                <ShieldCheck className="h-4 w-4" />
                {language === 'es' ? 'Contacto de publicación completado' : 'Publisher contact completed'}
              </span>
              {locations[0] && (
                <span className="inline-flex items-center gap-2 rounded-full bg-white/8 px-3 py-2 text-[10px] font-extrabold text-white/70 ring-1 ring-inset ring-white/10">
                  <MapPin className="h-4 w-4" />
                  {locations[0]}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-[26px] border border-white/10 bg-white/[0.07] p-3 backdrop-blur-md">
            <p className="px-2 pb-3 pt-1 text-[9px] font-black uppercase tracking-[0.14em] text-white/45">
              {language === 'es' ? 'Contactar directamente' : 'Contact directly'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {whatsapp && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white text-[10px] font-black text-neutral-950 transition hover:bg-emerald-300"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
              )}
              {phone && (
                <a
                  href={phone}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 text-[10px] font-black text-white transition hover:bg-white/12"
                >
                  <PhoneCall className="h-4 w-4" />
                  {language === 'es' ? 'Llamar' : 'Call'}
                </a>
              )}
              {email && (
                <a
                  href={`mailto:${email}?subject=${encodeURIComponent(language === 'es' ? 'Consulta desde Towers México' : 'Towers México inquiry')}`}
                  className="col-span-2 flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 text-[10px] font-black text-white transition hover:bg-white/12"
                >
                  <Mail className="h-4 w-4" />
                  {language === 'es' ? 'Enviar correo' : 'Send email'}
                </a>
              )}
              {!whatsapp && !phone && !email && (
                <p className="col-span-2 px-3 py-5 text-center text-xs font-semibold text-white/55">
                  {language === 'es' ? 'Contacto directo no disponible.' : 'Direct contact is unavailable.'}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="relative grid grid-cols-2 border-t border-white/10 bg-white/[0.04] sm:grid-cols-3">
          <div className="px-6 py-5 sm:px-9">
            <p className="text-2xl font-black">{publicProperties.length}</p>
            <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/45">
              {publicProperties.length === 1
                ? (language === 'es' ? 'Propiedad publicada' : 'Published property')
                : (language === 'es' ? 'Propiedades publicadas' : 'Published properties')}
            </p>
          </div>
          <div className="border-l border-white/10 px-6 py-5 sm:px-9">
            <p className="text-2xl font-black">{locations.length}</p>
            <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/45">
              {language === 'es' ? 'Zonas con inventario' : 'Inventory areas'}
            </p>
          </div>
          <div className="col-span-2 hidden border-l border-white/10 px-6 py-5 sm:col-span-1 sm:block sm:px-9">
            <p className="flex items-center gap-2 text-2xl font-black">
              <Home className="h-5 w-5 text-violet-300" />
              Towers México
            </p>
            <p className="mt-1 text-[9px] font-extrabold uppercase tracking-[0.12em] text-white/45">
              {language === 'es' ? 'Inventario verificado' : 'Verified inventory'}
            </p>
          </div>
        </div>
      </section>

      <section className="pt-10 sm:pt-14">
        <div className="mb-7 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-600">
              {language === 'es' ? 'Inventario público' : 'Public inventory'}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-neutral-950 sm:text-4xl">
              {language === 'es' ? 'Propiedades de este perfil' : 'Properties from this profile'}
            </h2>
          </div>
          <p className="max-w-sm text-sm font-medium leading-relaxed text-neutral-500">
            {language === 'es'
              ? 'Sólo se muestran anuncios aprobados y disponibles públicamente.'
              : 'Only approved listings available to the public are shown.'}
          </p>
        </div>

        {publicProperties.length > 0 ? (
          <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {publicProperties.map((property) => (
              <PropertyCard key={property.id} property={property} showOfferingBadges />
            ))}
          </div>
        ) : (
          <div className="rounded-[30px] border border-dashed border-neutral-300 bg-white px-6 py-14 text-center">
            <Home className="mx-auto h-8 w-8 text-neutral-300" />
            <h3 className="mt-4 text-lg font-black text-neutral-900">
              {language === 'es' ? 'Todavía no hay propiedades públicas' : 'No public properties yet'}
            </h3>
            <p className="mt-2 text-sm font-medium text-neutral-500">
              {language === 'es'
                ? 'Los anuncios aparecerán aquí después de ser aprobados.'
                : 'Listings will appear here after approval.'}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
