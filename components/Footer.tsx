"use client";

import React from 'react';
import { useTranslation } from '../lib/context/LanguageContext';

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-brand-gray-200/80 bg-white py-12 px-6 sm:px-12 md:px-24">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center shadow-glow">
              <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
            </div>
            <span className="font-bold text-lg tracking-tight">Aura<span className="text-brand-accent">Swap</span></span>
          </div>
          <p className="text-sm text-brand-gray-500 max-w-sm leading-relaxed font-semibold">
            {t('footer.tagline')}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-x-12 gap-y-4 text-sm text-brand-gray-500 font-semibold">
          <a href="#" className="hover:text-brand-accent transition-colors">{t('footer.safety')}</a>
          <a href="#" className="hover:text-brand-accent transition-colors">{t('footer.howWorks')}</a>
          <a href="#" className="hover:text-brand-accent transition-colors">{t('footer.standards')}</a>
          <a href="#" className="hover:text-brand-accent transition-colors">{t('footer.fees')}</a>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto border-t border-brand-gray-100 mt-10 pt-6 flex flex-col sm:flex-row justify-between text-xs text-brand-gray-500 gap-4 font-semibold">
        <span>{t('footer.copyright')}</span>
        <div className="flex gap-4">
          <a href="#" className="hover:text-brand-accent transition-colors">{t('footer.privacy')}</a>
          <a href="#" className="hover:text-brand-accent transition-colors">{t('footer.terms')}</a>
          <a href="#" className="hover:text-brand-accent transition-colors">{t('footer.cookies')}</a>
        </div>
      </div>
    </footer>
  );
}
