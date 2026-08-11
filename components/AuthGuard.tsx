"use client";

import React, { useSyncExternalStore } from 'react';
import { useSwap } from '../lib/context/SwapContext';
import { useTranslation } from '../lib/context/LanguageContext';
import { useRouter } from 'next/navigation';
import { Lock, AlertOctagon, ArrowLeft, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import type { UserRole } from '../lib/types';

interface AuthGuardProps {
  children?: React.ReactNode;
  requireAdmin?: boolean;
  allowedRoles?: UserRole[];
}

const subscribeToHydration = () => () => {};

export default function AuthGuard({
  children,
  requireAdmin = false,
  allowedRoles,
}: AuthGuardProps) {
  const { currentUser, isLoggingOut } = useSwap();
  const { t } = useTranslation();
  const router = useRouter();
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  if (!isHydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-gray-50/50 px-6">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-brand-gray-200 border-t-brand-accent" />
      </div>
    );
  }

  // 0. TRANSITIONAL LOGOUT STATE
  if (isLoggingOut) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gray-50/50 px-6 relative overflow-hidden">
        {/* Glow ambient background lights */}
        <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-brand-accent/5 filter blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-20 left-10 w-80 h-80 rounded-full bg-brand-rose/5 filter blur-3xl pointer-events-none -z-10" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="max-w-sm w-full bg-white border border-brand-gray-200/80 rounded-3xl p-8 shadow-floating text-center relative flex flex-col items-center gap-4"
        >
          <div className="w-10 h-10 rounded-full border-2 border-brand-gray-200 border-t-brand-accent animate-spin" />
          <span className="text-[10px] uppercase font-black tracking-widest text-brand-gray-400">
            {t('guards.signingOut')}
          </span>
        </motion.div>
      </div>
    );
  }

  // 1. 401 UNAUTHORIZED CHECK
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gray-50/50 px-6 relative overflow-hidden">
        {/* Glow ambient background lights */}
        <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-brand-accent/5 filter blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-20 left-10 w-80 h-80 rounded-full bg-brand-rose/5 filter blur-3xl pointer-events-none -z-10" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="max-w-md w-full bg-white border border-brand-gray-200/80 rounded-3xl p-8 shadow-floating text-center relative"
        >
          <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-brand-accent/5 filter blur-xl pointer-events-none" />
          
          <div className="w-16 h-16 rounded-2xl bg-brand-black flex items-center justify-center mx-auto mb-6 text-white shadow-glow">
            <Lock className="w-7 h-7 text-brand-accent animate-pulse" />
          </div>

          <span className="text-[9px] uppercase font-black tracking-widest text-brand-gray-400">Error 401</span>
          
          <h1 className="text-2xl font-black text-brand-black tracking-tight mt-2 mb-3">
            {t('guards.title401')}
          </h1>
          
          <p className="text-xs text-brand-gray-500 font-semibold leading-relaxed mb-8">
            {t('guards.desc401')}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => router.push('/login')}
              className="w-full py-3.5 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-colors shadow-premium cursor-pointer flex items-center justify-center gap-2"
            >
              <KeyRound className="w-3.5 h-3.5 text-brand-accent" />
              <span>{t('guards.btn401')}</span>
            </button>
            
            <button
              onClick={() => router.push('/explore')}
              className="w-full py-3.5 px-6 rounded-full border border-brand-gray-200 hover:bg-brand-gray-50 text-brand-black font-bold text-xs tracking-wider uppercase transition-all cursor-pointer"
            >
              {t('explore.resetFiltersBtn') || 'Volver'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  // 2. 403 FORBIDDEN CHECK
  const roleDenied = requireAdmin
    ? currentUser.role !== 'ADMIN'
    : Boolean(allowedRoles && !allowedRoles.includes(currentUser.role));

  if (roleDenied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-gray-50/50 px-6 relative overflow-hidden">
        {/* Glow ambient background lights */}
        <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-brand-accent/5 filter blur-3xl pointer-events-none -z-10" />
        <div className="absolute bottom-20 left-10 w-80 h-80 rounded-full bg-brand-rose/5 filter blur-3xl pointer-events-none -z-10" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="max-w-md w-full bg-white border border-brand-gray-200/80 rounded-3xl p-8 shadow-floating text-center relative"
        >
          <div className="absolute -top-10 -left-10 w-32 h-32 rounded-full bg-brand-rose/5 filter blur-xl pointer-events-none" />
          
          <div className="w-16 h-16 rounded-2xl bg-brand-rose/10 flex items-center justify-center mx-auto mb-6 text-brand-rose shadow-sm">
            <AlertOctagon className="w-7 h-7" />
          </div>

          <span className="text-[9px] uppercase font-black tracking-widest text-brand-gray-400">Error 403</span>
          
          <h1 className="text-2xl font-black text-brand-black tracking-tight mt-2 mb-3">
            {t('guards.title403')}
          </h1>
          
          <p className="text-xs text-brand-gray-500 font-semibold leading-relaxed mb-8">
            {t('guards.desc403')}
          </p>

          <button
            onClick={() => router.push('/explore')}
            className="w-full py-3.5 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-colors shadow-premium cursor-pointer flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4 text-brand-accent" />
            <span>{t('guards.btn403')}</span>
          </button>
        </motion.div>
      </div>
    );
  }

  // 3. AUTHORIZED ACCESS - RENDER CHILDREN
  return <>{children}</>;
}
