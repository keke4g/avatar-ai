'use client';

import type { LucideIcon } from 'lucide-react';
import {
  Building,
  Calendar,
  Compass,
  Heart,
  Loader2,
  MessageSquare,
  Plus,
  Settings,
  ShieldCheck,
  Star,
} from 'lucide-react';
import ProfileAvatar from '@/components/ProfileAvatar';
import { useTranslation, type LanguageType } from '@/lib/context/LanguageContext';
import type { User } from '@/lib/types';
import type { DashboardTab, DashboardTabCounts } from './dashboardTypes';

interface DashboardHeaderProps {
  user: User;
  language: LanguageType;
  publisherGateLoading: boolean;
  onOpenPublish: () => void;
  onOpenSettings: () => void;
}

export function DashboardHeader({
  user,
  language,
  publisherGateLoading,
  onOpenPublish,
  onOpenSettings,
}: DashboardHeaderProps) {
  const { t } = useTranslation();

  return (
    <div className="bg-white border border-brand-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-premium mb-10 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
      <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-brand-accent/5 filter blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10 text-center sm:text-left">
        <ProfileAvatar
          src={user.avatar}
          name={user.name}
          className="h-16 w-16 border-2 border-white shadow-md ring-4 ring-brand-accent/5"
          textClassName="text-xl"
        />
        <div>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-brand-black tracking-tight">{user.name}</h1>
            {user.isVerified && (
              <div className="glass px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider text-brand-accent flex items-center gap-1 bg-white/95">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('dashboard.verifiedBadge')}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-brand-gray-500 font-medium">
            {user.joinDate
              ? `${language === 'es' ? 'Miembro desde' : 'Member since'} ${new Date(user.joinDate).toLocaleDateString(
                language === 'es' ? 'es-MX' : 'en-US',
                { month: 'long', year: 'numeric' },
              )}`
              : (language === 'es' ? 'Fecha de registro no disponible' : 'Join date unavailable')}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenPublish}
          disabled={publisherGateLoading}
          className="px-5 py-3 bg-brand-black hover:bg-brand-black/90 text-white rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 hover:scale-[1.02] transition-all cursor-pointer"
        >
          {publisherGateLoading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Plus className="w-4 h-4" />}
          <span>{t('dashboard.tabCreate')}</span>
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="p-3 border border-brand-gray-200 hover:border-brand-black text-brand-gray-500 hover:text-brand-black rounded-full transition-colors cursor-pointer"
          title={t('dashboard.settingsBtn')}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface DashboardTabsProps {
  activeTab: DashboardTab;
  counts: DashboardTabCounts;
  language: LanguageType;
  onTabChange: (tab: DashboardTab) => void;
}

interface DashboardTabItem {
  id: DashboardTab;
  label: string;
  Icon: LucideIcon;
  count: number;
  emphasizeCount?: boolean;
}

export function DashboardTabs({
  activeTab,
  counts,
  language,
  onTabChange,
}: DashboardTabsProps) {
  const { t } = useTranslation();
  const items: DashboardTabItem[] = [
    { id: 'properties', label: t('dashboard.tabListings'), Icon: Building, count: counts.properties },
    { id: 'leads', label: language === 'es' ? 'Leads recibidos' : 'Received leads', Icon: MessageSquare, count: counts.leads },
    { id: 'favorites', label: t('dashboard.tabFavorites'), Icon: Heart, count: counts.favorites },
    { id: 'trips', label: t('dashboard.tabTrips'), Icon: Compass, count: counts.trips },
    { id: 'reviews', label: language === 'es' ? 'Mis Reseñas' : 'My Reviews', Icon: Star, count: counts.reviews },
    { id: 'swaps', label: t('dashboard.tabTimeline'), Icon: Calendar, count: counts.pendingSwaps, emphasizeCount: true },
  ];

  return (
    <div className="flex border-b border-brand-gray-200/80 mb-8 overflow-x-auto no-scrollbar">
      {items.map(({ id, label, Icon, count, emphasizeCount }) => (
        <button
          key={id}
          type="button"
          onClick={() => onTabChange(id)}
          className={`px-6 py-3 font-bold text-sm tracking-tight outline-none border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === id
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-brand-gray-500 hover:text-brand-black'
          }`}
        >
          <Icon className="w-4 h-4" />
          <span>{label}</span>
          {(!emphasizeCount || count > 0) && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              emphasizeCount
                ? 'bg-brand-accent text-white animate-pulse'
                : 'bg-brand-gray-100 text-brand-gray-500'
            }`}>
              {count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
