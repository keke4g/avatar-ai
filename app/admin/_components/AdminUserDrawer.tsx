'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { AlertTriangle, X } from 'lucide-react';

import ProfileAvatar from '@/components/ProfileAvatar';
import { useTranslation } from '@/lib/context/LanguageContext';
import { formatPropertyLocation } from '@/lib/textHelpers';
import type { User } from '@/lib/types';
import type { SelectedAdminUserDetails } from './adminData';

interface AdminUserDrawerProps {
  isOpen: boolean;
  details: SelectedAdminUserDetails | null;
  users: User[];
  onClose: () => void;
  onToggleHostVerified: (userId: string, name: string) => void;
  onToggleSuspension: (userId: string, name: string) => void;
}

export function AdminUserDrawer({
  isOpen,
  details,
  users,
  onClose,
  onToggleHostVerified,
  onToggleSuspension,
}: AdminUserDrawerProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen && details ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-brand-black z-50 cursor-pointer"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:max-w-xl bg-white shadow-floating z-50 overflow-y-auto border-l border-brand-gray-200 flex flex-col"
          >
            <div className="p-6 border-b border-brand-gray-200 bg-brand-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-brand-black tracking-tight">{t('admin.crmDrawerTitle')}</h3>
                <p className="text-[10px] text-brand-gray-400 font-semibold mt-0.5">{t('admin.crmDrawerDesc')}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('admin.crmDrawerClose')}
                className="p-1.5 rounded-full hover:bg-brand-gray-200 transition-colors text-brand-gray-500 hover:text-brand-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-6 overflow-y-auto flex-1">
              <div className="flex items-center gap-4 p-4 border border-brand-gray-200/70 rounded-3xl bg-brand-gray-50/50">
                <ProfileAvatar
                  src={details.user.avatar}
                  name={details.user.name}
                  className="h-14 w-14 border border-white shadow-sm"
                  textClassName="text-base"
                />
                <div>
                  <h4 className="text-sm font-black text-brand-black tracking-tight flex items-center gap-1.5">
                    <span>{details.user.name}</span>
                    {details.user.isVerified ? (
                      <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded">{t('admin.crmDrawerKycOk')}</span>
                    ) : null}
                  </h4>
                  <p className="text-[10px] text-brand-gray-400 font-bold uppercase tracking-wider mt-0.5">{t('admin.crmDrawerRole')} {details.user.role}</p>
                  <p className="text-[9px] text-brand-gray-400 font-semibold mt-1">{t('admin.crmDrawerDetails')} {details.user.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onToggleHostVerified(details.user.id, details.user.name)}
                  className={`py-2.5 px-4 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer text-center ${details.user.isVerified
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'
                    : 'bg-white border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-50'}`}
                >
                  {t('admin.crmDrawerVerifyHost')}
                </button>

                <button
                  type="button"
                  onClick={() => onToggleSuspension(details.user.id, details.user.name)}
                  className={`py-2.5 px-4 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer text-center ${details.user.isSuspended
                    ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100'
                    : 'bg-white border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-50'}`}
                >
                  {details.user.isSuspended ? t('admin.crmDrawerActivate') : t('admin.crmDrawerSuspend')}
                </button>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-brand-black uppercase tracking-wider mb-3">
                  {t('admin.crmDrawerPropsTitle', { count: details.properties.length })}
                </h4>
                {details.properties.length === 0 ? (
                  <p className="text-[10px] text-brand-gray-400 font-bold">{t('admin.crmDrawerNoProps')}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {details.properties.map((property) => (
                      <div key={property.id} className="border border-brand-gray-200/60 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs bg-white">
                        <div className="flex items-center gap-2.5">
                          {/* Sources can be publisher-provided hosts not covered by a safe remotePattern. */}
                          <Image
                            src={property.images[0] || '/property-placeholder.svg'}
                            alt={property.title}
                            width={40}
                            height={28}
                            sizes="40px"
                            className="h-7 w-10 rounded object-cover"
                            unoptimized
                          />
                          <div>
                            <p className="font-bold text-brand-black line-clamp-1">{property.title}</p>
                            <p className="text-[9px] text-brand-gray-400 font-bold mt-0.5">{formatPropertyLocation(property.location, property.country)}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${property.isPublished !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-gray-100 text-brand-gray-400'}`}>
                          {property.isPublished !== false ? t('admin.statusPublished') : t('admin.statusDraft')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-[10px] font-black text-brand-black uppercase tracking-wider mb-3">
                  {t('admin.crmDrawerSwapsTitle', { count: details.swaps.length })}
                </h4>
                {details.swaps.length === 0 ? (
                  <p className="text-[10px] text-brand-gray-400 font-bold">{t('admin.crmDrawerNoSwaps')}</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {details.swaps.map((swap) => {
                      const isSender = swap.senderId === details.user.id;
                      const partner = users.find((user) => user.id === (isSender ? swap.receiverId : swap.senderId));
                      return (
                        <div key={swap.id} className="border border-brand-gray-200 p-4 rounded-2xl bg-white shadow-xs">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-[9px] font-black text-brand-accent uppercase tracking-wider">ID: {swap.id}</span>
                            <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${swap.status === 'APPROVED'
                              ? 'bg-emerald-50 text-emerald-600'
                              : swap.status === 'DECLINED'
                                ? 'bg-rose-50 text-rose-600'
                                : 'bg-amber-50 text-amber-600 animate-pulse'}`}>
                              {swap.status}
                            </span>
                          </div>

                          <p className="text-[10px] text-brand-gray-600 font-semibold mb-2">
                            {isSender ? 'Propuso trueque a' : 'Recibió oferta de'}: <strong>{partner?.name || 'Otro anfitrión'}</strong>
                          </p>

                          <p className="text-[9px] text-brand-gray-400 font-medium bg-brand-gray-50 p-2.5 rounded-lg italic line-clamp-2">
                            &ldquo;{swap.message}&rdquo;
                          </p>

                          <div className="flex items-center justify-between text-[9px] text-brand-gray-400 font-bold mt-3 pt-2.5 border-t border-brand-gray-100">
                            <span>Período: {swap.startDate} al {swap.endDate}</span>
                            {swap.isDisputed ? (
                              <span className="text-rose-600 uppercase font-black tracking-wider animate-pulse flex items-center gap-0.5">
                                <AlertTriangle className="w-3 h-3" /> Disputado
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-brand-gray-100 bg-brand-gray-50">
              <button
                type="button"
                onClick={onClose}
                className="w-full py-3 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-colors shadow-sm select-none cursor-pointer"
              >
                {t('admin.crmDrawerClose')}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
