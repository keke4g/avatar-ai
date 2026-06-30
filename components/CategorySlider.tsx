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
    <div className="w-full border-b border-brand-gray-200/80 bg-white/50 backdrop-blur-md sticky top-[72px] z-30 py-4 px-6 sm:px-12 md:px-24">
      <div className="max-w-7xl mx-auto flex items-center justify-start overflow-x-auto gap-8 no-scrollbar scroll-smooth">
        {CATEGORIES.map((category) => {
          const isActive = activeCategory === category.id;
          const count = counts[category.id] ?? 0;
          const isDisabled = category.id !== 'All' && count === 0;

          return (
            <button
              key={category.id}
              onClick={() => !isDisabled && setActiveCategory(category.id)}
              disabled={isDisabled}
              className={`relative flex flex-col items-center gap-2 pb-2.5 outline-none group transition-colors duration-200 shrink-0 ${
                isDisabled
                  ? 'opacity-35 cursor-not-allowed text-brand-gray-300'
                  : isActive
                    ? 'text-brand-accent cursor-pointer'
                    : 'text-brand-gray-500 hover:text-brand-black cursor-pointer'
              }`}
            >
              <category.icon className={`w-5 h-5 transition-transform duration-200 ${
                isDisabled
                  ? 'text-brand-gray-300'
                  : isActive
                    ? 'text-brand-accent'
                    : 'text-brand-gray-400 group-hover:text-brand-black group-hover:scale-105'
              }`} />
              <span className="text-xs font-semibold tracking-tight">
                {category.label} ({count})
              </span>
              
              {isActive && (
                <motion.div
                  layoutId="activeCategoryUnderline"
                  className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-accent rounded-full"
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
