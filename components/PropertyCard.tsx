"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Property, PropertyOfferingMode } from '../lib/types';
import { useSwap } from '../lib/context/SwapContext';
import { Heart, ChevronLeft, ChevronRight, Star, ShieldCheck, Scale, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '../lib/context/LanguageContext';
import { getActiveOfferings } from '../lib/propertyOfferings';
import { formatCount, formatBathrooms, formatPropertyLocation } from '../lib/textHelpers';
import { useAuraV2 } from '../lib/context/AuraV2Context';
import { buildDecisionSummary } from '../lib/auraswap2/decision';

interface PropertyCardProps {
  property: Property;
  showOfferingBadges?: boolean;
}

const OFFERING_BADGE_ORDER: PropertyOfferingMode[] = ['SWAP', 'SHORT_RENT', 'MONTHLY_RENT', 'SALE'];

const OFFERING_BADGE_META: Record<PropertyOfferingMode, { label: string; className: string }> = {
  SWAP: {
    label: 'INTERCAMBIO',
    className: 'border-brand-accent/25 bg-brand-accent/5 text-brand-accent',
  },
  SHORT_RENT: {
    label: 'RENTA TEMPORAL',
    className: 'border-emerald-200 bg-emerald-50/80 text-emerald-700',
  },
  MONTHLY_RENT: {
    label: 'RENTA MENSUAL',
    className: 'border-sky-200 bg-sky-50/80 text-sky-700',
  },
  SALE: {
    label: 'VENTA',
    className: 'border-amber-200 bg-amber-50/80 text-amber-700',
  },
};

export default function PropertyCard({ property, showOfferingBadges = false }: PropertyCardProps) {
  const { favorites, toggleFavorite, reviews } = useSwap();
  const { t, language } = useTranslation();
  const { brief, comparisonIds, toggleComparison } = useAuraV2();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [imageErrorIndex, setImageErrorIndex] = useState<number | null>(null);
  const [compareNotice, setCompareNotice] = useState('');

  const isFavorited = favorites.includes(property.id);
  const isCompared = comparisonIds.includes(property.id);
  const decision = React.useMemo(() => buildDecisionSummary(property, brief, { comparisonCount: comparisonIds.length }), [property, brief, comparisonIds.length]);

  const dynamicRating = React.useMemo(() => {
    if (!reviews) return property.hostRating;
    const hostReviews = reviews.filter(r => r.reviewedUserId === property.hostId);
    if (hostReviews.length === 0) return property.hostRating;
    return (hostReviews.reduce((sum, r) => sum + r.rating, 0) / hostReviews.length);
  }, [reviews, property.hostId, property.hostRating]);

  const activeOfferingModes = React.useMemo(() => {
    const activeModes = new Set(getActiveOfferings(property).map((offering) => offering.mode));
    return OFFERING_BADGE_ORDER.filter((mode) => activeModes.has(mode));
  }, [property]);

  const priceText = React.useMemo(() => {
    const activeOfferings = getActiveOfferings(property);
    const sortedOfferings = [...activeOfferings].sort((a, b) => {
      return OFFERING_BADGE_ORDER.indexOf(a.mode) - OFFERING_BADGE_ORDER.indexOf(b.mode);
    });

    const priceTexts = sortedOfferings.map((offering) => {
      if (offering.mode === 'SALE') {
        const priceVal = offering.priceAmount || 450000;
        const currency = offering.currency || 'USD';
        return language === 'es'
          ? `${currency} $${priceVal.toLocaleString()}`
          : `$${priceVal.toLocaleString()} ${currency}`;
      }
      if (offering.mode === 'MONTHLY_RENT') {
        const priceVal = offering.priceAmount || 2500;
        const currency = offering.currency || 'USD';
        return language === 'es'
          ? `${currency} $${priceVal.toLocaleString()} / mes`
          : `$${priceVal.toLocaleString()} ${currency} / month`;
      }
      if (offering.mode === 'SHORT_RENT') {
        const priceVal = offering.priceAmount || 150;
        const currency = offering.currency || 'USD';
        return language === 'es'
          ? `${currency} $${priceVal.toLocaleString()} / noche`
          : `$${priceVal.toLocaleString()} ${currency} / night`;
      }
      if (offering.mode === 'SWAP') {
        return language === 'es' ? 'Intercambio gratuito' : 'Free Swap';
      }
      return '';
    }).filter(Boolean);

    return priceTexts.join('  |  ');
  }, [property, language]);

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % property.images.length);
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + property.images.length) % property.images.length);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(property.id);
  };

  const handleCompareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const result = toggleComparison(property.id);
    setCompareNotice(result.reason || (result.added ? 'Añadida para comparar' : 'Retirada de comparación'));
    window.setTimeout(() => setCompareNotice(''), 2200);
  };

  const fallbackUrl = 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80';

  return (
    <article
      id={`property-card-${property.id}`}
      className="group block"
    >
      <div 
        className="flex flex-col gap-3"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Image Container */}
        <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-brand-gray-100 shadow-premium group-hover:shadow-floating transition-all duration-300">
          <Link href={`/property/${property.id}`} className="absolute inset-0 z-0 block" aria-label={`Ver ${property.title}`}>
          {/* Image Slide */}
          <div className="w-full h-full relative">
            {(() => {
              const imageUrl = property.images[currentImageIndex] || fallbackUrl;
              const getDisplayUrl = (url: string) => {
                if (!url) return fallbackUrl;
                if (property.metadata?.imagesMetadata?.[url]?.thumbnailUrl) {
                  return property.metadata.imagesMetadata[url].thumbnailUrl;
                }
                if (url.includes('property-images/') && !url.includes('-thumb.webp') && url.endsWith('.webp')) {
                  return url.replace(/\.webp$/, '-thumb.webp');
                }
                return url;
              };

              return (
                <img
                  src={imageErrorIndex === currentImageIndex ? fallbackUrl : getDisplayUrl(imageUrl)}
                  alt={property.title}
                  onError={() => setImageErrorIndex(currentImageIndex)}
                  className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
                  loading="lazy"
                  decoding="async"
                />
              );
            })()}
          </div>

          {/* Gradient Overlay for bottom text styling or UI elements */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />
          </Link>

          {/* Quick Info Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
            {/* Explainable match instead of an opaque percentage */}
            <div className="glass px-3 py-1.5 rounded-full text-xs font-bold text-brand-accent flex items-center gap-1 shadow-sm bg-white/95">
              <span>{decision.requirementCount > 0 ? decision.matchLabel : (language === 'es' ? 'Coincidencia por definir' : 'Match not defined yet')}</span>
            </div>
            
            {/* Host Verified */}
            {property.hostVerified && (
              <div className="glass px-3 py-1.5 rounded-full text-xs font-bold text-brand-black flex items-center gap-1 shadow-sm bg-white/95 w-fit">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-accent fill-brand-accent/10" />
                <span>{language === 'es' ? 'Anfitrión Verificado' : 'Verified Host'}</span>
              </div>
            )}
          </div>

          {/* Favorite Button */}
          <button
            onClick={handleFavoriteClick}
            aria-label={isFavorited ? `Quitar ${property.title} de favoritos` : `Guardar ${property.title} en favoritos`}
            className={`absolute top-3 right-3 z-20 flex min-h-11 min-w-11 items-center justify-center rounded-full border transition-all duration-300 ${
              isFavorited
                ? 'bg-white border-white text-brand-rose scale-110 shadow-md'
                : 'bg-white/80 border-white/20 text-brand-black hover:bg-white hover:scale-105 shadow-sm'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorited ? 'fill-brand-rose' : ''}`} />
          </button>

          {/* Image Navigation Arrows (Show only on hover, desktop only) */}
          <AnimatePresence>
            {isHovered && property.images.length > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="hidden md:block"
              >
                <button
                  onClick={handlePrevImage}
                  aria-label="Imagen anterior"
                  className="absolute left-3 top-1/2 z-20 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 hover:bg-white text-brand-black border border-brand-gray-200/50 hover:scale-105 active:scale-95 transition-all shadow-md"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextImage}
                  aria-label="Imagen siguiente"
                  className="absolute right-3 top-1/2 z-20 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 hover:bg-white text-brand-black border border-brand-gray-200/50 hover:scale-105 active:scale-95 transition-all shadow-md"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Image Dots Indicators */}
          {property.images.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 pointer-events-none">
              {property.images.map((_, index) => (
                <div
                  key={index}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    index === currentImageIndex ? 'bg-white w-3.5' : 'bg-white/50'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Text Info Container */}
        <div className="flex flex-col gap-1 px-1">
          {/* Location & Rating */}
          <div className="flex items-center justify-between">
            <Link href={`/property/${property.id}`} className="font-semibold text-base tracking-tight text-brand-black group-hover:text-brand-accent transition-colors duration-200">
              {formatPropertyLocation(property.location, property.country)}
            </Link>
            <div className="flex items-center gap-1 text-sm font-medium">
              <Star className="w-3.5 h-3.5 fill-brand-black" />
              <span>{dynamicRating.toFixed(1)}</span>
            </div>
          </div>

          {/* Property Title / Micro Details */}
          <Link href={`/property/${property.id}`} className="text-sm text-brand-gray-500 truncate max-w-xs leading-normal">
            {t(`properties.${property.id}.title`).startsWith('properties.') ? property.title : t(`properties.${property.id}.title`)}
          </Link>

          {/* Key Specs Row */}
          <div className="flex items-center gap-2 text-xs text-brand-gray-500 font-medium mt-0.5 font-semibold">
            <span>{language === 'es' ? formatCount(property.bedrooms || 0, 'habitación', 'habitaciones', 'feminine') : `${property.bedrooms || 0} bedroom${property.bedrooms !== 1 ? 's' : ''}`}</span>
            <span>•</span>
            <span>{formatBathrooms(property.bathrooms || 0, property.halfBathrooms || 0, language === 'es' ? 'es' : 'en')}</span>
            {!showOfferingBadges && (
              <>
                <span>•</span>
                <span className="text-brand-accent font-bold">
                  {language === 'es' 
                    ? `Swap ${t(`valueRatings.${property.valueRating}`).startsWith('valueRatings.') ? property.valueRating : t(`valueRatings.${property.valueRating}`)}` 
                    : `${property.valueRating} swap`}
                </span>
              </>
            )}
          </div>

          {/* Price Row */}
          {priceText && (
            <div className="text-sm font-extrabold text-brand-black mt-1.5 leading-none">
              {priceText}
            </div>
          )}

          {decision.requirementCount > 0 && (
            <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-zinc-900">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                <span>{decision.matchLabel}</span>
              </div>
              {decision.tradeoffs[0] && (
                <div className="mt-1.5 flex items-start gap-2 text-xs leading-relaxed text-zinc-500">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                  <span>{decision.tradeoffs[0]}</span>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleCompareClick}
            className={`mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${isCompared ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-zinc-200 bg-white text-zinc-700 hover:border-indigo-400'}`}
            aria-pressed={isCompared}
          >
            <Scale className="h-4 w-4" aria-hidden="true" />
            {isCompared ? 'En comparación' : 'Añadir a comparación'}
          </button>
          {compareNotice && <span className="mt-1 block text-center text-xs font-medium text-indigo-700" role="status">{compareNotice}</span>}

          {showOfferingBadges && activeOfferingModes.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {activeOfferingModes.map((mode) => {
                const meta = OFFERING_BADGE_META[mode];
                return (
                  <span
                    key={mode}
                    className={`inline-flex h-6 items-center rounded-full border px-2.5 text-[9px] font-black leading-none tracking-wider shadow-sm ${meta.className}`}
                  >
                    {meta.label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
