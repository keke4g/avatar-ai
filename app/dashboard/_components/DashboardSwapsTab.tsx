'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import { Check, Compass, MessageSquare, X } from 'lucide-react';

import { useTranslation } from '@/lib/context/LanguageContext';
import type { Property, SwapRequest } from '@/lib/types';

interface DashboardSwapsTabProps {
  incomingSwaps: SwapRequest[];
  outgoingSwaps: SwapRequest[];
  properties: Property[];
  ownedProperties: Property[];
  onAcceptSwap: (swapId: string) => void;
  onDeclineSwap: (swapId: string) => void;
  onOpenMessages: (swapId: string) => void;
  onExplore: () => void;
}

function SwapStatusBadge({ status }: Pick<SwapRequest, 'status'>) {
  const { t } = useTranslation();
  const label = status === 'PENDING'
    ? t('dashboard.statusPending')
    : status === 'APPROVED'
      ? t('dashboard.statusApproved')
      : t('dashboard.statusDeclined');
  const className = status === 'PENDING'
    ? 'bg-amber-50 text-amber-600 border border-amber-200/30'
    : status === 'APPROVED'
      ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/30'
      : 'bg-brand-gray-100 text-brand-gray-400';

  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${className}`}>
      {label}
    </span>
  );
}

export function DashboardSwapsTab({
  incomingSwaps,
  outgoingSwaps,
  properties,
  ownedProperties,
  onAcceptSwap,
  onDeclineSwap,
  onOpenMessages,
  onExplore,
}: DashboardSwapsTabProps) {
  const { t } = useTranslation();
  const propertyById = useMemo(
    () => new Map(properties.map((property) => [property.id, property])),
    [properties],
  );
  const ownedPropertyById = useMemo(
    () => new Map(ownedProperties.map((property) => [property.id, property])),
    [ownedProperties],
  );

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h2 className="text-base font-bold text-brand-black tracking-tight mb-4 flex items-center gap-2">
          <span>{t('dashboard.receivedSwapProposals')}</span>
          <span className="text-xs font-normal text-brand-gray-500">{t('dashboard.receivedSwapProposalsDesc')}</span>
        </h2>

        {incomingSwaps.length > 0 ? (
          <div className="flex flex-col gap-4">
            {incomingSwaps.map((swap) => {
              const requesterProperty = propertyById.get(swap.senderPropertyId);
              const ownedProperty = ownedPropertyById.get(swap.receiverPropertyId);

              return (
                <div
                  key={swap.id}
                  className="bg-white border border-brand-gray-200/80 rounded-3xl p-5 shadow-premium flex flex-col md:flex-row justify-between items-stretch gap-6"
                >
                  <div className="flex-1 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-brand-gray-100 shadow-sm border border-brand-gray-100">
                      {/* Property media can use arbitrary publisher-provided hosts. */}
                      {requesterProperty?.images[0] ? (
                        <Image
                          src={requesterProperty.images[0]}
                          alt={requesterProperty.title}
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </div>

                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                        <SwapStatusBadge status={swap.status} />
                        <span className="text-[10px] text-brand-gray-500 font-medium">
                          {t('details.proposedStart')}: {swap.startDate} {t('details.proposedEnd').toLowerCase()}: {swap.endDate}
                        </span>
                      </div>

                      <p className="text-sm font-bold text-brand-black truncate">
                        {t('messages.checklistHost')}: {requesterProperty?.title}
                      </p>
                      <p className="text-xs text-brand-gray-500 truncate mb-1">
                        {t('messages.checklistGuest')}: <span className="font-semibold text-brand-black">{ownedProperty?.title}</span>
                      </p>
                      <p className="text-xs text-brand-gray-500 line-clamp-1 italic font-normal bg-brand-gray-50 p-2 rounded-xl border border-brand-gray-100">
                        &ldquo;{swap.message}&rdquo;
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col justify-end md:justify-center items-center gap-2 border-t md:border-t-0 md:border-l border-brand-gray-100 pt-4 md:pt-0 md:pl-6 shrink-0">
                    {swap.status === 'PENDING' ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onAcceptSwap(swap.id)}
                          className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-full text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{t('messages.acceptProposalBtn')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeclineSwap(swap.id)}
                          className="px-4 py-2 border border-brand-gray-200 hover:bg-brand-rose/5 hover:border-brand-rose hover:text-brand-rose text-brand-gray-500 rounded-full text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>{t('messages.declineProposalBtn')}</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-brand-gray-500 bg-brand-gray-100 px-3 py-1.5 rounded-full flex items-center gap-1">
                        {swap.status === 'APPROVED' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : null}
                        <span>{swap.status === 'APPROVED' ? t('dashboard.statusApproved') : t('dashboard.statusDeclined')}</span>
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenMessages(swap.id)}
                      className="px-4 py-2 border border-brand-gray-200 hover:border-brand-black text-brand-black rounded-full text-xs font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-brand-gray-400" />
                      <span>{t('nav.messages')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-10 bg-white rounded-3xl border border-brand-gray-200/50 shadow-premium p-6 text-xs text-brand-gray-500">
            {t('dashboard.noSwapsReceived')}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-base font-bold text-brand-black tracking-tight mb-4 flex items-center gap-2">
          <span>{t('dashboard.sentSwapProposals')}</span>
          <span className="text-xs font-normal text-brand-gray-500">{t('dashboard.sentSwapProposalsDesc')}</span>
        </h2>

        {outgoingSwaps.length > 0 ? (
          <div className="flex flex-col gap-4">
            {outgoingSwaps.map((swap) => {
              const receiverProperty = propertyById.get(swap.receiverPropertyId);
              const ownedProperty = ownedPropertyById.get(swap.senderPropertyId);

              return (
                <div
                  key={swap.id}
                  className="bg-white border border-brand-gray-200/80 rounded-3xl p-5 shadow-premium flex flex-col md:flex-row justify-between items-stretch gap-6 animate-in fade-in"
                >
                  <div className="flex-1 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="relative w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-brand-gray-100 shadow-sm border border-brand-gray-100">
                      {receiverProperty?.images[0] ? (
                        <Image
                          src={receiverProperty.images[0]}
                          alt={receiverProperty.title}
                          fill
                          sizes="80px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : null}
                    </div>

                    <div className="overflow-hidden">
                      <div className="flex items-center gap-2 mb-1">
                        <SwapStatusBadge status={swap.status} />
                        <span className="text-[10px] text-brand-gray-500 font-medium">
                          {t('details.proposedStart')}: {swap.startDate} {t('details.proposedEnd').toLowerCase()}: {swap.endDate}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-brand-black truncate">
                        {t('messages.checklistHost')}: {receiverProperty?.title}
                      </p>
                      <p className="text-xs text-brand-gray-500 truncate mb-1">
                        {t('messages.checklistGuest')}: <span className="font-semibold text-brand-black">{ownedProperty?.title}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-row md:flex-col justify-end md:justify-center items-center gap-2 border-t md:border-t-0 md:border-l border-brand-gray-100 pt-4 md:pt-0 md:pl-6 shrink-0">
                    <button
                      type="button"
                      onClick={() => onOpenMessages(swap.id)}
                      className="px-5 py-2.5 bg-brand-black hover:bg-brand-black/90 text-white rounded-full text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <MessageSquare className="w-4.5 h-4.5" />
                      <span>{t('messages.goChatBtn')}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-3xl border border-brand-gray-200/50 shadow-premium p-6 flex flex-col items-center">
            <Compass className="w-8 h-8 text-brand-gray-300 mb-2" />
            <p className="text-xs text-brand-gray-500 max-w-sm mb-4">{t('dashboard.noSwapsSent')}</p>
            <button type="button" onClick={onExplore} className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-bold rounded-full">
              {t('dashboard.browseSpaces')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
