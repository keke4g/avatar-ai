'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  Building,
  CheckCircle,
  FileText,
  RefreshCw,
  Settings,
  Shield,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useTranslation } from '@/lib/context/LanguageContext';
import type { AdminTab } from './adminTypes';

export function AdminHeader() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 pb-6 border-b border-brand-gray-200/60">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-brand-black flex items-center justify-center text-white shadow-glow">
            <Shield className="w-5 h-5 text-brand-accent animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-brand-gray-500">Towers México Network</span>
            <h1 className="text-2xl sm:text-3xl font-black text-brand-black tracking-tight leading-none mt-0.5">
              {t('admin.title')}
            </h1>
          </div>
        </div>
        <p className="text-xs text-brand-gray-500 font-medium">
          Control centralizado de contenidos, usuarios, auditoría de swaps, disputas y ajustes monetarios.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <div className="glass px-3.5 py-2 rounded-full text-xs font-bold text-brand-black border border-brand-gray-200/50 shadow-sm flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span>{t('admin.sysOnline')}</span>
        </div>
      </div>
    </div>
  );
}

interface AdminNavigationProps {
  activeTab: AdminTab;
  propertyReviewCount: number;
  propertyCount: number;
  userCount: number;
  swapCount: number;
  disputedSwapCount: number;
  onTabChange: (tab: AdminTab) => void;
}

interface NavigationItem {
  id: AdminTab;
  label: string;
  Icon: LucideIcon;
  trailing: 'trend' | 'reviewCount' | 'count' | 'dispute' | 'realtime' | 'none';
  count?: number;
}

export function AdminNavigation({
  activeTab,
  propertyReviewCount,
  propertyCount,
  userCount,
  swapCount,
  disputedSwapCount,
  onTabChange,
}: AdminNavigationProps) {
  const { t } = useTranslation();
  const items: NavigationItem[] = [
    { id: 'overview', label: t('admin.tabOverview'), Icon: Activity, trailing: 'trend' },
    { id: 'propertyReviews', label: 'Propiedades por aprobar', Icon: CheckCircle, trailing: 'reviewCount', count: propertyReviewCount },
    { id: 'properties', label: t('admin.tabProperties'), Icon: Building, trailing: 'count', count: propertyCount },
    { id: 'users', label: t('admin.tabUsers'), Icon: Users, trailing: 'count', count: userCount },
    { id: 'swaps', label: t('admin.tabSwaps'), Icon: RefreshCw, trailing: 'count', count: swapCount },
    { id: 'moderation', label: t('admin.tabModeration'), Icon: AlertTriangle, trailing: 'dispute', count: disputedSwapCount },
    { id: 'reports', label: t('admin.reportsTitle'), Icon: FileText, trailing: 'realtime' },
    { id: 'settings', label: t('admin.tabSettings'), Icon: Settings, trailing: 'none' },
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 lg:col-span-1 lg:flex-col lg:overflow-visible lg:pb-0 [&>button]:w-max [&>button]:shrink-0 lg:[&>button]:w-full">
      {items.map(({ id, label, Icon, trailing, count }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            className={`w-full text-left px-5 py-3.5 rounded-2xl text-xs font-black tracking-wide flex items-center justify-between transition-all select-none cursor-pointer ${
              isActive
                ? 'bg-brand-black text-white shadow-premium'
                : 'bg-white hover:bg-brand-gray-50 text-brand-gray-500 hover:text-brand-black border border-brand-gray-200/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </div>

            {trailing === 'trend' && <TrendingUp className="w-3.5 h-3.5 opacity-60" />}
            {trailing === 'reviewCount' && (
              <span className={`min-w-6 rounded-full px-2 py-0.5 text-center text-[9px] font-black ${
                isActive
                  ? 'bg-white/20 text-white'
                  : Number(count) > 0
                    ? 'bg-amber-100 text-amber-700'
                    : 'bg-brand-gray-100 text-brand-gray-500'
              }`}>
                {count}
              </span>
            )}
            {trailing === 'count' && (
              <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${
                isActive ? 'bg-white/20 text-white' : 'bg-brand-gray-100 text-brand-gray-500'
              }`}>
                {count}
              </span>
            )}
            {trailing === 'dispute' && Number(count) > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-brand-rose animate-pulse" />
            )}
            {trailing === 'realtime' && (
              <span className="text-[9px] font-black tracking-wider text-brand-accent uppercase bg-brand-accent/10 px-2 py-0.5 rounded-md">
                Realtime
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
