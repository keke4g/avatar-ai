"use client";

import React from 'react';
import { Compass, Home, Building2, Warehouse, Trees, Store, Briefcase } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '../lib/context/LanguageContext';

interface CategorySliderProps {
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  counts?: Record<string, number>;
}

export default function CategorySlider({ activeCategory, setActiveCategory, counts = {} }: CategorySliderProps) {
  const { t } = useTranslation();

  const CATEGORIES = [
    { id: 'All', label: t('explore.allCategories'), icon: Compass },
    { id: 'Casas', label: t('explore.casas'), icon: Home },
    { id: 'Departamentos', label: t('explore.departamentos'), icon: Building2 },
    { id: 'Lofts', label: t('explore.lofts'), icon: Warehouse },
    { id: 'Terrenos', label: t('explore.terrenos'), icon: Trees },
    { id: 'Locales', label: t('explore.locales'), icon: Store },
    { id: 'Oficinas', label: t('explore.oficinas'), icon: Briefcase },
  ];

  return (
    <div className="w-full border-t border-brand-gray-100 pt-4 sm:pt-5">
      <div
        role="tablist"
        aria-label={t('explore.allCategories')}
        className="flex w-full snap-x snap-mandatory items-stretch gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth sm:gap-2.5"
      >
        {CATEGORIES.map((category) => {
          const isActive = activeCategory === category.id;
          const count = counts[category.id] ?? 0;
          const isDisabled = category.id !== 'All' && count === 0;

          return (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => !isDisabled && setActiveCategory(category.id)}
              disabled={isDisabled}
              className={`group relative flex min-h-[86px] min-w-[104px] snap-start flex-col items-start justify-between overflow-hidden rounded-2xl border px-3 py-3 text-left outline-none transition-all duration-200 sm:min-w-0 sm:flex-1 sm:px-3.5 ${
                isDisabled
                  ? 'cursor-not-allowed border-brand-gray-100 bg-brand-gray-50/60 text-brand-gray-300 opacity-55'
                  : isActive
                    ? 'cursor-pointer border-brand-black bg-brand-black text-white shadow-[0_10px_24px_rgba(10,10,12,0.14)]'
                    : 'cursor-pointer border-brand-gray-200 bg-white text-brand-gray-600 hover:-translate-y-0.5 hover:border-brand-gray-300 hover:text-brand-black hover:shadow-sm'
              }`}
            >
              <span className={`flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
                isDisabled
                  ? 'bg-white text-brand-gray-300'
                  : isActive
                    ? 'bg-white/14 text-white'
                    : 'bg-brand-gray-50 text-brand-gray-500 group-hover:bg-brand-gray-100 group-hover:text-brand-black'
              }`}>
                <category.icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
              </span>

              <span className="flex w-full items-end justify-between gap-2">
                <span className="truncate text-[11px] font-extrabold tracking-tight sm:text-xs">
                  {category.label}
                </span>
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black tabular-nums ${
                  isActive ? 'bg-white/14 text-white/85' : 'bg-brand-gray-100 text-brand-gray-500'
                }`}>
                  {count}
                </span>
              </span>
              
              {isActive && (
                <motion.div
                  layoutId="activeCategoryUnderline"
                  className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-brand-accent"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
