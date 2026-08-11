'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertCircle,
  Building,
  CheckCircle,
  MapPin,
  RefreshCw,
  TrendingUp,
  Users,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from '@/lib/context/LanguageContext';
import type {
  AdminAuditEntry,
  AdminCountryMetric,
  AdminDashboardStats,
} from './adminTypes';

interface AdminOverviewTabProps {
  stats: AdminDashboardStats;
  countryMetrics: AdminCountryMetric[];
  totalProperties: number;
  auditLog: AdminAuditEntry[];
}

interface MetricCardProps {
  label: string;
  value: ReactNode;
  note: string;
  noteClassName: string;
  Icon: LucideIcon;
  iconClassName: string;
}

function MetricCard({
  label,
  value,
  note,
  noteClassName,
  Icon,
  iconClassName,
}: MetricCardProps) {
  return (
    <div className="bg-white border border-brand-gray-200/70 p-5 rounded-3xl shadow-premium relative overflow-hidden flex flex-col justify-between min-h-[120px]">
      <div className="flex justify-between items-start">
        <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-500 leading-tight">
          {label}
        </span>
        <Icon className={`w-4 h-4 ${iconClassName}`} />
      </div>
      <div className="mt-4">
        <span className="text-3xl font-black text-brand-black leading-none tracking-tight">{value}</span>
        <p className={`text-[10px] font-bold mt-1 ${noteClassName}`}>{note}</p>
      </div>
    </div>
  );
}

export function AdminOverviewTab({
  stats,
  countryMetrics,
  totalProperties,
  auditLog,
}: AdminOverviewTabProps) {
  const { t } = useTranslation();
  const metricCards: MetricCardProps[] = [
    {
      label: t('admin.metricActiveProps'),
      value: stats.activeProperties,
      note: t('admin.systemActive'),
      noteClassName: 'text-emerald-500',
      Icon: Building,
      iconClassName: 'text-brand-accent',
    },
    {
      label: t('admin.metricTotalUsers'),
      value: stats.totalUsers,
      note: '↑ 14.8%',
      noteClassName: 'text-emerald-500',
      Icon: Users,
      iconClassName: 'text-brand-accent',
    },
    {
      label: t('admin.metricCompletedSwaps'),
      value: stats.completedSwaps,
      note: t('admin.successRate'),
      noteClassName: 'text-brand-accent',
      Icon: RefreshCw,
      iconClassName: 'text-brand-accent',
    },
    {
      label: t('admin.metricPendingSwaps'),
      value: stats.pendingSwaps,
      note: t('admin.tabModeration'),
      noteClassName: 'text-brand-gray-400',
      Icon: AlertCircle,
      iconClassName: 'text-amber-500',
    },
    {
      label: t('admin.metricVerifiedHosts'),
      value: stats.verifiedHosts,
      note: t('admin.confidenceMetric'),
      noteClassName: 'text-emerald-500',
      Icon: CheckCircle,
      iconClassName: 'text-emerald-500',
    },
    {
      label: t('admin.growthPercent'),
      value: `+${stats.growthPercent}%`,
      note: t('admin.growthTarget'),
      noteClassName: 'text-brand-accent',
      Icon: TrendingUp,
      iconClassName: 'text-emerald-500',
    },
  ];

  const renderAuditTime = (time: string) => {
    if (time === 'justNow') return t('admin.auditJustNow');
    if (time.endsWith('m')) return t('admin.auditMinsAgo', { minutes: time.replace('m', '') });
    if (time.endsWith('h')) return t('admin.auditHrsAgo', { hours: time.replace('h', '') });
    if (time.endsWith('d')) return t('admin.auditDaysAgo', { days: time.replace('d', '') });
    return time;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex flex-col gap-8"
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {metricCards.map((metric) => <MetricCard key={metric.label} {...metric} />)}
      </div>

      <div className="bg-white border border-brand-gray-200/70 p-6 sm:p-8 rounded-3xl shadow-premium">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-sm font-black text-brand-black tracking-tight">{t('admin.growthTrendTitle')}</h2>
            <p className="text-[11px] text-brand-gray-500 mt-0.5">{t('admin.growthTrendDesc')}</p>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-brand-accent inline-block" />
              <span className="text-brand-black">{t('admin.propsLegend')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span className="text-brand-black">{t('admin.swapsLegend')}</span>
            </div>
          </div>
        </div>

        <div className="w-full h-64 relative">
          <svg viewBox="0 0 500 200" width="100%" height="100%" className="overflow-visible">
            <defs>
              <linearGradient id="gradientProp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gradientSwap" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
            </defs>
            <line x1="0" y1="20" x2="500" y2="20" stroke="#f4f4f5" strokeWidth="1" />
            <line x1="0" y1="70" x2="500" y2="70" stroke="#f4f4f5" strokeWidth="1" />
            <line x1="0" y1="120" x2="500" y2="120" stroke="#f4f4f5" strokeWidth="1" />
            <line x1="0" y1="170" x2="500" y2="170" stroke="#f4f4f5" strokeWidth="1" strokeDasharray="3,3" />
            <path d="M 0 170 C 62.5 130, 62.5 130, 125 110 C 187.5 100, 187.5 100, 250 100 C 312.5 90, 312.5 90, 375 90 C 437.5 70, 437.5 70, 500 50 L 500 170 L 0 170 Z" fill="url(#gradientProp)" />
            <path d="M 0 170 C 62.5 160, 62.5 160, 125 150 C 187.5 140, 187.5 140, 250 140 C 312.5 130, 312.5 130, 375 130 C 437.5 120, 437.5 120, 500 110 L 500 170 L 0 170 Z" fill="url(#gradientSwap)" />
            <path d="M 0 170 C 62.5 130, 62.5 130, 125 110 C 187.5 100, 187.5 100, 250 100 C 312.5 90, 312.5 90, 375 90 C 437.5 70, 437.5 70, 500 50" fill="none" stroke="#6366f1" strokeWidth="3" strokeLinecap="round" />
            <path d="M 0 170 C 62.5 160, 62.5 160, 125 150 C 187.5 140, 187.5 140, 250 140 C 312.5 130, 312.5 130, 375 130 C 437.5 120, 437.5 120, 500 110" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
            {[0, 125, 250, 375, 500].map((cx, index) => (
              <circle key={`property-${cx}`} cx={cx} cy={[170, 110, 100, 90, 50][index]} r="4" fill="#ffffff" stroke="#6366f1" strokeWidth="2" />
            ))}
            {[0, 125, 250, 375, 500].map((cx, index) => (
              <circle key={`swap-${cx}`} cx={cx} cy={[170, 150, 140, 130, 110][index]} r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
            ))}
            {['Jan', 'Feb', 'Mar', 'Apr', 'May'].map((month, index) => (
              <text key={month} x={index * 125} y="190" fill="#a1a1aa" fontSize="8" fontWeight="bold" textAnchor="middle">{month}</text>
            ))}
          </svg>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="md:col-span-2 bg-white border border-brand-gray-200/70 p-6 rounded-3xl shadow-premium flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black text-brand-black tracking-tight mb-1">{t('admin.countryListingTitle')}</h3>
            <p className="text-[10px] text-brand-gray-500 mb-6">{t('admin.countryListingDesc')}</p>
            <div className="flex flex-col gap-4">
              {countryMetrics.map((country, index) => {
                const percentage = Math.min(100, Math.max(10, (country.value / totalProperties) * 100));
                return (
                  <div key={country.name} className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center text-[10px] font-bold">
                      <span className="text-brand-black flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-brand-accent/70" />
                        {country.name || 'Other'}
                      </span>
                      <span className="text-brand-gray-500">
                        {country.value} {country.value === 1 ? t('admin.anuncioLabel') : t('admin.anunciosLabel')}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-brand-gray-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{ duration: 0.8, delay: index * 0.1 }}
                        className="h-full bg-brand-accent rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="md:col-span-3 bg-white border border-brand-gray-200/70 p-6 rounded-3xl shadow-premium flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black text-brand-black tracking-tight mb-1">{t('admin.auditTitle')}</h3>
            <p className="text-[10px] text-brand-gray-500 mb-4">{t('admin.auditDesc')}</p>
            <div className="flex flex-col gap-3">
              {auditLog.map((log) => (
                <div key={log.id} className="flex items-start justify-between gap-3 text-[10px] pb-3 border-b border-brand-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-start gap-2.5">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase shrink-0 mt-0.5 ${
                      log.status === 'success' ? 'bg-emerald-500/10 text-emerald-600'
                        : log.status === 'alert' ? 'bg-rose-500/10 text-rose-600'
                          : log.status === 'pending' ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-brand-accent/10 text-brand-accent'
                    }`}>
                      {log.type}
                    </span>
                    <p className="text-brand-black font-semibold line-clamp-1">{t(`admin.${log.key}`, log.params)}</p>
                  </div>
                  <span className="text-brand-gray-400 font-bold shrink-0">{renderAuditTime(log.time)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
