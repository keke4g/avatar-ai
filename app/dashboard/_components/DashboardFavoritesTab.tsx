'use client';

import { Heart } from 'lucide-react';
import PropertyCard from '@/components/PropertyCard';
import { useTranslation } from '@/lib/context/LanguageContext';
import type { Property } from '@/lib/types';

interface DashboardFavoritesTabProps {
  properties: Property[];
  onExplore: () => void;
}

export function DashboardFavoritesTab({
  properties,
  onExplore,
}: DashboardFavoritesTabProps) {
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-bold text-brand-black tracking-tight">
            {t('dashboard.yourFavoritedSpaces')}
          </h2>
          <p className="text-xs text-brand-gray-500 font-medium">
            {t('dashboard.yourFavoritedSpacesDesc')}
          </p>
        </div>
      </div>

      {properties.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {properties.map((property) => (
            <PropertyCard key={property.id} property={property} />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-3xl border border-brand-gray-200/50 shadow-premium p-8">
          <Heart className="w-10 h-10 text-brand-gray-300 mx-auto mb-3" />
          <h3 className="font-bold text-brand-black text-sm mb-1">
            {t('dashboard.noFavoritesTitle')}
          </h3>
          <p className="text-brand-gray-500 text-xs max-w-sm mx-auto mb-4">
            {t('dashboard.noFavoritesDesc')}
          </p>
          <button
            type="button"
            onClick={onExplore}
            className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-full text-xs font-bold"
          >
            {t('dashboard.exploreHomes')}
          </button>
        </div>
      )}
    </div>
  );
}
