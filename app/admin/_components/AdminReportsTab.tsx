'use client';

import { FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { launchConfetti } from '@/components/runtime/launchConfetti';
import { useTranslation } from '@/lib/context/LanguageContext';

interface AdminReportsTabProps {
  totalSwaps: number;
  approvedSwaps: number;
  verificationFee: number;
  commissionRate: number;
  featuredProperties: number;
  totalProperties: number;
  verifiedUsers: number;
}

export function AdminReportsTab({
  totalSwaps,
  approvedSwaps,
  verificationFee,
  commissionRate,
  featuredProperties,
  totalProperties,
  verifiedUsers,
}: AdminReportsTabProps) {
  const { t } = useTranslation();
  const verificationRevenue = totalSwaps * verificationFee;
  const commissionRevenue = approvedSwaps * 150 * (commissionRate / 100);

  const handleExport = () => {
    launchConfetti({ particleCount: 60, spread: 45 });
    window.alert('Exporting Ledger PDF...');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white border border-brand-gray-200/70 rounded-3xl shadow-premium p-6 sm:p-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-brand-gray-100">
        <div>
          <h2 className="text-base font-black text-brand-black tracking-tight">{t('admin.reportsTitle')}</h2>
          <p className="text-xs text-brand-gray-500 mt-0.5">{t('admin.reportsDesc')}</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1 px-4 py-2 border border-brand-gray-200 rounded-xl hover:bg-brand-gray-50 text-xs font-bold text-brand-black select-none cursor-pointer"
        >
          <FileText className="w-4 h-4 text-brand-accent" />
          <span>{t('admin.reportsExport')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="border border-brand-gray-150 p-5 rounded-2xl bg-brand-gray-50/50">
          <span className="text-[9px] font-black uppercase tracking-wider text-brand-gray-500">{t('admin.reportsVerifFees')}</span>
          <h3 className="text-2xl font-black text-brand-black tracking-tight mt-2">{verificationRevenue.toFixed(2)}€</h3>
          <p className="text-[10px] text-brand-gray-400 font-bold mt-1">{t('admin.reportsVerifSub', { count: totalSwaps, fee: verificationFee })}</p>
        </div>
        <div className="border border-brand-gray-150 p-5 rounded-2xl bg-brand-gray-50/50">
          <span className="text-[9px] font-black uppercase tracking-wider text-brand-gray-500">{t('admin.reportsCommFees')}</span>
          <h3 className="text-2xl font-black text-brand-black tracking-tight mt-2">{commissionRevenue.toFixed(2)}€</h3>
          <p className="text-[10px] text-brand-gray-400 font-bold mt-1">{t('admin.reportsCommSub', { rate: commissionRate })}</p>
        </div>
        <div className="border border-brand-gray-150 p-5 rounded-2xl bg-brand-gray-50/50">
          <span className="text-[9px] font-black uppercase tracking-wider text-brand-gray-500">{t('admin.reportsNetFees')}</span>
          <h3 className="text-2xl font-black text-brand-accent tracking-tight mt-2">{(verificationRevenue + commissionRevenue).toFixed(2)}€</h3>
          <p className="text-[10px] text-emerald-500 font-bold mt-1">{t('admin.reportsNetSub')}</p>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-black text-brand-black tracking-tight mb-4">{t('admin.reportsPerformance')}</h3>
        <div className="border border-brand-gray-150 rounded-2xl overflow-hidden text-xs">
          <div className="bg-brand-gray-50 p-3 border-b border-brand-gray-200 text-brand-gray-500 font-black text-[9px] uppercase tracking-wider flex justify-between">
            <span>{t('admin.reportsMetricName')}</span>
            <span>{t('admin.reportsMetricVal')}</span>
          </div>
          <div className="p-3 border-b border-brand-gray-100 flex justify-between items-center">
            <span className="font-bold text-brand-black">{t('admin.reportsTotalFeat')}</span>
            <span className="font-black text-brand-accent">{t('admin.reportsFeatVal', { featured: featuredProperties, total: totalProperties })}</span>
          </div>
          <div className="p-3 border-b border-brand-gray-100 flex justify-between items-center">
            <span className="font-bold text-brand-black">{t('admin.reportsConvRate')}</span>
            <span className="font-black text-emerald-600">{t('admin.reportsConvVal', { percent: ((approvedSwaps / Math.max(1, totalSwaps)) * 100).toFixed(1) })}</span>
          </div>
          <div className="p-3 flex justify-between items-center">
            <span className="font-bold text-brand-black">{t('admin.reportsKycVerified')}</span>
            <span className="font-black text-brand-black">{t('admin.reportsKycVal', { count: verifiedUsers })}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
