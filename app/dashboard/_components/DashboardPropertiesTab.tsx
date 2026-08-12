'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { Clock, Edit, Eye, EyeOff, Loader2, Plus, Sparkles, Star } from 'lucide-react';
import { launchConfetti } from '@/components/runtime/launchConfetti';

import { useTranslation } from '@/lib/context/LanguageContext';
import { formatBathrooms, formatCount, formatPropertyLocation } from '@/lib/textHelpers';
import type { Property, Review } from '@/lib/types';

interface DashboardPropertiesTabProps {
  properties: Property[];
  reviews: Review[];
  isAdmin: boolean;
  publisherGateLoading: boolean;
  editingPropertyLoadingId: string | null;
  onNavigateProperty: (propertyId: string) => void;
  onTogglePublish: (propertyId: string) => Promise<void>;
  onSubmitForReview: (propertyId: string) => void | Promise<void>;
  onToggleFeature: (propertyId: string) => void | Promise<void>;
  onOpenEdit: (property: Property) => Promise<void>;
  onOpenPublish: () => Promise<void>;
}

export function DashboardPropertiesTab({
  properties,
  reviews,
  isAdmin,
  publisherGateLoading,
  editingPropertyLoadingId,
  onNavigateProperty,
  onTogglePublish,
  onSubmitForReview,
  onToggleFeature,
  onOpenEdit,
  onOpenPublish,
}: DashboardPropertiesTabProps) {
  const { t, language } = useTranslation();
  const reviewStatsByHost = useMemo(() => {
    const stats = new Map<string, { count: number; total: number }>();
    for (const review of reviews) {
      const current = stats.get(review.reviewedUserId) || { count: 0, total: 0 };
      current.count += 1;
      current.total += review.rating;
      stats.set(review.reviewedUserId, current);
    }
    return stats;
  }, [reviews]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-bold text-brand-black tracking-tight">{t('dashboard.yourExchangeableSpaces')}</h2>
          <p className="text-xs text-brand-gray-500">{t('dashboard.yourExchangeableSpacesDesc')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {properties.map((property) => {
          const reviewStats = reviewStatsByHost.get(property.hostId);
          const averageRating = reviewStats
            ? reviewStats.total / reviewStats.count
            : property.hostRating > 0
              ? property.hostRating
              : null;
          const isFeatured = Boolean(property.isFeatured);

          return (
            <div key={property.id} className="bg-white border border-brand-gray-200/80 rounded-3xl overflow-hidden p-4 shadow-premium hover:shadow-floating transition-all duration-300 flex flex-col gap-4 relative">
              <div
                onClick={() => onNavigateProperty(property.id)}
                className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-brand-gray-100 shadow-sm shrink-0 cursor-pointer group"
                title={language === 'es' ? 'Ver vista pública' : 'View public page'}
              >
                {/* Property media can use arbitrary publisher-provided hosts. */}
                <Image
                  src={property.images[0] || '/property-placeholder.svg'}
                  alt={property.title}
                  fill
                  sizes="(max-width: 639px) calc(100vw - 64px), (max-width: 767px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  unoptimized
                />

                <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 bg-white/95 backdrop-blur-sm ${property.folderStatus === 'UNDER_REVIEW'
                    ? 'text-amber-700 border border-amber-200/20'
                    : property.isPublished !== false
                      ? 'text-emerald-600 border border-emerald-200/20'
                      : 'text-slate-600 border border-slate-200/20'}`}>
                    {property.folderStatus === 'UNDER_REVIEW'
                      ? language === 'es' ? 'En revisión' : 'Under review'
                      : property.isPublished !== false
                        ? language === 'es' ? 'Publicado' : 'Published'
                        : language === 'es' ? 'No publicado' : 'Unpublished'}
                  </span>

                  {isFeatured ? (
                    <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
                      <Sparkles className="w-3 h-3 fill-white/20" />
                      <span>{language === 'es' ? 'Destacado' : 'Featured'}</span>
                    </span>
                  ) : null}
                </div>
              </div>

              <div
                onClick={() => onNavigateProperty(property.id)}
                className="flex flex-col gap-1 flex-1 cursor-pointer group"
                title={language === 'es' ? 'Ver vista pública' : 'View public page'}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-brand-black tracking-tight truncate max-w-[80%] group-hover:text-brand-accent transition-colors">
                    {formatPropertyLocation(property.location, property.country)}
                  </h3>
                  <div className="flex items-center gap-0.5 text-xs font-semibold">
                    {averageRating != null ? (
                      <>
                        <Star className="w-3 h-3 fill-brand-black text-brand-black" />
                        <span>{averageRating.toFixed(1)}</span>
                      </>
                    ) : (
                      <span className="text-brand-gray-400">{language === 'es' ? 'Sin reseñas' : 'No reviews'}</span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-brand-gray-500 font-medium truncate group-hover:text-brand-accent/80 transition-colors">
                  {property.title}
                </p>
                <p className="text-[9px] font-black uppercase tracking-[0.1em] text-violet-600">
                  Folio {property.internalCode || 'pendiente'}
                </p>
                <div className="flex items-center gap-2 text-[10px] text-brand-gray-500 font-semibold mt-1">
                  <span>{language === 'es' ? formatCount(property.bedrooms || 0, 'habitación', 'habitaciones', 'feminine') : `${property.bedrooms || 0} bedroom${property.bedrooms !== 1 ? 's' : ''}`}</span>
                  <span>•</span>
                  <span>{formatBathrooms(property.bathrooms || 0, property.halfBathrooms || 0, language === 'es' ? 'es' : 'en')}</span>
                  <span>•</span>
                  <span className="text-brand-accent font-bold">
                    {language === 'es'
                      ? `Swap ${t(`valueRatings.${property.valueRating}`, undefined, property.valueRating)}`
                      : `${property.valueRating} swap`}
                  </span>
                </div>
              </div>

              <div className="h-px bg-brand-gray-100/80 w-full" />

              <div className="flex flex-wrap items-center justify-between gap-2 mt-auto">
                {isAdmin || property.isPublished !== false ? (
                  <button
                    type="button"
                    onClick={async () => {
                      await onTogglePublish(property.id);
                      launchConfetti({
                        particleCount: 50,
                        spread: 40,
                        origin: { y: 0.8 },
                      });
                    }}
                    className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-[10px] font-bold cursor-pointer flex-1 min-w-[65px] ${property.isPublished !== false
                      ? 'border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-50'
                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80'}`}
                    title={property.isPublished !== false ? (language === 'es' ? 'Despublicar' : 'Unpublish') : (language === 'es' ? 'Publicar' : 'Publish')}
                  >
                    {property.isPublished !== false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{property.isPublished !== false ? (language === 'es' ? 'Ocultar' : 'Hide') : (language === 'es' ? 'Publicar' : 'Publish')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={property.folderStatus === 'UNDER_REVIEW'}
                    onClick={() => void onSubmitForReview(property.id)}
                    className="flex min-w-[65px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 p-2 text-[10px] font-bold text-amber-800 transition disabled:cursor-wait disabled:opacity-80"
                    title={language === 'es' ? 'Towers México revisará el anuncio antes de publicarlo' : 'Towers México will review the listing before publication'}
                  >
                    <Clock className="h-3.5 w-3.5" />
                    <span>{property.folderStatus === 'UNDER_REVIEW' ? (language === 'es' ? 'En revisión' : 'Under review') : (language === 'es' ? 'Enviar a revisión' : 'Submit')}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => void onToggleFeature(property.id)}
                  className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-[10px] font-bold cursor-pointer flex-1 min-w-[65px] ${isFeatured
                    ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100/80'
                    : 'border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-50'}`}
                  title={language === 'es' ? 'Destacar' : 'Feature Listing'}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isFeatured ? (language === 'es' ? 'Estándar' : 'Standard') : (language === 'es' ? 'Destacar' : 'Feature')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => void onOpenEdit(property)}
                  disabled={editingPropertyLoadingId === property.id}
                  className="p-2 bg-brand-black hover:bg-brand-black/90 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 min-w-[65px]"
                >
                  {editingPropertyLoadingId === property.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Edit className="w-3.5 h-3.5" />}
                  <span>{editingPropertyLoadingId === property.id ? (language === 'es' ? 'Cargando' : 'Loading') : (language === 'es' ? 'Gestionar' : 'Manage')}</span>
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => void onOpenPublish()}
          disabled={publisherGateLoading}
          className="border-2 border-dashed border-brand-gray-200/80 hover:border-brand-black hover:bg-white rounded-3xl aspect-[4/3] w-full flex flex-col items-center justify-center gap-3 transition-all duration-300 shadow-premium hover:shadow-floating bg-brand-gray-50 cursor-pointer"
        >
          <div className="p-3 bg-brand-gray-100 rounded-full text-brand-gray-500 group-hover:scale-105 transition-transform duration-200">
            <Plus className="w-5 h-5 text-brand-black" />
          </div>
          <div className="text-center px-4">
            <p className="text-sm font-bold text-brand-black">{t('dashboard.listAnotherHome')}</p>
            <p className="text-xs text-brand-gray-500 mt-0.5">{t('dashboard.listAnotherHomeDesc')}</p>
          </div>
        </button>
      </div>
    </div>
  );
}
