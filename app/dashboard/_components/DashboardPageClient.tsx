"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useSwap } from '@/lib/context/SwapContext';
import { useTranslation } from '@/lib/context/LanguageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatPropertyLocation } from '@/lib/textHelpers';
import { 
  Calendar, ShieldCheck, Check, X, 
  MessageSquare, Star, Settings, FileText, Compass, Sparkles, AlertTriangle,
  Eye, EyeOff, MapPin, Copy, Wifi, Key, Clock, Phone, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

import AuthGuard from '@/components/AuthGuard';
import PublisherOnboardingModal from '@/components/PublisherOnboardingModal';
import ProfileAvatar from '@/components/ProfileAvatar';
import { useLiveContext } from '@/lib/context/LiveContext';
import { ServiceFactory } from '@/lib/services/ServiceFactory';
import type { Property } from '@/lib/types';
import {
  InternalPropertyOwnerContactInput,
  saveInternalPropertyOwnerContact,
} from '@/lib/services/InternalPropertyDossierService';
import {
  getMyPublisherProfile,
  PublisherSessionRequiredError,
  type PublisherRepresentativeType,
} from '@/lib/services/PublisherProfileService';
import { supabase } from '@/lib/supabaseClient';
import { DashboardHeader, DashboardTabs } from './DashboardChrome';
import {
  getDashboardSwapCollections,
  getFavoriteDashboardProperties,
  getReceivedDashboardLeads,
  getReceivedDashboardReviewCount,
} from './dashboardData';
import { DashboardFavoritesTab } from './DashboardFavoritesTab';
import { DashboardLeadsTab } from './DashboardLeadsTab';
import { DashboardPropertiesTab } from './DashboardPropertiesTab';
import { DashboardReviewModal } from './DashboardReviewModal';
import { DashboardSwapsTab } from './DashboardSwapsTab';
import type { DashboardTab } from './dashboardTypes';

// Property media may come from arbitrary publisher-provided hosts. `unoptimized`
// preserves those original URLs without opening an unsafe wildcard remotePattern.

function DeferredDashboardModalFallback() {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-brand-black/45 backdrop-blur-sm">
      <Loader2 className="h-8 w-8 animate-spin text-white" aria-label="Cargando editor" />
    </div>
  );
}

const PropertyWizardModal = dynamic(
  () => import('@/features/properties/components/PropertyWizardModal'),
  { ssr: false, loading: DeferredDashboardModalFallback },
);

const PropertyEditorModal = dynamic(
  () => import('@/features/properties/components/PropertyEditorModal'),
  { ssr: false, loading: DeferredDashboardModalFallback },
);

function DashboardPageContent() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { liveContext, setActiveGuidedFlow } = useLiveContext();
  const { 
    currentUser, 
    myProperties, 
    swaps, 
    properties, 
    favorites, 
    updateSwapStatus, 
    addProperty,
    updateProperty,
    deleteProperty,
    togglePublish,
    toggleFeature,
    users,
    travelDetails,
    updateTravelDetails,
    reviews,
    leads,
    createReview,
    confirmSwapCompletion
  } = useSwap();

  const [activeTab, setActiveTab] = useState<DashboardTab>('properties');
  
  // Review submission states
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewSwapId, setReviewSwapId] = useState('');
  const [reviewTargetUserId, setReviewTargetUserId] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewsSubTab, setReviewsSubTab] = useState<'received' | 'emitted'>('received');
  
  // Travel Details states
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);
  const [showWifiPasswordMap, setShowWifiPasswordMap] = useState<{[key: string]: boolean}>({});
  const [copiedFieldMap, setCopiedFieldMap] = useState<{[key: string]: boolean}>({});

  const [hostDrawerOpen, setHostDrawerOpen] = useState(false);
  const [editingTrip, setEditingTrip] = useState<any | null>(null);
  const [editingTravelerId, setEditingTravelerId] = useState<string>('');
  const [editingPropertyId, setEditingPropertyId] = useState<string>('');
  const [checkinTime, setCheckinTime] = useState('15:00');
  const [checkoutTime, setCheckoutTime] = useState('11:00');
  const [wifiName, setWifiName] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [checkinInstructions, setCheckinInstructions] = useState('');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('');
  const [hostNotes, setHostNotes] = useState('');
  const [isSubmittingTravel, setIsSubmittingTravel] = useState(false);

  const handleCopyText = (text: string, fieldId: string) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedFieldMap(prev => ({ ...prev, [fieldId]: true }));
      setTimeout(() => {
        setCopiedFieldMap(prev => ({ ...prev, [fieldId]: false }));
      }, 2000);
    }
  };

  const handleSaveTravelDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTrip || !editingTravelerId || !editingPropertyId) return;

    setIsSubmittingTravel(true);
    try {
      await updateTravelDetails({
        swapId: editingTrip.id,
        travelerId: editingTravelerId,
        propertyId: editingPropertyId,
        wifiName,
        wifiPassword,
        accessCode,
        checkinInstructions,
        checkinTime,
        checkoutTime,
        emergencyContactName,
        emergencyContactPhone,
        hostNotes
      });
      setHostDrawerOpen(false);
      confetti({
        particleCount: 50,
        spread: 40,
        origin: { y: 0.8 }
      });
    } catch (err) {
      console.error('[Dashboard] Error updating travel details:', err);
    } finally {
      setIsSubmittingTravel(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!reviewSwapId || !reviewTargetUserId) return;
    if (reviewRating < 1 || reviewRating > 5 || !reviewComment.trim()) return;

    setIsSubmittingReview(true);
    try {
      await createReview({
        swapId: reviewSwapId,
        reviewerId: currentUser.id,
        reviewedUserId: reviewTargetUserId,
        rating: reviewRating,
        comment: reviewComment.trim()
      });

      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });

      setReviewModalOpen(false);
      setReviewComment('');
      setReviewRating(5);
    } catch (err) {
      console.error('[Dashboard] Error submitting review:', err);
    } finally {
      setIsSubmittingReview(false);
    }
  };
  
  // Property Creation Form states
  const [listFormOpen, setListFormOpen] = useState(false);
  const [publisherModalOpen, setPublisherModalOpen] = useState(false);
  const [publisherGateLoading, setPublisherGateLoading] = useState(false);
  const [publisherGateError, setPublisherGateError] = useState('');
  const [verifiedPublisherType, setVerifiedPublisherType] = useState<PublisherRepresentativeType | null>(null);
  const publisherGateInFlight = useRef(false);

  const openPublishFlow = useCallback(async () => {
    if (!currentUser || publisherGateInFlight.current) return;
    publisherGateInFlight.current = true;
    setPublisherGateLoading(true);
    setPublisherGateError('');
    try {
      const publisherProfile = await getMyPublisherProfile(currentUser.id);
      if (publisherProfile) {
        setVerifiedPublisherType(publisherProfile.representativeType);
        setListFormOpen(true);
      } else {
        setPublisherModalOpen(true);
      }
      setActiveTab('properties');
    } catch (error) {
      console.error('[Dashboard] Publisher profile check failed:', error);
      if (error instanceof PublisherSessionRequiredError) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        localStorage.removeItem('auraswap_current_user');
        window.location.assign('/login?intent=publish&next=%2Fdashboard%3Ftab%3Dpublish');
        return;
      }
      setPublisherGateError(
        error instanceof Error
          ? error.message
          : (language === 'es'
              ? 'No pudimos comprobar tu perfil de publicación.'
              : 'We could not verify your publishing profile.'),
      );
    } finally {
      publisherGateInFlight.current = false;
      setPublisherGateLoading(false);
    }
  }, [currentUser, language]);

  // Property Management states
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [editingPropertyLoadingId, setEditingPropertyLoadingId] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  useEffect(() => {
    if (tabParam) {
      if (tabParam === 'publish') {
        void openPublishFlow();
        setActiveTab('properties');
      } else {
        const validTabs: DashboardTab[] = ['properties', 'leads', 'favorites', 'trips', 'reviews', 'swaps'];
        if (validTabs.includes(tabParam as DashboardTab)) {
          setActiveTab(tabParam as DashboardTab);
        }
      }
    }
  }, [openPublishFlow, tabParam]);

  useEffect(() => {
    const handleOpenWizard = () => {
      console.log('[WIZARD CLOSE] handleOpenWizard fired');
      void openPublishFlow();
    };
    window.addEventListener('open-property-wizard', handleOpenWizard);
    return () => window.removeEventListener('open-property-wizard', handleOpenWizard);
  }, [openPublishFlow]);

  useEffect(() => {
    if (liveContext.eterna.activeGuidedFlow === 'publish_property' && activeTab === 'properties') {
      void openPublishFlow();
    }
  }, [activeTab, liveContext.eterna.activeGuidedFlow, openPublishFlow]);

  const handleOpenEdit = async (prop: Property) => {
    setEditingPropertyLoadingId(prop.id);
    try {
      // Fetch the complete, current record instead of editing the dashboard card snapshot.
      const completeProperty = await ServiceFactory.getPropertyService().getById(prop.id);
      setEditingProperty(completeProperty || prop);
    } catch (error) {
      console.error('[Dashboard] No fue posible recargar la propiedad antes de editar:', error);
      setEditingProperty(prop);
    } finally {
      setEditingPropertyLoadingId(null);
    }
  };

  // Saved changes are handled by the dedicated single-page editor.

  const favoritedProperties = useMemo(
    () => getFavoriteDashboardProperties(properties, favorites),
    [favorites, properties],
  );

  const receivedLeads = useMemo(
    () => getReceivedDashboardLeads(leads, myProperties),
    [leads, myProperties],
  );

  const swapCollections = useMemo(
    () => getDashboardSwapCollections(swaps, currentUser?.id),
    [currentUser?.id, swaps],
  );
  const incomingSwaps = swapCollections.incoming;
  const outgoingSwaps = swapCollections.outgoing;
  const travelerTrips = swapCollections.trips;
  const receivedReviewCount = useMemo(
    () => getReceivedDashboardReviewCount(reviews, currentUser?.id),
    [currentUser?.id, reviews],
  );

  // Keep the guard after every hook so hook order remains stable while
  // AuthGuard restores the session.
  if (!currentUser) return null;

  // Note: Creation is now handled by PropertyWizardModal onSubmit

  const handleAcceptSwap = (swapId: string) => {
    updateSwapStatus(swapId, 'APPROVED');
    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.5 }
    });
  };

  const handleDeclineSwap = (swapId: string) => {
    updateSwapStatus(swapId, 'DECLINED');
  };

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-12 md:px-24">
      
      <DashboardHeader
        user={currentUser}
        language={language}
        publisherGateLoading={publisherGateLoading}
        onOpenPublish={() => void openPublishFlow()}
        onOpenSettings={() => router.push('/profile')}
      />

      <DashboardTabs
        activeTab={activeTab}
        language={language}
        counts={{
          properties: myProperties.length,
          leads: receivedLeads.length,
          favorites: favorites.length,
          trips: travelerTrips.length,
          reviews: receivedReviewCount,
          pendingSwaps: incomingSwaps.filter((swap) => swap.status === 'PENDING').length,
        }}
        onTabChange={setActiveTab}
      />

      {/* 3. Dynamic Tab Content Panel */}
      <div>
        {/* TAB 1: SWAPS TIMELINE */}
        {activeTab === 'swaps' && (
          <DashboardSwapsTab
            incomingSwaps={incomingSwaps}
            outgoingSwaps={outgoingSwaps}
            properties={properties}
            ownedProperties={myProperties}
            onAcceptSwap={handleAcceptSwap}
            onDeclineSwap={handleDeclineSwap}
            onOpenMessages={(swapId) => router.push(`/messages?swapId=${swapId}`)}
            onExplore={() => router.push('/explore')}
          />
        )}
        {/* TAB 2: MY LISTED HOMES */}
        {activeTab === 'properties' && (
          <DashboardPropertiesTab
            properties={myProperties}
            reviews={reviews}
            isAdmin={currentUser.role === 'ADMIN'}
            publisherGateLoading={publisherGateLoading}
            editingPropertyLoadingId={editingPropertyLoadingId}
            onNavigateProperty={(propertyId) => router.push('/property/' + propertyId)}
            onTogglePublish={togglePublish}
            onSubmitForReview={(propertyId) => updateProperty(propertyId, {
              isPublished: false,
              folderStatus: 'UNDER_REVIEW',
            })}
            onToggleFeature={toggleFeature}
            onOpenEdit={handleOpenEdit}
            onOpenPublish={openPublishFlow}
          />
        )}
        {/* TAB 3: RECEIVED LEADS MVP */}
        {activeTab === 'leads' && (
          <DashboardLeadsTab
            leads={receivedLeads}
            properties={properties}
            users={users}
            language={language}
          />
        )}

        {/* TAB 3: MY FAVORITES */}
        {activeTab === 'favorites' && (
          <DashboardFavoritesTab
            properties={favoritedProperties}
            onExplore={() => router.push('/explore')}
          />
        )}

        {/* TAB 4: MY TRIPS (Etapa A) */}
        {activeTab === 'trips' && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-brand-black tracking-tight">
                  {language === 'es' ? 'Tus Próximos Viajes' : 'Your Upcoming Trips'}
                </h2>
                <p className="text-xs text-brand-gray-500 font-medium">
                  {language === 'es' ? 'Gestión de tus intercambios aprobados y activos.' : 'Manage your approved and active exchanges.'}
                </p>
              </div>
            </div>

            {travelerTrips.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {travelerTrips.map((trip) => {
                  const isSender = trip.senderId === currentUser.id;
                  const partnerId = isSender ? trip.receiverId : trip.senderId;
                  const partnerPropertyId = isSender ? trip.receiverPropertyId : trip.senderPropertyId;

                  const partnerProp = properties.find((p) => p.id === partnerPropertyId);
                  const partnerUser = users.find((u) => u.id === partnerId);

                  // Calculate remaining days / status
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const start = new Date(trip.startDate);
                  start.setHours(0, 0, 0, 0);
                  const end = new Date(trip.endDate);
                  end.setHours(0, 0, 0, 0);

                  let daysStatus = '';
                  let countdownColorClass = 'bg-brand-accent/5 text-brand-accent border border-brand-accent/25';
                  
                  if (trip.status === 'COMPLETED') {
                    daysStatus = language === 'es' ? 'Completado ✓' : 'Completed ✓';
                    countdownColorClass = 'bg-brand-gray-100 text-brand-gray-500 border border-brand-gray-200/30';
                  } else if (today >= start && today <= end) {
                    daysStatus = language === 'es' ? '¡Viaje en curso! ✈️' : 'Trip in progress! ✈️';
                    countdownColorClass = 'bg-emerald-50 text-emerald-600 border border-emerald-200/35 animate-pulse';
                  } else if (today < start) {
                    const diffTime = start.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    daysStatus = diffDays === 1 
                      ? (language === 'es' ? 'Comienza mañana' : 'Starts tomorrow')
                      : (language === 'es' ? `Comienza en ${diffDays} días` : `Starts in ${diffDays} days`);
                  } else {
                    daysStatus = language === 'es' ? 'Viaje finalizado' : 'Trip completed';
                    countdownColorClass = 'bg-brand-gray-100 text-brand-gray-500 border border-brand-gray-200/30';
                  }

                  const getStatusLabel = (status: string) => {
                    if (status === 'APPROVED') return language === 'es' ? 'Swap Aprobado 🎉' : 'Swap Approved 🎉';
                    if (status === 'CONFIRMED') return language === 'es' ? 'Swap Confirmado' : 'Swap Confirmed';
                    if (status === 'ACTIVE') return language === 'es' ? 'Viaje Activo' : 'Active Trip';
                    if (status === 'COMPLETED') return language === 'es' ? 'Completado ✓' : 'Completed ✓';
                    return status;
                  };

                  const getStatusColor = (status: string) => {
                    if (status === 'APPROVED') return 'bg-emerald-50 text-emerald-600 border border-emerald-200/40';
                    if (status === 'CONFIRMED') return 'bg-blue-50 text-blue-600 border border-blue-200/40';
                    if (status === 'ACTIVE') return 'bg-indigo-50 text-indigo-600 border border-indigo-200/40';
                    if (status === 'COMPLETED') return 'bg-brand-gray-100 text-brand-gray-600 border border-brand-gray-300';
                    return 'bg-brand-gray-100 text-brand-gray-600 border border-brand-gray-200';
                  };

                  return (
                    <div 
                      key={trip.id}
                      className="bg-white border border-brand-gray-200/80 rounded-3xl p-5 shadow-premium hover:shadow-floating transition-all duration-300 flex flex-col justify-between gap-5 relative overflow-hidden"
                    >
                      {/* Property Image & Details */}
                      <div className="flex gap-4 items-start">
                        <div className="relative w-24 h-24 rounded-2xl overflow-hidden shrink-0 bg-brand-gray-100 shadow-sm border border-brand-gray-100">
                          <Image
                            src={partnerProp?.images[0] || '/property-placeholder.svg'}
                            alt={partnerProp?.title || 'Destino'}
                            fill
                            sizes="96px"
                            className="object-cover"
                            unoptimized
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            {/* Trip Countdown Badge */}
                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${countdownColorClass}`}>
                              {daysStatus}
                            </span>
                            {/* Status Badge */}
                            <span className={`text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${getStatusColor(trip.status)}`}>
                              {getStatusLabel(trip.status)}
                            </span>
                          </div>

                          <h3 className="text-sm font-black text-brand-black truncate mb-0.5">
                            {partnerProp?.title || (language === 'es' ? 'Propiedad Towers México' : 'Towers México Property')}
                          </h3>
                          
                          <p className="text-xs text-brand-gray-500 font-medium flex items-center gap-1 mb-1">
                            <MapPin className="w-3.5 h-3.5 text-brand-gray-400 shrink-0" />
                            <span className="truncate">
                              {partnerProp ? formatPropertyLocation(partnerProp.location, partnerProp.country) : (language === 'es' ? 'Ubicación exclusiva' : 'Exclusive Location')}
                            </span>
                          </p>

                          <p className="text-xs text-brand-gray-500 font-medium flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-brand-gray-400 shrink-0" />
                            <span>
                              {trip.startDate} {language === 'es' ? 'al' : 'to'} {trip.endDate}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Host Profile Info Card */}
                      <div className="bg-brand-gray-50/50 rounded-2xl p-4 border border-brand-gray-200/40 flex items-center justify-between gap-4 flex-wrap">
                        <div className="flex items-center gap-3">
                          <ProfileAvatar
                            src={partnerUser?.avatar}
                            name={partnerUser?.name || 'Host'}
                            className="h-10 w-10 border border-white shadow-sm ring-2 ring-brand-gray-100"
                            textClassName="text-xs"
                          />
                          <div>
                            <span className="text-[10px] font-bold text-brand-gray-500 block uppercase tracking-wider mb-0.5">
                              {t('dashboard.tripHost')}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs font-bold text-brand-black">
                                {partnerUser?.name || 'Host'}
                              </span>
                              {partnerUser?.isVerified && (
                                <ShieldCheck className="w-3.5 h-3.5 text-brand-accent shrink-0" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action triggers */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <button
                            onClick={() => router.push(`/messages?swapId=${trip.id}`)}
                            className="px-3.5 py-2 border border-brand-gray-200 hover:border-brand-black hover:bg-white text-brand-gray-600 hover:text-brand-black rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-white"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-brand-gray-500" />
                            <span>{language === 'es' ? 'Mensajes' : 'Messages'}</span>
                          </button>

                          <button
                            onClick={() => setExpandedTripId(expandedTripId === trip.id ? null : trip.id)}
                            className={`px-3.5 py-2 border rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer bg-white ${
                              expandedTripId === trip.id
                                ? 'border-brand-black bg-brand-gray-50 text-brand-black'
                                : 'border-brand-gray-200 hover:border-brand-black text-brand-gray-600 hover:text-brand-black'
                            }`}
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{language === 'es' ? 'Detalles de Llegada' : 'Arrival Details'}</span>
                          </button>

                          {trip.status !== 'COMPLETED' && (
                            <button
                              onClick={() => {
                                setEditingTrip(trip);
                                setEditingTravelerId(partnerId);
                                setEditingPropertyId(isSender ? trip.receiverPropertyId : trip.senderPropertyId);
                                
                                const activeDetails = travelDetails.find(d => d.swapId === trip.id && d.travelerId === partnerId);
                                setCheckinTime(activeDetails?.checkinTime || '15:00');
                                setCheckoutTime(activeDetails?.checkoutTime || '11:00');
                                setWifiName(activeDetails?.wifiName || '');
                                setWifiPassword(activeDetails?.wifiPassword || '');
                                setAccessCode(activeDetails?.accessCode || '');
                                setCheckinInstructions(activeDetails?.checkinInstructions || '');
                                setEmergencyContactName(activeDetails?.emergencyContactName || '');
                                setEmergencyContactPhone(activeDetails?.emergencyContactPhone || '');
                                setHostNotes(activeDetails?.hostNotes || '');
                                setHostDrawerOpen(true);
                              }}
                              className="px-3.5 py-2 bg-brand-accent/5 border border-brand-accent/20 hover:border-brand-accent hover:bg-brand-accent/15 text-brand-accent rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer bg-white"
                            >
                              <Settings className="w-3.5 h-3.5 text-brand-accent" />
                              <span>{language === 'es' ? 'Compartir Llegada' : 'Share Arrival'}</span>
                            </button>
                          )}

                          {trip.status === 'ACTIVE' && (
                            <button
                              onClick={async () => {
                                try {
                                  await confirmSwapCompletion(trip.id);
                                  confetti({
                                    particleCount: 80,
                                    spread: 50,
                                    origin: { y: 0.8 }
                                  });
                                } catch (err) {
                                  console.error('[Dashboard] Error finalizing trip:', err);
                                }
                              }}
                              disabled={!!(isSender ? trip.senderConfirmedComplete : trip.receiverConfirmedComplete)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                                (isSender ? trip.senderConfirmedComplete : trip.receiverConfirmedComplete)
                                  ? 'bg-amber-50 border border-amber-200/50 text-amber-600 cursor-not-allowed'
                                  : 'bg-emerald-50 border border-emerald-200/40 hover:bg-emerald-100 text-emerald-600'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5 animate-pulse" />
                              <span>
                                {(isSender ? trip.senderConfirmedComplete : trip.receiverConfirmedComplete)
                                  ? (language === 'es' ? 'Esperando al otro... ⏳' : 'Waiting for other... ⏳')
                                  : (language === 'es' ? 'Finalizar Intercambio' : 'Complete Exchange')}
                              </span>
                            </button>
                          )}

                          {trip.status === 'COMPLETED' && (
                            <button
                              onClick={() => {
                                const hasReviewed = reviews.some(r => r.swapId === trip.id && r.reviewerId === currentUser.id);
                                if (!hasReviewed) {
                                  setReviewSwapId(trip.id);
                                  setReviewTargetUserId(partnerId);
                                  setReviewRating(5);
                                  setReviewComment('');
                                  setReviewModalOpen(true);
                                }
                              }}
                              disabled={reviews.some(r => r.swapId === trip.id && r.reviewerId === currentUser.id)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
                                reviews.some(r => r.swapId === trip.id && r.reviewerId === currentUser.id)
                                  ? 'bg-brand-gray-100 border border-brand-gray-200 text-brand-gray-400 cursor-not-allowed'
                                  : 'bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-600 animate-bounce'
                              }`}
                            >
                              <Star className="w-3.5 h-3.5" />
                              <span>
                                {reviews.some(r => r.swapId === trip.id && r.reviewerId === currentUser.id)
                                  ? (language === 'es' ? 'Valorado ✓' : 'Reviewed ✓')
                                  : (language === 'es' ? 'Valorar Intercambio' : 'Review Exchange')}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Logistical Details Collapsible Accordion */}
                      {expandedTripId === trip.id && (() => {
                        const guestDetails = travelDetails.find(d => d.swapId === trip.id && d.travelerId === currentUser.id);
                        return (
                          <div className="border-t border-brand-gray-100 pt-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                            {guestDetails ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Llegada & Salida Card */}
                                <div className="bg-brand-gray-50/65 rounded-2xl p-3 border border-brand-gray-200/35 flex flex-col gap-2.5">
                                  <div className="flex items-center gap-1.5 font-bold text-brand-accent uppercase tracking-wider text-[10px]">
                                    <Clock className="w-3.5 h-3.5" />
                                    <span>{language === 'es' ? 'Horarios y Fechas' : 'Schedules & Dates'}</span>
                                  </div>
                                  <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black uppercase text-brand-gray-400">{language === 'es' ? 'Llegada' : 'Check-in'}</span>
                                      <span className="font-extrabold text-brand-black">{trip.startDate}</span>
                                      <span className="text-[10px] text-brand-gray-500 font-semibold">{guestDetails.checkinTime || '15:00'}</span>
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-[9px] font-black uppercase text-brand-gray-400">{language === 'es' ? 'Salida' : 'Check-out'}</span>
                                      <span className="font-extrabold text-brand-black">{trip.endDate}</span>
                                      <span className="text-[10px] text-brand-gray-500 font-semibold">{guestDetails.checkoutTime || '11:00'}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Wifi Card */}
                                <div className="bg-brand-gray-50/65 rounded-2xl p-3 border border-brand-gray-200/35 flex flex-col gap-2">
                                  <div className="flex items-center gap-1.5 font-bold text-brand-accent uppercase tracking-wider text-[10px]">
                                    <Wifi className="w-3.5 h-3.5" />
                                    <span>{language === 'es' ? 'Red Wi-Fi' : 'Wi-Fi Network'}</span>
                                  </div>
                                  {guestDetails.wifiName ? (
                                    <div className="flex flex-col gap-1 text-xs">
                                      <div className="flex items-center justify-between text-brand-black">
                                        <span className="font-medium text-brand-gray-500">SSID:</span>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold">{guestDetails.wifiName}</span>
                                          <button
                                            type="button"
                                            onClick={() => handleCopyText(guestDetails.wifiName || '', `${trip.id}-wifi`)}
                                            className="text-brand-gray-400 hover:text-brand-black transition-colors cursor-pointer"
                                            title={language === 'es' ? 'Copiar SSID' : 'Copy SSID'}
                                          >
                                            {copiedFieldMap[`${trip.id}-wifi`] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                          </button>
                                        </div>
                                      </div>
                                      <div className="flex items-center justify-between text-brand-black">
                                        <span className="font-medium text-brand-gray-500">{language === 'es' ? 'Clave:' : 'Password:'}</span>
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold tracking-tight">
                                            {showWifiPasswordMap[trip.id] ? guestDetails.wifiPassword : '••••••••'}
                                          </span>
                                          <div className="flex items-center gap-1">
                                            <button
                                              type="button"
                                              onClick={() => setShowWifiPasswordMap(prev => ({ ...prev, [trip.id]: !prev[trip.id] }))}
                                              className="text-brand-gray-400 hover:text-brand-black transition-colors cursor-pointer"
                                            >
                                              {showWifiPasswordMap[trip.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => handleCopyText(guestDetails.wifiPassword || '', `${trip.id}-pass`)}
                                              className="text-brand-gray-400 hover:text-brand-black transition-colors cursor-pointer"
                                              title={language === 'es' ? 'Copiar Clave' : 'Copy Password'}
                                            >
                                              {copiedFieldMap[`${trip.id}-pass`] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-brand-gray-400 font-semibold italic">{language === 'es' ? 'No disponible' : 'Not available'}</span>
                                  )}
                                </div>

                                {/* Acceso & Instrucciones Card */}
                                <div className="bg-brand-gray-50/65 rounded-2xl p-3 border border-brand-gray-200/35 flex flex-col gap-2 sm:col-span-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-1.5 font-bold text-brand-accent uppercase tracking-wider text-[10px]">
                                      <Key className="w-3.5 h-3.5" />
                                      <span>{language === 'es' ? 'Acceso al Alojamiento' : 'Property Access'}</span>
                                    </div>
                                    {guestDetails.accessCode && (
                                      <div className="flex items-center gap-1.5 text-xs text-brand-black bg-brand-accent/5 px-2 py-0.5 rounded-md border border-brand-accent/10">
                                        <span className="text-[9px] font-black uppercase text-brand-gray-400">{language === 'es' ? 'Código:' : 'Code:'}</span>
                                        <span className="font-extrabold">{guestDetails.accessCode}</span>
                                        <button
                                          type="button"
                                          onClick={() => handleCopyText(guestDetails.accessCode || '', `${trip.id}-code`)}
                                          className="text-brand-gray-400 hover:text-brand-black transition-colors cursor-pointer"
                                        >
                                          {copiedFieldMap[`${trip.id}-code`] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  {guestDetails.checkinInstructions ? (
                                    <div className="text-xs text-brand-black font-medium leading-relaxed bg-white/70 p-2.5 rounded-xl border border-brand-gray-200/30 flex flex-col gap-1">
                                      <span className="text-[9px] font-black uppercase text-brand-gray-400">{language === 'es' ? 'Instrucciones' : 'Instructions'}</span>
                                      <p className="whitespace-pre-line text-brand-gray-700">{guestDetails.checkinInstructions}</p>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-brand-gray-400 font-semibold italic">{language === 'es' ? 'Instrucciones de entrada no ingresadas' : 'No check-in instructions entered'}</span>
                                  )}
                                </div>

                                {/* Emergencia & Notas Card */}
                                <div className="bg-brand-gray-50/65 rounded-2xl p-3 border border-brand-gray-200/35 flex flex-col gap-2 sm:col-span-2">
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="flex flex-col gap-1.5">
                                      <div className="flex items-center gap-1 font-bold text-brand-gray-500 uppercase tracking-wider text-[9px]">
                                        <Phone className="w-3 h-3" />
                                        <span>{language === 'es' ? 'Contacto de Emergencia' : 'Emergency Contact'}</span>
                                      </div>
                                      {guestDetails.emergencyContactPhone ? (
                                        <div className="bg-white/70 p-2 rounded-xl border border-brand-gray-200/30 flex items-center justify-between text-xs">
                                          <div>
                                            <span className="font-extrabold text-brand-black block">{guestDetails.emergencyContactName || 'Contacto'}</span>
                                            <span className="text-[10px] text-brand-gray-500 font-semibold">{guestDetails.emergencyContactPhone}</span>
                                          </div>
                                          <button
                                            type="button"
                                            onClick={() => handleCopyText(guestDetails.emergencyContactPhone || '', `${trip.id}-phone`)}
                                            className="p-1.5 border border-brand-gray-100 hover:border-brand-black hover:bg-white rounded-lg text-brand-gray-500 hover:text-brand-black transition-all cursor-pointer bg-white"
                                          >
                                            {copiedFieldMap[`${trip.id}-phone`] ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-brand-gray-400 font-semibold italic">{language === 'es' ? 'No configurado' : 'Not configured'}</span>
                                      )}
                                    </div>

                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-1 font-bold text-brand-gray-500 uppercase tracking-wider text-[9px]">
                                        <FileText className="w-3 h-3" />
                                        <span>{language === 'es' ? 'Notas del Anfitrión' : 'Host Notes'}</span>
                                      </div>
                                      {guestDetails.hostNotes ? (
                                        <p className="text-xs text-brand-gray-700 bg-white/70 p-2 rounded-xl border border-brand-gray-200/30 leading-relaxed font-medium min-h-[44px] whitespace-pre-line">
                                          {guestDetails.hostNotes}
                                        </p>
                                      ) : (
                                        <span className="text-[10px] text-brand-gray-400 font-semibold italic min-h-[44px]">{language === 'es' ? 'Sin notas especiales' : 'No special notes'}</span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-brand-gray-50/50 rounded-2xl p-5 border border-brand-gray-200/40 text-center flex flex-col items-center gap-1">
                                <Compass className="w-6 h-6 text-brand-gray-300 animate-pulse" />
                                <p className="text-xs font-extrabold text-brand-black">
                                  {language === 'es' ? 'Llegada Pendiente' : 'Pending Arrival'}
                                </p>
                                <p className="text-[11px] text-brand-gray-500 font-medium max-w-xs leading-relaxed">
                                  {language === 'es' ? 'El anfitrión todavía no ha compartido la información de llegada.' : 'The host has not shared arrival details yet.'}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-brand-gray-200/50 shadow-premium p-8">
                <Compass className="w-10 h-10 text-brand-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-brand-black text-sm mb-1">{t('dashboard.emptyTrips')}</h3>
                <p className="text-brand-gray-500 text-xs max-w-sm mx-auto mb-4">
                  {language === 'es' ? 'Explora hermosas casas de la red y propone un swap para planificar tu primer viaje.' : 'Explore beautiful homes in the network and propose a swap to plan your first trip.'}
                </p>
                <button
                  onClick={() => router.push('/explore')}
                  className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-full text-xs font-bold"
                >
                  {t('dashboard.browseSpaces')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: MY REVIEWS (FASE 4H) */}
        {activeTab === 'reviews' && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-brand-black tracking-tight">
                  {language === 'es' ? 'Reputación & Reseñas' : 'Reputation & Reviews'}
                </h2>
                <p className="text-xs text-brand-gray-500 font-medium">
                  {language === 'es' ? 'Gestiona y visualiza tus valoraciones inmutables de la comunidad.' : 'Manage and view your immutable community reviews.'}
                </p>
              </div>
            </div>

            {/* Glowing pending review alert card if any completed swap has no review from current user */}
            {(() => {
              const pendingSwaps = swaps.filter(s => 
                s.status === 'COMPLETED' &&
                (s.senderId === currentUser.id || s.receiverId === currentUser.id) &&
                !reviews.some(r => r.swapId === s.id && r.reviewerId === currentUser.id)
              );

              if (pendingSwaps.length === 0) return null;

              return (
                <div className="mb-8 bg-gradient-to-r from-indigo-50/70 to-brand-accent/5 rounded-3xl p-6 border border-brand-accent/15 shadow-premium backdrop-blur-md flex flex-col md:flex-row items-center justify-between gap-4 animate-in zoom-in-95 duration-200">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-brand-accent/10 border border-brand-accent/10 flex items-center justify-center shrink-0">
                      <Sparkles className="w-6 h-6 text-brand-accent animate-pulse" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-brand-black mb-0.5">
                        {language === 'es' ? '¡Tienes reseñas pendientes! ✍️' : 'Pending reviews! ✍️'}
                      </h4>
                      <p className="text-xs text-brand-gray-500 font-medium leading-relaxed max-w-xl">
                        {language === 'es' 
                          ? `Has completado ${pendingSwaps.length} ${pendingSwaps.length === 1 ? 'intercambio' : 'intercambios'} recientemente. Deja tu reseña inmutable para construir confianza en la red.`
                          : `You have completed ${pendingSwaps.length} ${pendingSwaps.length === 1 ? 'exchange' : 'exchanges'} recently. Leave your immutable review to foster network trust.`}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const firstPending = pendingSwaps[0];
                      const partnerId = firstPending.senderId === currentUser.id ? firstPending.receiverId : firstPending.senderId;
                      setReviewSwapId(firstPending.id);
                      setReviewTargetUserId(partnerId);
                      setReviewRating(5);
                      setReviewComment('');
                      setReviewModalOpen(true);
                    }}
                    className="px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-2xl text-xs font-black shadow-md cursor-pointer transition-all active:scale-95 shrink-0"
                  >
                    {language === 'es' ? 'Valorar Ahora' : 'Rate Now'}
                  </button>
                </div>
              );
            })()}

            {/* Metrics cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
              {/* Average Rating Card */}
              {(() => {
                const receivedReviews = reviews.filter(r => r.reviewedUserId === currentUser.id);
                const avgRating = receivedReviews.length > 0
                  ? (receivedReviews.reduce((sum, r) => sum + r.rating, 0) / receivedReviews.length).toFixed(1)
                  : null;

                return (
                  <div className="bg-white rounded-3xl p-5 border border-brand-gray-200/80 shadow-premium flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500 shrink-0">
                      <Star className="w-6 h-6 fill-current" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-brand-gray-400 block uppercase tracking-wider mb-0.5">
                        {language === 'es' ? 'Calificación Media' : 'Average Rating'}
                      </span>
                      <span className="text-xl font-black text-brand-black flex items-baseline gap-1">
                        {avgRating ?? (language === 'es' ? 'Sin reseñas' : 'No reviews')}
                        {avgRating && <span className="text-xs text-brand-gray-400 font-semibold">/ 5.0</span>}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Total Received Card */}
              <div className="bg-white rounded-3xl p-5 border border-brand-gray-200/80 shadow-premium flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-brand-accent shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-brand-gray-400 block uppercase tracking-wider mb-0.5">
                    {language === 'es' ? 'Reseñas Recibidas' : 'Reviews Received'}
                  </span>
                  <span className="text-xl font-black text-brand-black">
                    {reviews.filter(r => r.reviewedUserId === currentUser.id).length}
                  </span>
                </div>
              </div>

              {/* Completed Swaps Card */}
              {(() => {
                const completedSwapsCount = swaps.filter(s => 
                  s.status === 'COMPLETED' && (s.senderId === currentUser.id || s.receiverId === currentUser.id)
                ).length;

                return (
                  <div className="bg-white rounded-3xl p-5 border border-brand-gray-200/80 shadow-premium flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500 shrink-0">
                      <Compass className="w-6 h-6" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-brand-gray-400 block uppercase tracking-wider mb-0.5">
                        {language === 'es' ? 'Swaps Completados' : 'Completed Swaps'}
                      </span>
                      <span className="text-xl font-black text-brand-black">
                        {completedSwapsCount}
                      </span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Sub-tab Navigation */}
            <div className="flex gap-2 border-b border-brand-gray-200/60 mb-6 pb-0.5">
              <button
                onClick={() => setReviewsSubTab('received')}
                className={`pb-2.5 px-2 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
                  reviewsSubTab === 'received'
                    ? 'border-brand-accent text-brand-accent'
                    : 'border-transparent text-brand-gray-400 hover:text-brand-black'
                }`}
              >
                {language === 'es' ? 'Reseñas Recibidas' : 'Received Reviews'}
              </button>
              <button
                onClick={() => setReviewsSubTab('emitted')}
                className={`pb-2.5 px-2 text-xs font-extrabold border-b-2 transition-all cursor-pointer ${
                  reviewsSubTab === 'emitted'
                    ? 'border-brand-accent text-brand-accent'
                    : 'border-transparent text-brand-gray-400 hover:text-brand-black'
                }`}
              >
                {language === 'es' ? 'Reseñas Emitidas' : 'Given Reviews'}
              </button>
            </div>

            {/* Reviews Feed */}
            {reviewsSubTab === 'received' ? (
              (() => {
                const receivedList = reviews.filter(r => r.reviewedUserId === currentUser.id);

                if (receivedList.length === 0) {
                  return (
                    <div className="text-center py-20 bg-white rounded-3xl border border-brand-gray-200/50 shadow-premium p-8">
                      <Star className="w-10 h-10 text-brand-gray-300 mx-auto mb-3" />
                      <h3 className="font-bold text-brand-black text-sm mb-1">
                        {language === 'es' ? 'Sin reseñas todavía' : 'No reviews yet'}
                      </h3>
                      <p className="text-brand-gray-500 text-xs max-w-sm mx-auto">
                        {language === 'es'
                          ? 'Las opiniones de otros anfitriones aparecerán aquí una vez que completes intercambios y ambos compartan sus experiencias.'
                          : 'Feedbacks from other hosts will show up here once you complete swaps and both share your experiences.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 gap-4">
                    {receivedList.map((rev) => {
                      const reviewer = users.find(u => u.id === rev.reviewerId);
                      
                      return (
                        <div key={rev.id} className="bg-white border border-brand-gray-200/80 rounded-2xl p-5 shadow-premium flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3">
                              <ProfileAvatar
                                src={reviewer?.avatar}
                                name={reviewer?.name || 'Reviewer'}
                                className="h-10 w-10 border border-white shadow-sm ring-2 ring-brand-gray-100"
                                textClassName="text-xs"
                              />
                              <div>
                                <span className="text-xs font-black text-brand-black block">
                                  {reviewer?.name || 'Otro anfitrión'}
                                </span>
                                <span className="text-[10px] text-brand-gray-400 font-semibold">
                                  {new Date(rev.createdAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                              </div>
                            </div>

                            {/* Stars rating widget */}
                            <div className="flex items-center gap-0.5 text-amber-400">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-current' : 'text-brand-gray-200'}`}
                                />
                              ))}
                            </div>
                          </div>

                          <p className="text-xs font-medium text-brand-gray-700 leading-relaxed whitespace-pre-line bg-brand-gray-50/40 p-3 rounded-xl border border-brand-gray-100/50">
                            {rev.comment}
                          </p>

                          {reviewer?.isVerified && (
                            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100/40 w-fit self-end">
                              <ShieldCheck className="w-3.5 h-3.5" />
                              <span>{language === 'es' ? 'Perfil verificado' : 'Verified profile'}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              (() => {
                const emittedList = reviews.filter(r => r.reviewerId === currentUser.id);

                if (emittedList.length === 0) {
                  return (
                    <div className="text-center py-20 bg-white rounded-3xl border border-brand-gray-200/50 shadow-premium p-8">
                      <Star className="w-10 h-10 text-brand-gray-300 mx-auto mb-3" />
                      <h3 className="font-bold text-brand-black text-sm mb-1">
                        {language === 'es' ? 'No has emitido reseñas' : 'No reviews written'}
                      </h3>
                      <p className="text-brand-gray-500 text-xs max-w-sm mx-auto">
                        {language === 'es'
                          ? 'Aquí verás las reseñas que has publicado para otros miembros de la red. Una vez enviadas, son inmutables.'
                          : 'Here you will see the reviews you have posted for other members of the network. Once submitted, they are immutable.'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid grid-cols-1 gap-4">
                    {emittedList.map((rev) => {
                      const reviewed = users.find(u => u.id === rev.reviewedUserId);

                      return (
                        <div key={rev.id} className="bg-white border border-brand-gray-200/80 rounded-2xl p-5 shadow-premium flex flex-col gap-3 relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3">
                              <ProfileAvatar
                                src={reviewed?.avatar}
                                name={reviewed?.name || 'Reviewed'}
                                className="h-10 w-10 border border-white shadow-sm ring-2 ring-brand-gray-100"
                                textClassName="text-xs"
                              />
                              <div>
                                <span className="text-xs font-black text-brand-black block">
                                  {reviewed?.name || 'Miembro Towers México'}
                                </span>
                                <span className="text-[10px] text-brand-gray-400 font-semibold">
                                  {new Date(rev.createdAt).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                              </div>
                            </div>

                            {/* Stars rating widget */}
                            <div className="flex items-center gap-0.5 text-amber-400">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`w-3.5 h-3.5 ${i < rev.rating ? 'fill-current' : 'text-brand-gray-200'}`}
                                />
                              ))}
                            </div>
                          </div>

                          <p className="text-xs font-medium text-brand-gray-700 leading-relaxed whitespace-pre-line bg-brand-gray-50/40 p-3 rounded-xl border border-brand-gray-100/50">
                            {rev.comment}
                          </p>

                          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-brand-gray-400 bg-brand-gray-100 px-2.5 py-1 rounded-lg border border-brand-gray-200/30 w-fit self-end select-none">
                            <span>Reseña Inmutable 🔒</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        )}
      </div>

      {/* 4. Form Dialog Drawer: List Your Space (Sleek side-sheet or modal) */}
      <AnimatePresence>
        {publisherModalOpen && (
          <PublisherOnboardingModal
            isOpen={publisherModalOpen}
            currentUser={currentUser}
            onClose={() => setPublisherModalOpen(false)}
            onComplete={(profile) => {
              setVerifiedPublisherType(profile.representativeType);
              setPublisherModalOpen(false);
              setListFormOpen(true);
              setActiveTab('properties');
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {listFormOpen && (
          <PropertyWizardModal
            isOpen={listFormOpen}
            publisherRepresentativeType={verifiedPublisherType || undefined}
            onClose={() => {
              console.log('[WIZARD CLOSE] Dashboard onClose start');
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('eterna-cancel-speech'));
              }
              console.log('[WIZARD CLOSE] setListFormOpen(false)');
              setListFormOpen(false);
              if (liveContext.eterna.activeGuidedFlow === 'publish_property') {
                console.log('[WIZARD CLOSE] setActiveGuidedFlow(null)');
                setActiveGuidedFlow(null);
              }
            }}
            onSubmit={async (propertyData) => {
              try {
                const {
                  internalOwnerContact,
                  ...publicPropertyData
                } = propertyData as typeof propertyData & {
                  internalOwnerContact?: InternalPropertyOwnerContactInput;
                };
                const createdProperty = await addProperty(publicPropertyData);
                if (internalOwnerContact && createdProperty?.id) {
                  await saveInternalPropertyOwnerContact(createdProperty.id, internalOwnerContact);
                }
                setListFormOpen(false);
                window.dispatchEvent(new CustomEvent('auraswap:flow-event', { detail: { event: 'property_created' } }));
              } catch (err) {
                console.error('Error creating property:', err);
              }
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {publisherGateError && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className="fixed bottom-6 left-1/2 z-[130] flex w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 items-start justify-between gap-3 rounded-2xl border border-rose-200 bg-white p-4 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="text-[11px] font-bold leading-relaxed text-rose-700">{publisherGateError}</p>
            </div>
            <button
              type="button"
              onClick={() => setPublisherGateError('')}
              className="text-brand-gray-400 hover:text-brand-black"
              aria-label={language === 'es' ? 'Cerrar' : 'Close'}
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 5. Single-page property editor (kept separate from the publishing wizard) */}
      <AnimatePresence>
        {editingProperty && (
          <PropertyEditorModal
            isOpen={!!editingProperty}
            property={editingProperty}
            onClose={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('eterna-cancel-speech'));
              }
              setEditingProperty(null);
              if (liveContext.eterna.activeGuidedFlow === 'publish_property') {
                setActiveGuidedFlow(null);
              }
            }}
            onDelete={async (id) => {
              try {
                await deleteProperty(id);
                setEditingProperty(null);
                confetti({
                  particleCount: 70,
                  spread: 50,
                  colors: ['#ff4d4d', '#ff9999']
                });
              } catch (err) {
                console.error('Error deleting property:', err);
              }
            }}
            onSubmit={async (propertyData) => {
              try {
                await updateProperty(editingProperty.id, propertyData);
                setEditingProperty((current) => current ? { ...current, ...propertyData } as Property : current);
              } catch (err) {
                console.error('Error updating property:', err);
                throw err;
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* 6. Premium Slide-over Host Check-in Credentials Configurator Drawer */}
      <AnimatePresence>
        {hostDrawerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex justify-end"
          >
            <div
              className="absolute inset-0 bg-brand-black/45 backdrop-blur-sm"
              onClick={() => setHostDrawerOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative z-10 w-full max-w-lg bg-white h-full shadow-floating border-l border-brand-gray-200/60 flex flex-col p-6 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleSaveTravelDetails} className="flex flex-col h-full justify-between gap-6">
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-brand-gray-100 pb-3 shrink-0">
                  <div>
                    <h3 className="text-base font-extrabold text-brand-black flex items-center gap-1.5">
                      <Settings className="w-5 h-5 text-brand-accent animate-spin-slow" />
                      <span>{language === 'es' ? 'Compartir Llegada' : 'Share Arrival Details'}</span>
                    </h3>
                    <p className="text-[11px] text-brand-gray-500 font-semibold mt-0.5">
                      {language === 'es' ? 'Configura las credenciales logísticas para tu huésped.' : 'Configure check-in logistics credentials for your guest.'}
                    </p>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setHostDrawerOpen(false)}
                    className="p-1 text-brand-gray-400 hover:text-brand-black font-semibold cursor-pointer rounded-lg hover:bg-brand-gray-50 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Fields */}
                <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-1">
                  
                  {/* Schedules Block */}
                  <div className="bg-brand-gray-50/50 p-4 rounded-2xl border border-brand-gray-200/40 flex flex-col gap-3">
                    <span className="text-[10px] font-black uppercase text-brand-gray-400 tracking-wider flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {language === 'es' ? 'Horas de Entrada y Salida' : 'Check-in & Check-out Times'}
                    </span>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-brand-gray-500">{language === 'es' ? 'Llegada (Check-in)' : 'Check-in Time'}</label>
                        <input
                          type="text"
                          placeholder="15:00"
                          value={checkinTime}
                          onChange={(e) => setCheckinTime(e.target.value)}
                          required
                          className="w-full p-2.5 bg-white border border-brand-gray-200 rounded-xl font-bold outline-none focus:border-brand-accent transition-colors cursor-text"
                          style={{ cursor: 'text' }}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-brand-gray-500">{language === 'es' ? 'Salida (Check-out)' : 'Check-out Time'}</label>
                        <input
                          type="text"
                          placeholder="11:00"
                          value={checkoutTime}
                          onChange={(e) => setCheckoutTime(e.target.value)}
                          required
                          className="w-full p-2.5 bg-white border border-brand-gray-200 rounded-xl font-bold outline-none focus:border-brand-accent transition-colors cursor-text"
                          style={{ cursor: 'text' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Wifi Configuration Block */}
                  <div className="bg-brand-gray-50/50 p-4 rounded-2xl border border-brand-gray-200/40 flex flex-col gap-3">
                    <span className="text-[10px] font-black uppercase text-brand-gray-400 tracking-wider flex items-center gap-1">
                      <Wifi className="w-3.5 h-3.5" />
                      {language === 'es' ? 'Detalles de Red Wi-Fi' : 'Wi-Fi Network Credentials'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-brand-gray-500">{language === 'es' ? 'Nombre de Red (SSID)' : 'Network Name (SSID)'}</label>
                        <input
                          type="text"
                          placeholder="TowersMexico_Invitado"
                          value={wifiName}
                          onChange={(e) => setWifiName(e.target.value)}
                          className="w-full p-2.5 bg-white border border-brand-gray-200 rounded-xl font-medium outline-none focus:border-brand-accent transition-colors cursor-text"
                          style={{ cursor: 'text' }}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-brand-gray-500">{language === 'es' ? 'Contraseña' : 'Password'}</label>
                        <input
                          type="text"
                          placeholder="supersecurekey"
                          value={wifiPassword}
                          onChange={(e) => setWifiPassword(e.target.value)}
                          className="w-full p-2.5 bg-white border border-brand-gray-200 rounded-xl font-medium outline-none focus:border-brand-accent transition-colors cursor-text"
                          style={{ cursor: 'text' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Access Configuration Block */}
                  <div className="bg-brand-gray-50/50 p-4 rounded-2xl border border-brand-gray-200/40 flex flex-col gap-3 text-xs">
                    <span className="text-[10px] font-black uppercase text-brand-gray-400 tracking-wider flex items-center gap-1">
                      <Key className="w-3.5 h-3.5" />
                      {language === 'es' ? 'Código e Instrucciones de Acceso' : 'Access Key & Directions'}
                    </span>
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-brand-gray-500">{language === 'es' ? 'Código de Entrada (Opcional)' : 'Door Entry Code (Optional)'}</label>
                      <input
                        type="text"
                        placeholder="e.g. #4829* o 1234"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                        className="w-full p-2.5 bg-white border border-brand-gray-200 rounded-xl font-bold outline-none focus:border-brand-accent transition-colors cursor-text"
                        style={{ cursor: 'text' }}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-bold text-brand-gray-500">{language === 'es' ? 'Instrucciones Detalladas de Entrada' : 'Detailed Check-in Instructions'}</label>
                      <textarea
                        placeholder={language === 'es' ? 'Explica cómo llegar, dónde se recogen las llaves, códigos de portería o escaleras...' : 'Explain how to get there, key location, building entry codes, elevators...'}
                        value={checkinInstructions}
                        onChange={(e) => setCheckinInstructions(e.target.value)}
                        className="w-full h-24 p-3 bg-white border border-brand-gray-200 rounded-xl font-medium outline-none focus:border-brand-accent transition-colors resize-none leading-relaxed cursor-text"
                        style={{ cursor: 'text' }}
                      />
                    </div>
                  </div>

                  {/* Emergency Contact Block */}
                  <div className="bg-brand-gray-50/50 p-4 rounded-2xl border border-brand-gray-200/40 flex flex-col gap-3 text-xs">
                    <span className="text-[10px] font-black uppercase text-brand-gray-400 tracking-wider flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5" />
                      {language === 'es' ? 'Contacto de Emergencia Local' : 'Local Emergency Contact'}
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-brand-gray-500">{language === 'es' ? 'Nombre del Contacto' : 'Contact Name'}</label>
                        <input
                          type="text"
                          placeholder="e.g. Juan (Conserje)"
                          value={emergencyContactName}
                          onChange={(e) => setEmergencyContactName(e.target.value)}
                          className="w-full p-2.5 bg-white border border-brand-gray-200 rounded-xl font-medium outline-none focus:border-brand-accent transition-colors cursor-text"
                          style={{ cursor: 'text' }}
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="font-bold text-brand-gray-500">{language === 'es' ? 'Teléfono de Emergencia' : 'Emergency Phone Number'}</label>
                        <input
                          type="text"
                          placeholder="e.g. +34 600 000 000"
                          value={emergencyContactPhone}
                          onChange={(e) => setEmergencyContactPhone(e.target.value)}
                          className="w-full p-2.5 bg-white border border-brand-gray-200 rounded-xl font-medium outline-none focus:border-brand-accent transition-colors cursor-text"
                          style={{ cursor: 'text' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Host Notes Block */}
                  <div className="bg-brand-gray-50/50 p-4 rounded-2xl border border-brand-gray-200/40 flex flex-col gap-1 text-xs">
                    <label className="font-bold text-brand-gray-500 flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      {language === 'es' ? 'Notas de Bienvenida y Recomendaciones' : 'Welcome Message & Notes'}
                    </label>
                    <textarea
                      placeholder={language === 'es' ? 'Deja unas palabras amables, contraseñas secundarias, recomendaciones del barrio, etc.' : 'Leave some welcoming words, secondary credentials, neighborhood tips, etc.'}
                      value={hostNotes}
                      onChange={(e) => setHostNotes(e.target.value)}
                      className="w-full h-20 p-3 bg-white border border-brand-gray-200 rounded-xl font-medium outline-none focus:border-brand-accent transition-colors resize-none leading-relaxed cursor-text"
                      style={{ cursor: 'text' }}
                    />
                  </div>

                </div>

                {/* Footer buttons */}
                <div className="flex items-center justify-end border-t border-brand-gray-100 pt-4 shrink-0 gap-3 bg-white z-10">
                  <button
                    type="button"
                    onClick={() => setHostDrawerOpen(false)}
                    className="px-5 py-2.5 border border-brand-gray-200 hover:bg-brand-gray-50 text-brand-gray-500 rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    {t('details.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTravel}
                    className={`px-6 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl text-xs font-bold shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                      isSubmittingTravel ? 'bg-brand-gray-300 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSubmittingTravel ? (
                      <span>{language === 'es' ? 'Guardando...' : 'Saving...'}</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{language === 'es' ? 'Guardar Cambios' : 'Save Details'}</span>
                      </>
                    )}
                  </button>
                </div>

              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DashboardReviewModal
        isOpen={reviewModalOpen}
        rating={reviewRating}
        comment={reviewComment}
        isSubmitting={isSubmittingReview}
        onClose={() => setReviewModalOpen(false)}
        onRatingChange={setReviewRating}
        onCommentChange={setReviewComment}
        onSubmit={handleReviewSubmit}
      />

    </div>
  );
}
export default function DashboardPage() {
  const { t } = useTranslation();
  return (
    <React.Suspense fallback={
      <div className="max-w-7xl mx-auto px-6 py-20 text-center flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-accent mb-4"></div>
        <p className="text-brand-gray-500 text-sm font-semibold">{t('explore.loadingBtn')}</p>
      </div>
    }>
      <AuthGuard>
        <DashboardPageContent />
      </AuthGuard>
    </React.Suspense>
  );
}
