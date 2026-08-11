"use client";

import React from 'react';
import Link from 'next/link';
import { useTranslation } from '../lib/context/LanguageContext';
import BrandLogo from './BrandLogo';

export default function Footer() {
  const { t, language } = useTranslation();

  return (
    <footer className="border-t border-brand-gray-200/80 bg-white py-12 px-6 sm:px-12 md:px-24">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BrandLogo markClassName="h-8 w-8" textClassName="text-lg" />
          </div>
          <p className="text-sm text-brand-gray-500 max-w-sm leading-relaxed font-semibold">
            {t('footer.tagline')}
          </p>
        </div>
        
        <div className="flex flex-wrap gap-x-12 gap-y-4 text-sm text-brand-gray-500 font-semibold">
          <Link href="/info/seguridad" className="hover:text-brand-accent transition-colors">{t('footer.safety')}</Link>
          <Link href="/info/como-funciona" className="hover:text-brand-accent transition-colors">{t('footer.howWorks')}</Link>
          <Link href="/info/estandares" className="hover:text-brand-accent transition-colors">{t('footer.standards')}</Link>
          <Link href="/info/tarifas" className="hover:text-brand-accent transition-colors">{t('footer.fees')}</Link>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto border-t border-brand-gray-100 mt-10 pt-6 flex flex-col sm:flex-row justify-between text-xs text-brand-gray-500 gap-4 font-semibold">
        <span>{t('footer.copyright')}</span>
        <div className="flex gap-4">
          <Link href="/info/privacidad" className="hover:text-brand-accent transition-colors">{t('footer.privacy')}</Link>
          <Link href="/info/terminos" className="hover:text-brand-accent transition-colors">{t('footer.terms')}</Link>
          <Link href="/info/eliminar-cuenta" className="hover:text-brand-accent transition-colors">
            {language === 'es' ? 'Eliminar cuenta' : 'Delete account'}
          </Link>
          <Link href="/info/cookies" className="hover:text-brand-accent transition-colors">{t('footer.cookies')}</Link>
        </div>
      </div>
    </footer>
  );
}
