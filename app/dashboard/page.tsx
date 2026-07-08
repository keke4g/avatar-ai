"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useSwap } from '../../lib/context/SwapContext';
import { useTranslation } from '../../lib/context/LanguageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { formatCount, formatBathrooms } from '../../lib/textHelpers';
import PropertyCard from '../../components/PropertyCard';
import ImageUploadDropzone from '../../components/ImageUploadDropzone';
import { 
  Grid, Calendar, Heart, ShieldCheck, Plus, Check, X, 
  MessageSquare, Star, Settings, FileText, ArrowRight, Building, Compass, Sparkles, AlertTriangle,
  Edit, Trash2, Eye, EyeOff, Image, MapPin, Copy, Wifi, Key, Clock, Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MOCK_USERS } from '../../lib/mockData';
import confetti from 'canvas-confetti';

import AuthGuard from '../../components/AuthGuard';
import PropertyWizardModal from '../../components/PropertyWizardModal';
import { useLiveContext } from '../../lib/context/LiveContext';

type TabType = 'swaps' | 'properties' | 'leads' | 'favorites' | 'trips' | 'reviews';

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

  if (!currentUser) {
    return <AuthGuard />;
  }

  const [activeTab, setActiveTab] = useState<TabType>('swaps');
  
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

  // Property Management states
  const [editingProperty, setEditingProperty] = useState<any | null>(null);

  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');

  useEffect(() => {
    if (tabParam) {
      if (tabParam === 'publish') {
        setListFormOpen(true);
        setActiveTab('properties');
      } else {
        const validTabs: TabType[] = ['swaps', 'properties', 'leads', 'favorites', 'trips', 'reviews'];
        if (validTabs.includes(tabParam as TabType)) {
          setActiveTab(tabParam as TabType);
        }
      }
    }
  }, [tabParam]);

  useEffect(() => {
    const handleOpenWizard = () => {
      console.log('[WIZARD CLOSE] handleOpenWizard fired');
      setListFormOpen(true);
      setActiveTab('properties');
    };
    window.addEventListener('open-property-wizard', handleOpenWizard);
    return () => window.removeEventListener('open-property-wizard', handleOpenWizard);
  }, []);

  useEffect(() => {
    if (liveContext.eterna.activeGuidedFlow === 'publish_property' && activeTab === 'properties') {
      setListFormOpen(true);
    }
  }, [activeTab, liveContext.eterna.activeGuidedFlow]);

  const handleOpenEdit = (prop: any) => {
    setEditingProperty(prop);
  };

  // Note: Saved changes are now handled by PropertyWizardModal onSubmit

  // Favorite properties
  const favoritedProperties = properties.filter((p) => favorites.includes(p.id));

  const receivedLeads = useMemo(() => {
    const ownedPropertyIds = new Set(myProperties.map((property) => property.id));
    return leads.filter((lead) => ownedPropertyIds.has(lead.propertyId));
  }, [leads, myProperties]);

  // Categorize swaps
  const incomingSwaps = swaps.filter((s) => s.receiverId === currentUser.id);
  const outgoingSwaps = swaps.filter((s) => s.senderId === currentUser.id);

  const travelerTrips = useMemo(() => {
    if (!currentUser) return [];
    return swaps.filter(s => 
      (s.senderId === currentUser.id || s.receiverId === currentUser.id) &&
      ['APPROVED', 'CONFIRMED', 'ACTIVE', 'COMPLETED'].includes(s.status)
    );
  }, [swaps, currentUser?.id]);

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
      
      {/* 1. Header Profile Banner */}
      <div className="bg-white border border-brand-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-premium mb-10 flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden">
        {/* Glow behind profile */}
        <div className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-brand-accent/5 filter blur-2xl pointer-events-none" />
        
        <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10 text-center sm:text-left">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-md ring-4 ring-brand-accent/5"
          />
          <div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1">
              <h1 className="text-xl sm:text-2xl font-black text-brand-black tracking-tight">{currentUser.name}</h1>
              <div className="glass px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider text-brand-accent flex items-center gap-1 bg-white/95">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('dashboard.verifiedBadge')}</span>
              </div>
            </div>
            <p className="text-xs text-brand-gray-500 font-medium">
              {t('dashboard.memberSince', { city: 'Tokyo, Japan', year: '2024', rating: '4.95' })}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 shrink-0">
          <button 
            onClick={() => setListFormOpen(true)}
            className="px-5 py-3 bg-brand-black hover:bg-brand-black/90 text-white rounded-full text-xs font-bold shadow-sm flex items-center gap-1.5 hover:scale-[1.02] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('dashboard.tabCreate')}</span>
          </button>
          <button 
            onClick={() => router.push('/profile')}
            className="p-3 border border-brand-gray-200 hover:border-brand-black text-brand-gray-500 hover:text-brand-black rounded-full transition-colors cursor-pointer" 
            title={t('dashboard.settingsBtn')}
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Vercel-inspired Tab Navigation */}
      <div className="flex border-b border-brand-gray-200/80 mb-8 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('swaps')}
          className={`px-6 py-3 font-bold text-sm tracking-tight outline-none border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'swaps'
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-brand-gray-500 hover:text-brand-black'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{t('dashboard.tabTimeline')}</span>
          {incomingSwaps.filter(s => s.status === 'PENDING').length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-accent text-white animate-pulse">
              {incomingSwaps.filter(s => s.status === 'PENDING').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('properties')}
          className={`px-6 py-3 font-bold text-sm tracking-tight outline-none border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'properties'
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-brand-gray-500 hover:text-brand-black'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>{t('dashboard.tabListings')}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-gray-100 text-brand-gray-500">
            {myProperties.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('leads')}
          className={`px-6 py-3 font-bold text-sm tracking-tight outline-none border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'leads'
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-brand-gray-500 hover:text-brand-black'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>{language === 'es' ? 'Leads recibidos' : 'Received leads'}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-gray-100 text-brand-gray-500">
            {receivedLeads.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('favorites')}
          className={`px-6 py-3 font-bold text-sm tracking-tight outline-none border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'favorites'
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-brand-gray-500 hover:text-brand-black'
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>{t('dashboard.tabFavorites')}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-gray-100 text-brand-gray-500">
            {favorites.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('trips')}
          className={`px-6 py-3 font-bold text-sm tracking-tight outline-none border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'trips'
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-brand-gray-500 hover:text-brand-black'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>{t('dashboard.tabTrips')}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-gray-100 text-brand-gray-500">
            {travelerTrips.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`px-6 py-3 font-bold text-sm tracking-tight outline-none border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
            activeTab === 'reviews'
              ? 'border-brand-accent text-brand-accent'
              : 'border-transparent text-brand-gray-500 hover:text-brand-black'
          }`}
        >
          <Star className="w-4 h-4" />
          <span>{language === 'es' ? 'Mis Reseñas' : 'My Reviews'}</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-brand-gray-100 text-brand-gray-500">
            {reviews.filter(r => r.reviewedUserId === currentUser.id).length}
          </span>
        </button>
      </div>

      {/* 3. Dynamic Tab Content Panel */}
      <div>
        {/* TAB 1: SWAPS TIMELINE */}
        {activeTab === 'swaps' && (
          <div className="flex flex-col gap-10">
            {/* Swaps Requests Received section */}
            <div>
              <h2 className="text-base font-bold text-brand-black tracking-tight mb-4 flex items-center gap-2">
                <span>{t('dashboard.receivedSwapProposals')}</span>
                <span className="text-xs font-normal text-brand-gray-500">{t('dashboard.receivedSwapProposalsDesc')}</span>
              </h2>

              {incomingSwaps.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {incomingSwaps.map((swap) => {
                    const requesterProp = properties.find((p) => p.id === swap.senderPropertyId);
                    const userProp = myProperties.find((p) => p.id === swap.receiverPropertyId);

                    return (
                      <div 
                        key={swap.id}
                        className="bg-white border border-brand-gray-200/80 rounded-3xl p-5 shadow-premium flex flex-col md:flex-row justify-between items-stretch gap-6"
                      >
                        {/* Offered space preview card */}
                        <div className="flex-1 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                          <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-brand-gray-100 shadow-sm border border-brand-gray-100">
                            {requesterProp && <img src={requesterProp.images[0]} alt={requesterProp.title} className="w-full h-full object-cover" />}
                          </div>

                          <div className="overflow-hidden">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                swap.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border border-amber-200/30' :
                                swap.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/30' :
                                'bg-brand-gray-100 text-brand-gray-400'
                              }`}>
                                {swap.status === 'PENDING' ? t('dashboard.statusPending') :
                                 swap.status === 'APPROVED' ? t('dashboard.statusApproved') :
                                 t('dashboard.statusDeclined')}
                              </span>
                              
                              <span className="text-[10px] text-brand-gray-500 font-medium">{t('details.proposedStart')}: {swap.startDate} {t('details.proposedEnd').toLowerCase()}: {swap.endDate}</span>
                            </div>

                            <p className="text-sm font-bold text-brand-black truncate">
                              {t('messages.checklistHost')}: {requesterProp?.title}
                            </p>
                            <p className="text-xs text-brand-gray-500 truncate mb-1">
                              {t('messages.checklistGuest')}: <span className="font-semibold text-brand-black">{userProp?.title}</span>
                            </p>
                            
                            <p className="text-xs text-brand-gray-500 line-clamp-1 italic font-normal bg-brand-gray-50 p-2 rounded-xl border border-brand-gray-100">
                              "{swap.message}"
                            </p>
                          </div>
                        </div>

                        {/* Actions controls column */}
                        <div className="flex flex-row md:flex-col justify-end md:justify-center items-center gap-2 border-t md:border-t-0 md:border-l border-brand-gray-100 pt-4 md:pt-0 md:pl-6 shrink-0">
                          {swap.status === 'PENDING' ? (
                            <>
                              <button
                                onClick={() => handleAcceptSwap(swap.id)}
                                className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-full text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>{t('messages.acceptProposalBtn')}</span>
                              </button>
                              <button
                                onClick={() => handleDeclineSwap(swap.id)}
                                className="px-4 py-2 border border-brand-gray-200 hover:bg-brand-rose/5 hover:border-brand-rose hover:text-brand-rose text-brand-gray-500 rounded-full text-xs font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                                <span>{t('messages.declineProposalBtn')}</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-xs font-bold text-brand-gray-500 bg-brand-gray-100 px-3 py-1.5 rounded-full flex items-center gap-1">
                              {swap.status === 'APPROVED' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                              <span>{swap.status === 'APPROVED' ? t('dashboard.statusApproved') : t('dashboard.statusDeclined')}</span>
                            </span>
                          )}

                          <button
                            onClick={() => router.push(`/messages?swapId=${swap.id}`)}
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

            {/* Swaps Requests Sent section */}
            <div>
              <h2 className="text-base font-bold text-brand-black tracking-tight mb-4 flex items-center gap-2">
                <span>{t('dashboard.sentSwapProposals')}</span>
                <span className="text-xs font-normal text-brand-gray-500">{t('dashboard.sentSwapProposalsDesc')}</span>
              </h2>

              {outgoingSwaps.length > 0 ? (
                <div className="flex flex-col gap-4">
                  {outgoingSwaps.map((swap) => {
                    const receiverProp = properties.find((p) => p.id === swap.receiverPropertyId);
                    const userProp = myProperties.find((p) => p.id === swap.senderPropertyId);

                    return (
                      <div 
                        key={swap.id}
                        className="bg-white border border-brand-gray-200/80 rounded-3xl p-5 shadow-premium flex flex-col md:flex-row justify-between items-stretch gap-6 animate-in fade-in"
                      >
                        {/* Offered space preview card */}
                        <div className="flex-1 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                          <div className="w-20 h-20 rounded-2xl overflow-hidden shrink-0 bg-brand-gray-100 shadow-sm border border-brand-gray-100">
                            {receiverProp && <img src={receiverProp.images[0]} alt={receiverProp.title} className="w-full h-full object-cover" />}
                          </div>

                          <div className="overflow-hidden">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                                swap.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border border-amber-200/30' :
                                swap.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/30' :
                                'bg-brand-gray-100 text-brand-gray-400'
                              }`}>
                                {swap.status === 'PENDING' ? t('dashboard.statusPending') :
                                 swap.status === 'APPROVED' ? t('dashboard.statusApproved') :
                                 t('dashboard.statusDeclined')}
                              </span>
                              <span className="text-[10px] text-brand-gray-500 font-medium">{t('details.proposedStart')}: {swap.startDate} {t('details.proposedEnd').toLowerCase()}: {swap.endDate}</span>
                            </div>

                            <p className="text-sm font-bold text-brand-black truncate">
                              {t('messages.checklistHost')}: {receiverProp?.title}
                            </p>
                            <p className="text-xs text-brand-gray-500 truncate mb-1">
                              {t('messages.checklistGuest')}: <span className="font-semibold text-brand-black">{userProp?.title}</span>
                            </p>
                          </div>
                        </div>

                        {/* Actions controls column */}
                        <div className="flex flex-row md:flex-col justify-end md:justify-center items-center gap-2 border-t md:border-t-0 md:border-l border-brand-gray-100 pt-4 md:pt-0 md:pl-6 shrink-0">
                          <button
                            onClick={() => router.push(`/messages?swapId=${swap.id}`)}
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
                  <button onClick={() => router.push('/explore')} className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-bold rounded-full">
                    {t('dashboard.browseSpaces')}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: MY LISTED HOMES */}
        {activeTab === 'properties' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-brand-black tracking-tight">{t('dashboard.yourExchangeableSpaces')}</h2>
                <p className="text-xs text-brand-gray-500">{t('dashboard.yourExchangeableSpacesDesc')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {myProperties.map((myProp) => (
                <div key={myProp.id} className="bg-white border border-brand-gray-200/80 rounded-3xl overflow-hidden p-4 shadow-premium hover:shadow-floating transition-all duration-300 flex flex-col gap-4 relative">
                  {/* Thumbnail Image Container */}
                  <div 
                    onClick={() => router.push('/property/' + myProp.id)}
                    className="relative aspect-[4/3] w-full rounded-2xl overflow-hidden bg-brand-gray-100 shadow-sm shrink-0 cursor-pointer group"
                    title={language === 'es' ? 'Ver vista pública' : 'View public page'}
                  >
                    <img 
                      src={myProp.images[0] || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'} 
                      alt={myProp.title} 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    
                    {/* Badges on Top Left */}
                    <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
                      {/* Publish Badge */}
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 bg-white/95 backdrop-blur-sm ${
                        myProp.isPublished !== false 
                          ? 'text-emerald-600 border border-emerald-200/20' 
                          : 'text-amber-600 border border-amber-200/20'
                      }`}>
                        {myProp.isPublished !== false 
                          ? (language === 'es' ? 'Publicado' : 'Published') 
                          : (language === 'es' ? 'Borrador' : 'Draft')
                        }
                      </span>
                      
                      {/* Featured Badge */}
                      {Boolean((myProp as any).isFeatured) && (
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-sm flex items-center gap-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
                          <Sparkles className="w-3 h-3 fill-white/20" />
                          <span>{language === 'es' ? 'Destacado' : 'Featured'}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata */}
                  <div 
                    onClick={() => router.push('/property/' + myProp.id)}
                    className="flex flex-col gap-1 flex-1 cursor-pointer group"
                    title={language === 'es' ? 'Ver vista pública' : 'View public page'}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm text-brand-black tracking-tight truncate max-w-[80%] group-hover:text-brand-accent transition-colors">
                        {myProp.location}, <span className="text-brand-gray-500 font-medium">{myProp.country}</span>
                      </h3>
                      {(() => {
                        const hostReviews = reviews.filter(r => r.reviewedUserId === myProp.hostId);
                        const avgRating = hostReviews.length > 0
                          ? (hostReviews.reduce((sum, r) => sum + r.rating, 0) / hostReviews.length)
                          : (myProp.hostRating || 5.0);
                        return (
                          <div className="flex items-center gap-0.5 text-xs font-semibold">
                            <Star className="w-3 h-3 fill-brand-black text-brand-black" />
                            <span>{avgRating.toFixed(1)}</span>
                          </div>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-brand-gray-500 font-medium truncate group-hover:text-brand-accent/80 transition-colors">
                      {myProp.title}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-brand-gray-500 font-semibold mt-1">
                      <span>{language === 'es' ? formatCount(myProp.bedrooms || 0, 'habitación', 'habitaciones', 'feminine') : `${myProp.bedrooms || 0} bedroom${myProp.bedrooms !== 1 ? 's' : ''}`}</span>
                      <span>•</span>
                      <span>{formatBathrooms(myProp.bathrooms || 0, myProp.halfBathrooms || 0, language === 'es' ? 'es' : 'en')}</span>
                      <span>•</span>
                      <span className="text-brand-accent font-bold">
                        {language === 'es'
                          ? `Swap ${t(`valueRatings.${myProp.valueRating}`).startsWith('valueRatings.') ? myProp.valueRating : t(`valueRatings.${myProp.valueRating}`)}`
                          : `${myProp.valueRating} swap`
                        }
                      </span>
                    </div>
                  </div>

                  {/* Divider line */}
                  <div className="h-px bg-brand-gray-100/80 w-full" />

                  {/* Direct Controls Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 mt-auto">
                    {/* Toggle publish button */}
                    <button 
                      onClick={async () => {
                        await togglePublish(myProp.id);
                        confetti({
                          particleCount: 50,
                          spread: 40,
                          origin: { y: 0.8 }
                        });
                      }}
                      className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-[10px] font-bold cursor-pointer flex-1 min-w-[65px] ${
                        myProp.isPublished !== false 
                          ? 'border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-50' 
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100/80'
                      }`}
                      title={myProp.isPublished !== false ? (language === 'es' ? 'Despublicar' : 'Unpublish') : (language === 'es' ? 'Publicar' : 'Publish')}
                    >
                      {myProp.isPublished !== false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{myProp.isPublished !== false ? (language === 'es' ? 'Ocultar' : 'Hide') : (language === 'es' ? 'Publicar' : 'Publish')}</span>
                    </button>

                    {/* Toggle feature button */}
                    <button 
                      onClick={() => toggleFeature(myProp.id)}
                      className={`p-2 rounded-xl border flex items-center justify-center gap-1.5 transition-all text-[10px] font-bold cursor-pointer flex-1 min-w-[65px] ${
                        Boolean((myProp as any).isFeatured) 
                          ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100/80' 
                          : 'border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-50'
                      }`}
                      title={language === 'es' ? 'Destacar' : 'Feature Listing'}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{Boolean((myProp as any).isFeatured) ? (language === 'es' ? 'Estándar' : 'Standard') : (language === 'es' ? 'Destacar' : 'Feature')}</span>
                    </button>

                    {/* Comprehensive Edit / Manage button */}
                    <button 
                      onClick={() => handleOpenEdit(myProp)}
                      className="p-2 bg-brand-black hover:bg-brand-black/90 text-white rounded-xl text-[10px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 flex-1 min-w-[65px]"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span>{language === 'es' ? 'Gestionar' : 'Manage'}</span>
                    </button>
                  </div>
                </div>
              ))}
              
              {/* Quick Add Home Card mockup */}
              <button 
                onClick={() => setListFormOpen(true)}
                className="border-2 border-dashed border-brand-gray-200/80 hover:border-brand-black hover:bg-white rounded-3xl aspect-[4/3] w-full flex flex-col items-center justify-center gap-3 transition-all duration-300 shadow-premium hover:shadow-floating bg-brand-gray-50 cursor-pointer"
              >
                <div className="p-3 bg-brand-gray-100 rounded-full text-brand-gray-500 group-hover:scale-105 transition-transform duration-200">
                  <Plus className="w-5 h-5 text-brand-black" />
                </div>
                <div className="text-center px-4">
                  <p className="text-sm font-bold text-brand-black">{t('dashboard.listAnotherHome')}</p>
                  <p className="text-xs text-brand-gray-500 mt-0.5">{t('dashboard.listAnotherHomeDesc')}</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: RECEIVED LEADS MVP */}
        {activeTab === 'leads' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-brand-black tracking-tight">
                  {language === 'es' ? 'Leads recibidos' : 'Received leads'}
                </h2>
                <p className="text-xs text-brand-gray-500 font-medium">
                  {language === 'es'
                    ? 'Primeras solicitudes de renta o venta recibidas desde tus propiedades.'
                    : 'Early rent or sale requests received from your properties.'}
                </p>
              </div>
            </div>

            {receivedLeads.length > 0 ? (
              <div className="flex flex-col gap-3">
                {receivedLeads.map((lead) => {
                  const leadProperty = properties.find((property) => property.id === lead.propertyId);
                  const leadUser = users.find((user) => user.id === lead.userId) || MOCK_USERS.find((user) => user.id === lead.userId);
                  const leadTypeLabel = lead.leadType === 'SALE'
                    ? (language === 'es' ? 'Venta' : 'Sale')
                    : lead.leadType === 'MONTHLY_RENT'
                      ? (language === 'es' ? 'Renta mensual' : 'Monthly rent')
                      : (language === 'es' ? 'Renta temporal' : 'Short rent');

                  return (
                    <div key={lead.id} className="bg-white border border-brand-gray-200/80 rounded-3xl p-5 shadow-premium flex flex-col gap-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-brand-accent/10 text-brand-accent flex items-center justify-center shrink-0">
                            <MessageSquare className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-extrabold text-brand-black">
                                {leadProperty?.title || (language === 'es' ? 'Propiedad' : 'Property')}
                              </h3>
                              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-brand-accent/5 text-brand-accent border border-brand-accent/20">
                                {leadTypeLabel}
                              </span>
                              <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-brand-gray-100 text-brand-gray-500">
                                {lead.status}
                              </span>
                            </div>
                            <p className="text-xs text-brand-gray-500 font-semibold mt-1">
                              {leadProperty ? `${leadProperty.location}, ${leadProperty.country}` : lead.propertyId}
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold text-brand-gray-400 uppercase tracking-wider">
                          {new Date(lead.createdAt).toLocaleDateString(language === 'es' ? 'es-MX' : 'en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>

                      <p className="text-sm text-brand-gray-600 font-medium leading-relaxed bg-brand-gray-50/70 rounded-2xl p-4 border border-brand-gray-100">
                        {lead.message}
                      </p>

                      <div className="flex items-center justify-between gap-3 border-t border-brand-gray-100 pt-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <img
                            src={leadUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                            alt={leadUser?.name || 'Lead'}
                            className="w-8 h-8 rounded-full object-cover border border-brand-gray-200"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-brand-black truncate">
                              {leadUser?.name || (language === 'es' ? 'Usuario interesado' : 'Interested user')}
                            </p>
                            <p className="text-[10px] text-brand-gray-400 font-semibold truncate">
                              {language === 'es' ? 'Solicitud capturada' : 'Captured request'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-brand-gray-200/50 shadow-premium p-8">
                <MessageSquare className="w-10 h-10 text-brand-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-brand-black text-sm mb-1">
                  {language === 'es' ? 'Aún no hay leads recibidos' : 'No received leads yet'}
                </h3>
                <p className="text-brand-gray-500 text-xs max-w-sm mx-auto">
                  {language === 'es'
                    ? 'Cuando alguien consulte renta o venta en una de tus propiedades, aparecerá aquí.'
                    : 'When someone asks about rent or sale on one of your properties, it will appear here.'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: MY FAVORITES */}
        {activeTab === 'favorites' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-base font-bold text-brand-black tracking-tight">{t('dashboard.yourFavoritedSpaces')}</h2>
                <p className="text-xs text-brand-gray-500 font-medium">{t('dashboard.yourFavoritedSpacesDesc')}</p>
              </div>
            </div>

            {favoritedProperties.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {favoritedProperties.map((favProp) => (
                  <PropertyCard key={favProp.id} property={favProp} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-3xl border border-brand-gray-200/50 shadow-premium p-8">
                <Heart className="w-10 h-10 text-brand-gray-300 mx-auto mb-3" />
                <h3 className="font-bold text-brand-black text-sm mb-1">{t('dashboard.noFavoritesTitle')}</h3>
                <p className="text-brand-gray-500 text-xs max-w-sm mx-auto mb-4">
                  {t('dashboard.noFavoritesDesc')}
                </p>
                <button
                  onClick={() => router.push('/explore')}
                  className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-full text-xs font-bold"
                >
                  {t('dashboard.exploreHomes')}
                </button>
              </div>
            )}
          </div>
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
                  const partnerUser = users.find((u) => u.id === partnerId) || MOCK_USERS.find((u) => u.id === partnerId);

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
                        <div className="w-24 h-24 rounded-2xl overflow-hidden shrink-0 bg-brand-gray-100 shadow-sm border border-brand-gray-100">
                          <img 
                            src={partnerProp?.images[0] || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80'} 
                            alt={partnerProp?.title || 'Destino'} 
                            className="w-full h-full object-cover" 
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
                            {partnerProp?.title || (language === 'es' ? 'Propiedad AuraSwap' : 'AuraSwap Property')}
                          </h3>
                          
                          <p className="text-xs text-brand-gray-500 font-medium flex items-center gap-1 mb-1">
                            <MapPin className="w-3.5 h-3.5 text-brand-gray-400 shrink-0" />
                            <span className="truncate">
                              {partnerProp ? `${partnerProp.location}, ${partnerProp.country}` : (language === 'es' ? 'Ubicación exclusiva' : 'Exclusive Location')}
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
                          <img 
                            src={partnerUser?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} 
                            alt={partnerUser?.name} 
                            className="w-10 h-10 rounded-full object-cover border border-white shadow-sm ring-2 ring-brand-gray-100 animate-in fade-in duration-200"
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
                  : '5.0';

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
                        {avgRating} <span className="text-xs text-brand-gray-400 font-semibold">/ 5.0</span>
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
                      const reviewer = users.find(u => u.id === rev.reviewerId) || MOCK_USERS.find(u => u.id === rev.reviewerId);
                      
                      return (
                        <div key={rev.id} className="bg-white border border-brand-gray-200/80 rounded-2xl p-5 shadow-premium flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3">
                              <img
                                src={reviewer?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                                alt={reviewer?.name || 'Reviewer'}
                                className="w-10 h-10 rounded-full object-cover border border-white shadow-sm ring-2 ring-brand-gray-100"
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

                          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100/40 w-fit self-end">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>{language === 'es' ? 'Verificado de Confianza' : 'Trust Verified'}</span>
                          </div>
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
                      const reviewed = users.find(u => u.id === rev.reviewedUserId) || MOCK_USERS.find(u => u.id === rev.reviewedUserId);

                      return (
                        <div key={rev.id} className="bg-white border border-brand-gray-200/80 rounded-2xl p-5 shadow-premium flex flex-col gap-3 relative overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <div className="flex items-center justify-between gap-4 flex-wrap">
                            <div className="flex items-center gap-3">
                              <img
                                src={reviewed?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'}
                                alt={reviewed?.name || 'Reviewed'}
                                className="w-10 h-10 rounded-full object-cover border border-white shadow-sm ring-2 ring-brand-gray-100"
                              />
                              <div>
                                <span className="text-xs font-black text-brand-black block">
                                  {reviewed?.name || 'Miembro AuraSwap'}
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
        {listFormOpen && (
          <PropertyWizardModal
            isOpen={listFormOpen}
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
                await addProperty(propertyData);
                setListFormOpen(false);
                window.dispatchEvent(new CustomEvent('auraswap:flow-event', { detail: { event: 'property_created' } }));
              } catch (err) {
                console.error('Error creating property:', err);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* 5. Comprehensive Host Property Management & Edit Modal */}
      <AnimatePresence>
        {editingProperty && (
          <PropertyWizardModal
            isOpen={!!editingProperty}
            onClose={() => {
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('eterna-cancel-speech'));
              }
              setEditingProperty(null);
              if (liveContext.eterna.activeGuidedFlow === 'publish_property') {
                setActiveGuidedFlow(null);
              }
            }}
            initialData={editingProperty}
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
                setEditingProperty(null);
              } catch (err) {
                console.error('Error updating property:', err);
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
                          placeholder="AuraSwap_Guest"
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

      {/* 6. Premium Verified Stars Rating & Review Modal (FASE 4H) */}
      <AnimatePresence>
        {reviewModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
          >
            <div
              className="absolute inset-0 bg-brand-black/40 backdrop-blur-sm"
              onClick={() => {
                if (!isSubmittingReview) {
                  setReviewModalOpen(false);
                }
              }}
            />
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="relative z-10 w-full max-w-md bg-white rounded-3xl p-6 shadow-floating border border-brand-gray-200/60 overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center pb-4 border-b border-brand-gray-100 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                    <Star className="w-5 h-5 fill-current" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-brand-black tracking-tight">
                      {language === 'es' ? 'Valorar Intercambio' : 'Rate Exchange'}
                    </h3>
                    <p className="text-[10px] text-brand-gray-500 font-semibold tracking-tight uppercase">
                      {language === 'es' ? 'Reseña Inmutable' : 'Immutable Review'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(false)}
                  disabled={isSubmittingReview}
                  className="p-1.5 hover:bg-brand-gray-50 text-brand-gray-400 hover:text-brand-black rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 bg-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleReviewSubmit} className="flex flex-col gap-5 pt-4">
                {/* Visual stars rating selector */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-brand-gray-400 uppercase tracking-wide text-center">
                    {language === 'es' ? '¿Cómo calificarías tu experiencia?' : 'How would you rate your experience?'}
                  </span>
                  <div className="flex items-center gap-1.5 text-amber-400 py-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        disabled={isSubmittingReview}
                        className="p-1 hover:scale-110 transition-transform cursor-pointer focus:outline-none"
                      >
                        <Star
                          className={`w-8 h-8 transition-colors ${
                            star <= reviewRating ? 'fill-current text-amber-400' : 'text-brand-gray-200 hover:text-amber-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  <span className="text-xs font-black text-brand-black">
                    {reviewRating === 5 && (language === 'es' ? '¡Excelente! 🌟' : 'Excellent! 🌟')}
                    {reviewRating === 4 && (language === 'es' ? 'Muy Bueno 👍' : 'Very Good 👍')}
                    {reviewRating === 3 && (language === 'es' ? 'Aceptable 👌' : 'Good 👌')}
                    {reviewRating === 2 && (language === 'es' ? 'Regular 😐' : 'Fair 😐')}
                    {reviewRating === 1 && (language === 'es' ? 'Insatisfactorio 👎' : 'Unsatisfactory 👎')}
                  </span>
                </div>

                {/* Comment textarea */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-brand-gray-500">
                    {language === 'es' ? 'Tu comentario verificado' : 'Your verified feedback'}
                  </label>
                  <textarea
                    required
                    placeholder={
                      language === 'es'
                        ? 'Describe cómo fue la estancia, la comunicación y el intercambio. Tu reseña permanecerá fija como pilar de reputación...'
                        : 'Describe how the stay, communication, and exchange went. Your feedback will remain fixed as a pillar of reputation...'
                    }
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    disabled={isSubmittingReview}
                    className="w-full h-28 p-3 bg-white border border-brand-gray-200 rounded-xl font-medium outline-none focus:border-brand-accent transition-colors resize-none leading-relaxed text-xs cursor-text"
                    style={{ cursor: 'text', caretColor: '#6366f1', color: '#09090b' }}
                  />
                </div>

                {/* Immutable system warning badge */}
                <div className="bg-brand-gray-50/80 p-3 rounded-2xl border border-brand-gray-200/40 text-[10px] text-brand-gray-500 font-medium leading-relaxed flex gap-2">
                  <span className="text-lg shrink-0">🔒</span>
                  <span>
                    {language === 'es'
                      ? 'Nota de Integridad: Una vez publicada, no podrás editar, modificar ni eliminar esta valoración. Únicamente administradores de AuraSwap podrán intervenir en disputas graves.'
                      : 'Integrity Note: Once posted, you will not be able to edit, modify, or delete this review. Only AuraSwap administrators can intervene under severe disputes.'}
                  </span>
                </div>

                {/* Footer buttons */}
                <div className="flex items-center justify-end border-t border-brand-gray-100 pt-4 shrink-0 gap-3 bg-white z-10">
                  <button
                    type="button"
                    onClick={() => setReviewModalOpen(false)}
                    disabled={isSubmittingReview}
                    className="px-4 py-2 border border-brand-gray-200 hover:bg-brand-gray-50 text-brand-gray-500 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 bg-white"
                  >
                    {t('details.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview || !reviewComment.trim()}
                    className={`px-5 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                      isSubmittingReview || !reviewComment.trim() ? 'bg-brand-gray-300 cursor-not-allowed' : ''
                    }`}
                  >
                    {isSubmittingReview ? (
                      <span>{language === 'es' ? 'Publicando...' : 'Posting...'}</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{language === 'es' ? 'Publicar Reseña' : 'Post Review'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
      <DashboardPageContent />
    </React.Suspense>
  );
}
