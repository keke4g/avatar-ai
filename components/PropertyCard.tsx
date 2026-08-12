"use client";

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Property, PropertyOfferingMode } from '../lib/types';
import { useSwap } from '../lib/context/SwapContext';
import { Heart, ChevronLeft, ChevronRight, Star, ShieldCheck, CalendarDays } from 'lucide-react';
import { useTranslation } from '../lib/context/LanguageContext';
import { getActiveOfferings } from '../lib/propertyOfferings';
import { formatCount, formatBathrooms, formatPropertyLocation, formatPublishedAgo } from '../lib/textHelpers';

interface PropertyCardProps {
  property: Property;
  showOfferingBadges?: boolean;
  eagerImage?: boolean;
}

const OFFERING_BADGE_ORDER: PropertyOfferingMode[] = ['SWAP', 'SHORT_RENT', 'MONTHLY_RENT', 'SALE'];

const OFFERING_BADGE_LABELS: Record<PropertyOfferingMode, { es: string; en: string }> = {
  SWAP: {
    es: 'INTERCAMBIO',
    en: 'SWAP',
  },
  SHORT_RENT: {
    es: 'RENTA TEMPORAL',
    en: 'SHORT-TERM RENT',
  },
  MONTHLY_RENT: {
    es: 'RENTA MENSUAL',
    en: 'MONTHLY RENT',
  },
  SALE: {
    es: 'VENTA',
    en: 'SALE',
  },
};

function PropertyCard({ property, showOfferingBadges = false, eagerImage = false }: PropertyCardProps) {
  const { favorites, toggleFavorite, reviews } = useSwap();
  const { t, language } = useTranslation();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [previousImageIndex, setPreviousImageIndex] = useState<number | null>(null);
  const [imageTransitionReady, setImageTransitionReady] = useState(true);
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [imageError, setImageError] = useState(false);
  const transitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFavorited = favorites.includes(property.id);

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

  const publicationLabel = formatPublishedAgo(
    property.publishedAt || property.createdAt,
    language === 'es' ? 'es' : 'en',
  );

  const warmAdjacentImages = React.useCallback(() => {
    if (property.images.length < 2 || typeof window === 'undefined') return;

    const previous = property.images[(currentImageIndex - 1 + property.images.length) % property.images.length];
    const next = property.images[(currentImageIndex + 1) % property.images.length];
    [previous, next].filter(Boolean).forEach((url) => {
      const image = new window.Image();
      image.decoding = 'async';
      image.src = url;
    });
  }, [currentImageIndex, property.images]);

  useEffect(() => () => {
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
  }, []);

  const showImage = (index: number, direction: 1 | -1) => {
    if (index === currentImageIndex || property.images.length === 0) return;
    if (transitionTimerRef.current) clearTimeout(transitionTimerRef.current);
    setPreviousImageIndex(currentImageIndex);
    setSlideDirection(direction);
    setImageTransitionReady(false);
    setImageError(false);
    setCurrentImageIndex(index);
  };

  const handleCurrentImageReady = () => {
    requestAnimationFrame(() => {
      setImageTransitionReady(true);
      transitionTimerRef.current = setTimeout(() => {
        setPreviousImageIndex(null);
        transitionTimerRef.current = null;
      }, 460);
    });
  };

  const handleNextImage = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    showImage((currentImageIndex + 1) % property.images.length, 1);
  };

  const handlePrevImage = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    showImage((currentImageIndex - 1 + property.images.length) % property.images.length, -1);
  };

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite(property.id);
  };

  // A neutral local placeholder avoids presenting an unrelated stock home as
  // if it belonged to a real listing.
  const fallbackUrl = '/property-placeholder.svg';

  return (
    <Link 
      id={`property-card-${property.id}`}
      href={`/property/${property.id}`}
      prefetch={false}
      onPointerEnter={warmAdjacentImages}
      onFocus={warmAdjacentImages}
      className="group block"
    >
      <div className="flex flex-col gap-3">
        {/* Image Container */}
        <div className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-brand-gray-100 shadow-premium group-hover:shadow-floating transition-all duration-300">
          
          {/* Image Slide */}
          <div className="w-full h-full relative isolate bg-brand-gray-100">
            {previousImageIndex !== null && previousImageIndex !== currentImageIndex && (
              <Image
                src={property.images[previousImageIndex] || fallbackUrl}
                alt=""
                aria-hidden="true"
                fill
                sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
                unoptimized
                className="z-0 h-full w-full scale-[1.01] object-cover"
                loading="eager"
                decoding="async"
              />
            )}
            <Image
              key={`${currentImageIndex}-${imageError ? 'fallback' : 'image'}`}
              src={imageError ? fallbackUrl : (property.images[currentImageIndex] || fallbackUrl)}
              alt={property.title}
              fill
              sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
              unoptimized
              onLoad={handleCurrentImageReady}
              onError={() => {
                setImageError(true);
                setImageTransitionReady(false);
              }}
              className={`z-10 h-full w-full object-cover transition-[opacity,transform] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035] ${
                imageTransitionReady
                  ? 'translate-x-0 opacity-100'
                  : slideDirection === 1
                    ? 'translate-x-[4%] opacity-0'
                    : '-translate-x-[4%] opacity-0'
              }`}
              loading={eagerImage ? 'eager' : 'lazy'}
              fetchPriority={eagerImage ? 'high' : 'auto'}
              decoding="async"
            />
          </div>

          {/* Gradient Overlay for bottom text styling or UI elements */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent pointer-events-none" />

          {/* Quick Info Badges */}
          <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
            {activeOfferingModes.map((mode) => (
              <div
                key={mode}
                className="glass flex w-fit items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold tracking-wider text-brand-accent shadow-sm"
              >
                <span>{OFFERING_BADGE_LABELS[mode][language === 'es' ? 'es' : 'en']}</span>
              </div>
            ))}
            
            {/* Host Verified */}
            {property.hostVerified && (
              <div className="glass px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider text-brand-black flex items-center gap-1 shadow-sm bg-white/95 w-fit">
                <ShieldCheck className="w-3.5 h-3.5 text-brand-accent fill-brand-accent/10" />
                <span>{language === 'es' ? 'Verificado' : 'Verified'}</span>
              </div>
            )}
          </div>

          {/* Favorite Button */}
          <button
            onClick={handleFavoriteClick}
            aria-label={language === 'es' ? 'Guardar propiedad' : 'Save property'}
            className={`absolute top-3 right-3 p-2 rounded-full border transition-all duration-300 ${
              isFavorited
                ? 'bg-white border-white text-brand-rose scale-110 shadow-md'
                : 'bg-white/80 border-white/20 text-brand-black hover:bg-white hover:scale-105 shadow-sm'
            }`}
          >
            <Heart className={`w-4 h-4 ${isFavorited ? 'fill-brand-rose' : ''}`} />
          </button>

          {/* Image Navigation Arrows */}
          {property.images.length > 1 && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 items-center justify-between px-2.5 opacity-100 transition-opacity md:px-3 md:opacity-0 md:group-hover:opacity-100">
              <button
                type="button"
                onClick={handlePrevImage}
                aria-label={language === 'es' ? 'Imagen anterior' : 'Previous image'}
                className="group/arrow pointer-events-auto flex h-11 w-11 items-center justify-center border-0 bg-transparent transition-transform hover:-translate-x-0.5 active:scale-90 md:h-9 md:w-9"
              >
                <ChevronLeft aria-hidden="true" className="liquid-glass-chevron h-8 w-8 transition-all group-hover/arrow:scale-110 md:h-6 md:w-6" />
              </button>
              <button
                type="button"
                onClick={handleNextImage}
                aria-label={language === 'es' ? 'Imagen siguiente' : 'Next image'}
                className="group/arrow pointer-events-auto flex h-11 w-11 items-center justify-center border-0 bg-transparent transition-transform hover:translate-x-0.5 active:scale-90 md:h-9 md:w-9"
              >
                <ChevronRight aria-hidden="true" className="liquid-glass-chevron h-8 w-8 transition-all group-hover/arrow:scale-110 md:h-6 md:w-6" />
              </button>
            </div>
          )}

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
            <h3 className="font-semibold text-base tracking-tight text-brand-black group-hover:text-brand-accent transition-colors duration-200">
              {formatPropertyLocation(property.location, property.country)}
            </h3>
            <div className="flex items-center gap-1 text-sm font-medium">
              <Star className="w-3.5 h-3.5 fill-brand-black" />
              <span>{dynamicRating.toFixed(1)}</span>
            </div>
          </div>

          {/* Property Title / Micro Details */}
          <p className="text-sm text-brand-gray-500 truncate max-w-xs leading-normal">
            {t(`properties.${property.id}.title`, undefined, property.title)}
          </p>

          {publicationLabel && (
            <p className="mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-gray-400">
              <CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />
              <span>{publicationLabel}</span>
            </p>
          )}

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
                    ? `Swap ${t(`valueRatings.${property.valueRating}`, undefined, property.valueRating)}`
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

        </div>
      </div>
    </Link>
  );
}

export default React.memo(PropertyCard);
