"use client";

import React, { useEffect, useState, useMemo, useSyncExternalStore } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useSwap } from '@/lib/context/SwapContext';
import { useTranslation } from '@/lib/context/LanguageContext';
import AuthGuard from '@/components/AuthGuard';
import KycReviewPanel from '@/components/admin/KycReviewPanel';
import ProfileAvatar from '@/components/ProfileAvatar';
import PublisherOnboardingModal from '@/components/PublisherOnboardingModal';
import { formatPropertyLocation } from '@/lib/textHelpers';
import type { Property } from '@/lib/types';
import { 
  Building, RefreshCw, FileText, 
  CheckCircle, AlertTriangle, Search,
  ChevronLeft, ChevronRight,
  Trash2, Lock, Unlock,
  UserCheck, Check, Calendar,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnalyticsService } from '@/lib/services/AnalyticsService';
import confetti from 'canvas-confetti';

// Property media may come from arbitrary publisher-provided hosts. `unoptimized`
// preserves those original URLs without opening an unsafe wildcard remotePattern.
import {
  DEFAULT_ETERNA_VOICE_ENGINE,
  type EternaVoiceEngine,
  getEternaVoiceEngine,
  loadGlobalEternaVoiceSettings,
  saveGlobalEternaVoiceSettings,
} from '@/lib/eterna/voiceConfig';
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
import {
  PROPERTY_WIZARD_DRAFT_EVENT,
  readPropertyWizardDraft,
  removePropertyWizardDraft,
  type PropertyWizardDraft,
} from '@/lib/propertyWizardDraft';
import { AdminHeader, AdminNavigation } from './AdminChrome';
import { AdminPropertiesTab } from './AdminPropertiesTab';
import { AdminPropertyDrawer } from './AdminPropertyDrawer';
import { AdminUserDrawer } from './AdminUserDrawer';
import {
  filterAdminSwaps,
  filterAdminUsers,
  filterAndSortAdminProperties,
  getAdminPropertyCollectionStats,
  getPendingAdminPropertyReviews,
  getSelectedAdminUserDetails,
  paginateAdminItems,
  wizardDraftMatchesAdminFilters,
} from './adminData';
import { AdminOverviewTab } from './AdminOverviewTab';
import { AdminReportsTab } from './AdminReportsTab';
import { AdminSettingsTab } from './AdminSettingsTab';
import {
  ADMIN_PAGINATION_LIMIT,
  INITIAL_ADMIN_AUDIT_LOG,
  type AdminAuditEntry,
  type AdminPropertySortField,
  type AdminPropertyStatusFilter,
  type AdminTab,
} from './adminTypes';

const subscribeToHydration = () => () => {};

function DeferredModalFallback() {
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-brand-black/45 backdrop-blur-sm">
      <Loader2 className="h-8 w-8 animate-spin text-white" aria-label="Cargando editor" />
    </div>
  );
}

const PropertyEditorModal = dynamic(
  () => import('@/features/properties/components/PropertyEditorModal'),
  { ssr: false, loading: DeferredModalFallback },
);

const PropertyWizardModal = dynamic(
  () => import('@/features/properties/components/PropertyWizardModal'),
  { ssr: false, loading: DeferredModalFallback },
);

export default function AdminPage() {
  const { t } = useTranslation();
  const { 
    currentUser, 
    properties, 
    users, 
    swaps,
    updateProperty, 
    deleteProperty, 
    togglePublish, 
    toggleFeature,
    addProperty,
    toggleHostVerified, 
    updateUserRole, 
    toggleUserSuspension,
    updateSwapStatus,
    deleteSwap,
    createSwapDispute,
    resolveSwapDispute
  } = useSwap();

  // Tab State
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

  // Search & Filtering States
  const [propertySearch, setPropertySearch] = useState('');
  const [propertyTypeFilter, setPropertyTypeFilter] = useState('All');
  const [propertyTierFilter, setPropertyTierFilter] = useState('All');
  const [propertyStatusFilter, setPropertyStatusFilter] = useState<AdminPropertyStatusFilter>('All');
  const [propertySortField, setPropertySortField] = useState<AdminPropertySortField>('title');
  const [propertySortAsc, setPropertySortAsc] = useState(true);
  const [propertyPage, setPropertyPage] = useState(1);
  const [publishingPropertyId, setPublishingPropertyId] = useState<string | null>(null);
  const [publicationNotice, setPublicationNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('All');
  const [userKycFilter, setUserKycFilter] = useState('All');
  const [userPage, setUserPage] = useState(1);

  const [swapSearch, setSwapSearch] = useState('');
  const [swapStatusFilter, setSwapStatusFilter] = useState('All');
  const [swapPage, setSwapPage] = useState(1);

  // System Settings States
  const [verificationFee, setVerificationFee] = useState(29);
  const [commissionRate, setCommissionRate] = useState(1.5);
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [voiceEngine, setVoiceEngine] = useState<EternaVoiceEngine>(DEFAULT_ETERNA_VOICE_ENGINE);
  const [voiceEngineStatus, setVoiceEngineStatus] = useState<Record<EternaVoiceEngine, boolean>>({
    fishaudio: false,
    browser: true,
  });
  const [geminiActive, setGeminiActive] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auraswap_gemini_active') !== 'false';
    }
    return true;
  });

  const toggleGemini = () => {
    const newVal = !geminiActive;
    setGeminiActive(newVal);
    localStorage.setItem('auraswap_gemini_active', String(newVal));
    window.dispatchEvent(new CustomEvent('auraswap:gemini-active-changed', { detail: { active: newVal } }));
  };

  useEffect(() => {
    const storedVoiceEngine = getEternaVoiceEngine();
    queueMicrotask(() => setVoiceEngine(storedVoiceEngine));
    let active = true;
    loadGlobalEternaVoiceSettings()
      .then(settings => {
        if (!active) return;
        setVoiceEngine(settings.engine);
      })
      .catch(error => {
        if (!active) return;
        console.warn('[Admin Voice Settings] No se pudo cargar la configuración global.', error);
        setSettingsError('No se pudo cargar el motor global. Se muestra la copia guardada en este navegador.');
      });
    fetch('/api/voz', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(data => {
        if (!active || !data?.engines) return;
        setVoiceEngineStatus({
          fishaudio: Boolean(data.engines.fishaudio?.configured),
          browser: true,
        });
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);


  // Property Form Drawer States
  const [propertyDrawerOpen, setPropertyDrawerOpen] = useState(false);
  const [editingPropertyId] = useState<string | null>(null);
  const [cmsEditorPropertyId, setCmsEditorPropertyId] = useState<string | null>(null);
  const [openPropertyMenuId, setOpenPropertyMenuId] = useState<string | null>(null);
  const [propertyWizardOpen, setPropertyWizardOpen] = useState(false);
  const [publisherModalOpen, setPublisherModalOpen] = useState(false);
  const [publisherGateLoading, setPublisherGateLoading] = useState(false);
  const [, setPublisherGateError] = useState('');
  const [verifiedPublisherType, setVerifiedPublisherType] = useState<PublisherRepresentativeType | null>(null);
  const [wizardDraft, setWizardDraft] = useState<PropertyWizardDraft | null>(null);
  
  // Property Form Fields
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formType, setFormType] = useState<'Apartment' | 'Beach House' | 'Cabin' | 'Penthouse' | 'Villa' | 'Loft'>('Apartment');
  const [formLocation, setFormLocation] = useState('');
  const [formCountry, setFormCountry] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formTier, setFormTier] = useState<'Premium' | 'Luxury' | 'Exclusive' | 'Curated'>('Premium');
  const [formImageUrls, setFormImageUrls] = useState('');
  const [formRules, setFormRules] = useState('');
  const [formBedrooms, setFormBedrooms] = useState(2);
  const [formBathrooms, setFormBathrooms] = useState(2);
  const [formGuests, setFormGuests] = useState(4);
  const [formAmenities, setFormAmenities] = useState<string[]>([]);

  // User History Drawer States
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Custom dispute trigger state
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeSwapId, setDisputeSwapId] = useState('');
  const [disputeReasonText, setDisputeReasonText] = useState('');

  // Live Audits Feed (Local mock event list which updates upon administrative actions, using i18n keys)
  const [auditLog, setAuditLog] = useState<AdminAuditEntry[]>(INITIAL_ADMIN_AUDIT_LOG);

  const addAudit = (
    type: string,
    key: string,
    params: AdminAuditEntry['params'],
    status: AdminAuditEntry['status'],
  ) => {
    setAuditLog(prev => [
      { id: Date.now(), type, key, params, time: 'justNow', status },
      ...prev.slice(0, 7)
    ]);
  };

  useEffect(() => {
    const refreshDraft = () => {
      if (!propertyWizardOpen) setWizardDraft(readPropertyWizardDraft());
    };
    refreshDraft();
    window.addEventListener(PROPERTY_WIZARD_DRAFT_EVENT, refreshDraft);
    const expirationTimer = window.setInterval(refreshDraft, 60_000);
    return () => {
      window.removeEventListener(PROPERTY_WIZARD_DRAFT_EVENT, refreshDraft);
      window.clearInterval(expirationTimer);
    };
  }, [propertyWizardOpen]);

  // 1. Reactive statistics calculations via AnalyticsService
  const dashboardStats = useMemo(() => {
    return AnalyticsService.getDashboardMetrics(properties, users, swaps);
  }, [properties, users, swaps]);

  const countryMetrics = useMemo(() => {
    return AnalyticsService.getCountryListingMetrics(properties);
  }, [properties]);

  // 2. Properties CMS processing
  const sortedProperties = useMemo(() => {
    return filterAndSortAdminProperties(properties, {
      search: propertySearch,
      type: propertyTypeFilter,
      tier: propertyTierFilter,
      status: propertyStatusFilter,
      sortField: propertySortField,
      sortAscending: propertySortAsc,
    });
  }, [
    properties,
    propertySearch,
    propertySortAsc,
    propertySortField,
    propertyStatusFilter,
    propertyTierFilter,
    propertyTypeFilter,
  ]);

  const wizardDraftMatchesFilters = useMemo(
    () => wizardDraftMatchesAdminFilters(wizardDraft, {
      search: propertySearch,
      type: propertyTypeFilter,
      tier: propertyTierFilter,
      status: propertyStatusFilter,
    }),
    [propertySearch, propertyStatusFilter, propertyTierFilter, propertyTypeFilter, wizardDraft],
  );

  const paginatedProperties = useMemo(() => {
    const draftOffset = wizardDraftMatchesFilters ? 1 : 0;
    const start = Math.max(0, (propertyPage - 1) * ADMIN_PAGINATION_LIMIT - draftOffset);
    const pageCapacity = propertyPage === 1
      ? ADMIN_PAGINATION_LIMIT - draftOffset
      : ADMIN_PAGINATION_LIMIT;
    return sortedProperties.slice(start, start + pageCapacity);
  }, [sortedProperties, propertyPage, wizardDraftMatchesFilters]);

  const totalPropertyCount = sortedProperties.length + (wizardDraftMatchesFilters ? 1 : 0);
  const totalPropertyPages = Math.ceil(totalPropertyCount / ADMIN_PAGINATION_LIMIT);
  const pendingPropertyReviews = useMemo(
    () => getPendingAdminPropertyReviews(properties),
    [properties],
  );
  const cmsEditorProperty = useMemo(
    () => properties.find((property) => property.id === cmsEditorPropertyId) || null,
    [cmsEditorPropertyId, properties],
  );
  const propertyCollectionStats = useMemo(
    () => getAdminPropertyCollectionStats(properties, Boolean(wizardDraft)),
    [properties, wizardDraft],
  );
  const shouldShowWizardDraft = wizardDraftMatchesFilters && propertyPage === 1;

  // 3. Users CRM processing
  const filteredUsers = useMemo(
    () => filterAdminUsers(users, userSearch, userRoleFilter, userKycFilter),
    [users, userSearch, userRoleFilter, userKycFilter],
  );

  const paginatedUsers = useMemo(
    () => paginateAdminItems(filteredUsers, userPage, ADMIN_PAGINATION_LIMIT),
    [filteredUsers, userPage],
  );

  const totalUserPages = Math.ceil(filteredUsers.length / ADMIN_PAGINATION_LIMIT);

  // 4. Swaps CRM processing
  const filteredSwaps = useMemo(
    () => filterAdminSwaps(swaps, users, swapSearch, swapStatusFilter),
    [swaps, users, swapSearch, swapStatusFilter],
  );

  const paginatedSwaps = useMemo(
    () => paginateAdminItems(filteredSwaps, swapPage, ADMIN_PAGINATION_LIMIT),
    [filteredSwaps, swapPage],
  );

  const totalSwapPages = Math.ceil(filteredSwaps.length / ADMIN_PAGINATION_LIMIT);
  const isHydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );

  // Fetch details for the selected user history drawer
  const selectedUserDetails = useMemo(
    () => getSelectedAdminUserDetails(selectedUserId, users, properties, swaps),
    [selectedUserId, users, properties, swaps],
  );

  // Keep the server and the first browser render identical while the persisted
  // authentication session is restored.
  if (!isHydrated) {
    return <AuthGuard requireAdmin />;
  }

  // Keep the hook order stable while the authentication session is restored.
  if (!currentUser) {
    return <AuthGuard />;
  }

  if (currentUser.role !== 'ADMIN') {
    return <AuthGuard requireAdmin />;
  }

  const openAdminPublishFlow = async () => {
    if (publisherGateLoading) return;
    setOpenPropertyMenuId(null);
    setPublisherGateLoading(true);
    setPublisherGateError('');
    try {
      const publisherProfile = await getMyPublisherProfile(currentUser.id);
      if (publisherProfile) {
        setVerifiedPublisherType(publisherProfile.representativeType);
        setPropertyWizardOpen(true);
      } else {
        setPublisherModalOpen(true);
      }
    } catch (error) {
      console.error('[Admin] Publisher profile check failed:', error);
      if (error instanceof PublisherSessionRequiredError) {
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        localStorage.removeItem('auraswap_current_user');
        window.location.assign('/login?intent=publish&next=%2Fadmin');
        return;
      }
      const message = error instanceof Error
        ? error.message
        : 'No pudimos comprobar tu perfil de publicación.';
      setPublisherGateError(message);
      setPublicationNotice({ type: 'error', message });
    } finally {
      setPublisherGateLoading(false);
    }
  };

  const handleAdminWizardSubmit = async (propertyData: any) => {
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
    setPropertyWizardOpen(false);
    setWizardDraft(null);
    setPublicationNotice({
      type: 'success',
      message: `“${createdProperty.title}” fue enviada correctamente.`,
    });
    addAudit('PROPERTY', 'auditPropDesc', {
      name: currentUser.name,
      title: createdProperty.title,
    }, 'success');
  };

  // Handler to open property drawer for editing
  const handleOpenEditDrawer = (property: any) => {
    setCmsEditorPropertyId(property.id);
  };

  // Save/Create property handler
  const handleSaveProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle || !formLocation || !formCountry || !formDesc) return;

    const urls = formImageUrls.split('\n').map(u => u.trim()).filter(Boolean);
    const finalUrls = urls.length > 0 ? urls : ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'];
    const rulesList = formRules.split('\n').map(r => r.trim()).filter(Boolean);

    if (editingPropertyId) {
      updateProperty(editingPropertyId, {
        title: formTitle,
        description: formDesc,
        type: formType,
        location: formLocation,
        country: formCountry,
        address: formAddress,
        valueRating: formTier,
        images: finalUrls,
        rules: rulesList,
        bedrooms: formBedrooms,
        bathrooms: formBathrooms,
        maxGuests: formGuests,
        amenities: formAmenities
      });
      addAudit('PROPERTY', 'auditPropDesc', { name: currentUser.name, title: formTitle }, 'success');
    } else {
      addProperty({
        title: formTitle,
        description: formDesc,
        type: formType,
        location: formLocation,
        country: formCountry,
        address: formAddress,
        valueRating: formTier,
        images: finalUrls,
        rules: rulesList,
        bedrooms: formBedrooms,
        bathrooms: formBathrooms,
        maxGuests: formGuests,
        amenities: formAmenities,
        availableStart: '2026-06-01',
        availableEnd: '2026-12-31'
      });
      addAudit('PROPERTY', 'auditPropDesc', { name: currentUser.name, title: formTitle }, 'success');
      confetti({
        particleCount: 50,
        spread: 45,
        origin: { y: 0.7 }
      });
    }

    setPropertyDrawerOpen(false);
  };

  const handleTogglePublish = async (id: string, name: string) => {
    setPublishingPropertyId(id);
    setPublicationNotice(null);
    try {
      const prop = properties.find(p => p.id === id);
      const nextPublished = prop ? !prop.isPublished : false;
      await togglePublish(id);
      addAudit('PROPERTY', 'auditPropDesc', { name: currentUser.name, title: name }, nextPublished ? 'success' : 'info');
      setPublicationNotice({
        type: 'success',
        message: nextPublished
          ? `“${name}” fue aprobada y ya está visible en el Explorador.`
          : `“${name}” fue retirada del Explorador.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo actualizar la publicación.';
      setPublicationNotice({
        type: 'error',
        message: `No se pudo aprobar “${name}”. ${message}`,
      });
    } finally {
      setPublishingPropertyId(null);
    }
  };

  const handleToggleFeature = (id: string, name: string) => {
    toggleFeature(id);
    addAudit('PROPERTY', 'auditPropDesc', { name: currentUser.name, title: name }, 'success');
  };

  const handleCmsEditorSave = async (patch: Partial<Property>) => {
    if (!cmsEditorProperty) return;
    await updateProperty(cmsEditorProperty.id, patch);
    addAudit('PROPERTY', 'auditPropDesc', {
      name: currentUser.name,
      title: patch.title || cmsEditorProperty.title,
    }, 'success');
    setPublicationNotice({
      type: 'success',
      message: `Los cambios de “${patch.title || cmsEditorProperty.title}” quedaron guardados.`,
    });
  };

  const handleCmsEditorDelete = async (propertyId: string) => {
    const property = properties.find((item) => item.id === propertyId);
    await deleteProperty(propertyId);
    addAudit('PROPERTY', 'auditPropDesc', {
      name: currentUser.name,
      title: property?.title || propertyId,
    }, 'alert');
    setCmsEditorPropertyId(null);
  };

  const handleDuplicateProperty = async (property: Property) => {
    setOpenPropertyMenuId(null);
    try {
      const duplicableFields: Record<string, unknown> = { ...property };
      [
        'id', 'internalCode', 'createdAt', 'updatedAt', 'publishedAt',
        'hostId', 'hostName', 'hostAvatar', 'hostVerified', 'hostRating',
        'hostReviewsCount', 'auraScore', 'reviews',
      ].forEach((key) => delete duplicableFields[key]);
      const duplicate = await addProperty({
        ...duplicableFields,
        title: `${property.title} (copia)`,
        isFeatured: false,
        isPublished: false,
        folderStatus: 'DRAFT',
        offerings: (property.offerings || []).map((offering) => ({ ...offering, status: 'DRAFT' as const })),
      } as any);
      await updateProperty(duplicate.id, {
        isPublished: false,
        folderStatus: 'DRAFT',
        internalCode: '',
        publishedAt: null,
        isFeatured: false,
      });
      setPublicationNotice({
        type: 'success',
        message: `Se creó “${duplicate.title}” como borrador.`,
      });
      addAudit('PROPERTY', 'auditPropDesc', {
        name: currentUser.name,
        title: duplicate.title,
      }, 'success');
    } catch (error) {
      setPublicationNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo duplicar la propiedad.',
      });
    }
  };

  const handleDeletePropertyFromMenu = async (property: Property) => {
    setOpenPropertyMenuId(null);
    if (!window.confirm(`¿Eliminar definitivamente “${property.title}”?`)) return;
    try {
      await handleCmsEditorDelete(property.id);
      setPublicationNotice({
        type: 'success',
        message: `“${property.title}” fue eliminada.`,
      });
    } catch (error) {
      setPublicationNotice({
        type: 'error',
        message: error instanceof Error ? error.message : 'No se pudo eliminar la propiedad.',
      });
    }
  };

  const handleDraftDelete = () => {
    if (!window.confirm('¿Eliminar este borrador? No podrás recuperarlo.')) return;
    removePropertyWizardDraft();
    setWizardDraft(null);
    setPublicationNotice({ type: 'success', message: 'El borrador fue eliminado.' });
  };

  // User CRUD hooks
  const handleToggleHostVerified = (userId: string, name: string) => {
    toggleHostVerified(userId);
    addAudit('USER', 'auditUserDesc', { name }, 'success');
  };

  const handleToggleSuspension = (userId: string, name: string) => {
    toggleUserSuspension(userId);
    addAudit('USER', 'auditUserDesc', { name }, 'alert');
  };

  const handleChangeRole = (userId: string, role: 'ADMIN' | 'INTERNAL_ADVISOR' | 'HOST' | 'MEMBER', name: string) => {
    updateUserRole(userId, role);
    addAudit('USER', 'auditUserDesc', { name }, 'info');
  };

  // Swap Actions
  const handleSwapStatusOverride = (swapId: string, status: any) => {
    updateSwapStatus(swapId, status);
    addAudit('SWAP', 'auditDisputeDesc', { id: swapId }, 'success');
  };

  const handleDeleteSwap = (swapId: string) => {
    if (confirm(t('admin.confirmDeleteSwap', { id: swapId }))) {
      deleteSwap(swapId);
      addAudit('SWAP', 'auditDisputeDesc', { id: swapId }, 'alert');
    }
  };

  // Dispute Triggers
  const handleOpenDisputeModal = (swapId: string) => {
    setDisputeSwapId(swapId);
    setDisputeReasonText('');
    setDisputeModalOpen(true);
  };

  const handleTriggerDispute = () => {
    if (!disputeReasonText) return;
    createSwapDispute(disputeSwapId, disputeReasonText);
    addAudit('DISPUTE', 'auditDisputeDesc', { id: disputeSwapId }, 'alert');
    setDisputeModalOpen(false);
  };

  const handleResolveSwapDispute = (swapId: string) => {
    resolveSwapDispute(swapId);
    addAudit('DISPUTE', 'auditDisputeDesc', { id: swapId }, 'success');
  };

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    setSettingsSuccess(false);
    setSettingsError('');
    try {
      await saveGlobalEternaVoiceSettings({ engine: voiceEngine });
      setSettingsSuccess(true);
      addAudit('SETTINGS', 'auditSettingDesc', {}, 'success');
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (error) {
      console.error('[Admin Voice Settings] No se pudo guardar la configuración global.', error);
      setSettingsError('No se pudo guardar el motor global. Confirma que tu sesión tenga permisos de administrador.');
    } finally {
      setSettingsSaving(false);
    }
  };

  // Multi-select handler for amenities
  const handleToggleAmenityCheckbox = (amenity: string) => {
    setFormAmenities(prev => 
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-12 md:px-24 py-10 relative">
      
      {/* Glow ambient lights */}
      <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-brand-accent/5 filter blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-20 left-10 w-80 h-80 rounded-full bg-brand-rose/5 filter blur-3xl pointer-events-none -z-10" />

      <AdminHeader />

      {/* Cockpit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        <AdminNavigation
          activeTab={activeTab}
          propertyReviewCount={pendingPropertyReviews.length}
          propertyCount={properties.length}
          userCount={users.length}
          swapCount={swaps.length}
          disputedSwapCount={swaps.filter((swap) => swap.isDisputed).length}
          onTabChange={setActiveTab}
        />

        {/* Dynamic Display Panel */}
        <div className="lg:col-span-3">
          
          <AnimatePresence mode="wait">
            
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <AdminOverviewTab
                key="overview"
                stats={dashboardStats}
                countryMetrics={countryMetrics}
                totalProperties={properties.length}
                auditLog={auditLog}
              />
            )}

            {activeTab === 'propertyReviews' && (
              <motion.section
                key="propertyReviews"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="overflow-hidden rounded-3xl border border-brand-gray-200/70 bg-white shadow-premium"
              >
                <div className="border-b border-brand-gray-100 bg-gradient-to-br from-amber-50 via-white to-violet-50 px-6 py-6 sm:px-8">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700">
                    Moderación de inventario
                  </span>
                  <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-brand-black">
                        Propiedades por aprobar
                      </h2>
                      <p className="mt-1 max-w-2xl text-xs font-semibold leading-relaxed text-brand-gray-500">
                        Revisa la ficha, fotografías y datos comerciales. Al aprobar, sus modalidades se activan y la propiedad aparece inmediatamente en el Explorador.
                      </p>
                    </div>
                    <div className="inline-flex w-fit items-center gap-2 rounded-full border border-amber-200 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-wide text-amber-700">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      {pendingPropertyReviews.length} pendientes
                    </div>
                  </div>
                </div>

                {publicationNotice && (
                  <div className={`mx-6 mt-5 rounded-2xl border px-4 py-3 text-xs font-bold sm:mx-8 ${
                    publicationNotice.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                  }`}>
                    {publicationNotice.message}
                  </div>
                )}

                <div className="p-5 sm:p-8">
                  {pendingPropertyReviews.length === 0 ? (
                    <div className="flex min-h-64 flex-col items-center justify-center rounded-3xl border border-dashed border-brand-gray-200 bg-brand-gray-50/60 p-8 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle className="h-6 w-6" />
                      </div>
                      <h3 className="mt-4 text-base font-black text-brand-black">Bandeja al día</h3>
                      <p className="mt-1 max-w-sm text-xs font-semibold text-brand-gray-500">
                        No hay propiedades esperando aprobación en este momento.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                      {pendingPropertyReviews.map((property) => {
                        const owner = users.find((user) => user.id === property.hostId);
                        const isPublishing = publishingPropertyId === property.id;
                        return (
                          <article key={property.id} className="overflow-hidden rounded-3xl border border-brand-gray-200 bg-white shadow-sm">
                            <div className="relative aspect-[16/8] overflow-hidden bg-brand-gray-100">
                              {property.images?.[0] ? (
                                <Image
                                  src={property.images[0]}
                                  alt={property.title}
                                  fill
                                  sizes="(max-width: 1279px) 100vw, 50vw"
                                  className="object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-brand-gray-400">
                                  <Building className="h-9 w-9" />
                                </div>
                              )}
                              <span className="absolute left-3 top-3 rounded-full bg-amber-500 px-3 py-1 text-[9px] font-black uppercase tracking-wide text-white shadow-lg">
                                En revisión
                              </span>
                              <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 text-[9px] font-black text-white backdrop-blur">
                                {property.images?.length || 0} fotos
                              </span>
                            </div>
                            <div className="p-5">
                              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-violet-600">
                                {property.internalCode || property.shortCode || property.id.slice(0, 8)}
                              </p>
                              <h3 className="mt-1 line-clamp-2 text-base font-black leading-tight text-brand-black">
                                {property.title}
                              </h3>
                              <div className="mt-3 grid grid-cols-2 gap-3 rounded-2xl bg-brand-gray-50 p-3 text-[10px] font-bold text-brand-gray-600">
                                <div>
                                  <span className="block text-[8px] uppercase tracking-wide text-brand-gray-400">Ubicación</span>
                                  <span className="mt-0.5 block line-clamp-1">{formatPropertyLocation(property.location, property.country)}</span>
                                </div>
                                <div>
                                  <span className="block text-[8px] uppercase tracking-wide text-brand-gray-400">Publicador</span>
                                  <span className="mt-0.5 block line-clamp-1">{owner?.name || property.hostName || 'Usuario registrado'}</span>
                                </div>
                              </div>
                              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditDrawer(property)}
                                  className="min-h-11 flex-1 rounded-full border border-brand-gray-200 px-4 text-[10px] font-black uppercase tracking-wide text-brand-black transition hover:border-brand-black"
                                >
                                  Revisar ficha
                                </button>
                                <button
                                  type="button"
                                  disabled={isPublishing}
                                  onClick={() => handleTogglePublish(property.id, property.title)}
                                  className="inline-flex min-h-11 flex-[1.3] items-center justify-center gap-2 rounded-full bg-brand-black px-4 text-[10px] font-black uppercase tracking-wide text-white shadow-lg transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
                                >
                                  {isPublishing ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                  {isPublishing ? 'Publicando…' : 'Aprobar y publicar'}
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.section>
            )}

            {/* TAB 2: PROPERTIES CMS */}
            {activeTab === 'properties' && (
              <AdminPropertiesTab
                properties={properties}
                wizardDraft={wizardDraft}
                propertyCollectionStats={propertyCollectionStats}
                publisherGateLoading={publisherGateLoading}
                propertySearch={propertySearch}
                propertyTypeFilter={propertyTypeFilter}
                propertyStatusFilter={propertyStatusFilter}
                propertyTierFilter={propertyTierFilter}
                propertySortField={propertySortField}
                propertySortAscending={propertySortAsc}
                paginatedProperties={paginatedProperties}
                shouldShowWizardDraft={shouldShowWizardDraft}
                openPropertyMenuId={openPropertyMenuId}
                propertyPage={propertyPage}
                totalPropertyPages={totalPropertyPages}
                totalPropertyCount={totalPropertyCount}
                onCreateProperty={openAdminPublishFlow}
                onSearchChange={(value) => {
                  setPropertySearch(value);
                  setPropertyPage(1);
                }}
                onTypeFilterChange={(value) => {
                  setPropertyTypeFilter(value);
                  setPropertyPage(1);
                }}
                onStatusFilterChange={(value) => {
                  setPropertyStatusFilter(value);
                  setPropertyPage(1);
                }}
                onTierFilterChange={(value) => {
                  setPropertyTierFilter(value);
                  setPropertyPage(1);
                }}
                onSortChange={(field, ascending) => {
                  setPropertySortField(field);
                  setPropertySortAsc(ascending);
                }}
                onPageChange={setPropertyPage}
                onMenuIdChange={setOpenPropertyMenuId}
                onDraftDelete={handleDraftDelete}
                onOpenProperty={handleOpenEditDrawer}
                onDuplicateProperty={handleDuplicateProperty}
                onTogglePublish={handleTogglePublish}
                onDeleteProperty={handleDeletePropertyFromMenu}
                onToggleFeature={handleToggleFeature}
              />
            )}
            {/* TAB 3: USERS CRM */}
            {activeTab === 'users' && (
              <motion.div
                key="users"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-brand-gray-200/70 rounded-3xl shadow-premium p-6 sm:p-8"
              >
                <div className="mb-6">
                  <h2 className="text-base font-black text-brand-black tracking-tight">{t('admin.crmTitle')}</h2>
                  <p className="text-xs text-brand-gray-500 mt-0.5">
                    {t('admin.crmDesc')}
                  </p>
                </div>

                <KycReviewPanel />

                {/* Filters Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="relative">
                    <Search className="w-4 h-4 text-brand-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={t('admin.searchUsers')}
                      value={userSearch}
                      onChange={(e) => { setUserSearch(e.target.value); setUserPage(1); }}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-gray-200/60 focus:outline-none focus:ring-2 focus:ring-brand-accent/10 focus:border-brand-accent text-xs font-semibold bg-brand-gray-50/50"
                    />
                  </div>

                  <div>
                    <select
                      value={userRoleFilter}
                      onChange={(e) => { setUserRoleFilter(e.target.value); setUserPage(1); }}
                      className="w-full px-3 py-2.5 rounded-xl border border-brand-gray-200/60 text-xs font-semibold bg-brand-gray-50/50 focus:outline-none focus:border-brand-accent"
                    >
                      <option value="All">{t('admin.roleSelector')}</option>
                      <option value="ADMIN">ADMIN</option>
                      <option value="INTERNAL_ADVISOR">ASESOR INTERNO</option>
                      <option value="HOST">HOST</option>
                      <option value="MEMBER">MEMBER</option>
                    </select>
                  </div>

                  <div>
                    <select
                      value={userKycFilter}
                      onChange={(e) => { setUserKycFilter(e.target.value); setUserPage(1); }}
                      className="w-full px-3 py-2.5 rounded-xl border border-brand-gray-200/60 text-xs font-semibold bg-brand-gray-50/50 focus:outline-none focus:border-brand-accent"
                    >
                      <option value="All">{t('admin.kycSelector')}</option>
                      <option value="VERIFIED">VERIFIED</option>
                      <option value="PENDING">PENDING</option>
                      <option value="FAILED">FAILED</option>
                    </select>
                  </div>
                </div>

                {/* Table directory */}
                <div className="overflow-x-auto border border-brand-gray-150 rounded-2xl mb-6">
                  <table className="w-full border-collapse text-left text-xs font-semibold text-brand-black">
                    <thead>
                      <tr className="bg-brand-gray-50 border-b border-brand-gray-200/60 text-brand-gray-500 uppercase tracking-widest text-[9px] font-black select-none">
                        <th className="p-4">{t('admin.colUser')}</th>
                        <th className="p-4">{t('admin.colRole')}</th>
                        <th className="p-4">{t('admin.colKyc')}</th>
                        <th className="p-4 text-center">{t('admin.colBadge')}</th>
                        <th className="p-4 text-center">{t('admin.colSwaps')}</th>
                        <th className="p-4 text-center">{t('admin.colStatus')}</th>
                        <th className="p-4 text-right">{t('admin.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-brand-gray-400 font-bold">
                            {t('admin.emptyUsersMsg')}
                          </td>
                        </tr>
                      ) : (
                        paginatedUsers.map((u) => (
                          <tr key={u.id} className={`border-b border-brand-gray-100 hover:bg-brand-gray-50/50 transition-colors ${u.isSuspended ? 'bg-rose-50/5' : ''}`}>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <ProfileAvatar
                                  src={u.avatar}
                                  name={u.name}
                                  className="h-9 w-9 border border-brand-gray-200/60"
                                  textClassName="text-xs"
                                />
                                <div>
                                  <p className="font-bold text-brand-black">{u.name}</p>
                                  <p className="text-[10px] text-brand-gray-400 font-bold mt-0.5">{u.joinDate ? `${t('admin.listedDate')} ${u.joinDate}` : 'Member'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4">
                              <select
                                value={u.role}
                                onChange={(e) => handleChangeRole(u.id, e.target.value as any, u.name)}
                                className="px-2 py-1 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-[10px] font-bold text-brand-black focus:outline-none"
                              >
                                <option value="MEMBER">MEMBER</option>
                                <option value="HOST">HOST</option>
                                <option value="INTERNAL_ADVISOR">ASESOR INTERNO</option>
                                <option value="ADMIN">ADMIN</option>
                              </select>
                            </td>
                            <td className="p-4">
                              {u.kycStatus === 'VERIFIED' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                                  <Check className="w-3 h-3" /> {t('admin.crmDrawerKycOk')}
                                </span>
                              ) : u.kycStatus === 'FAILED' ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                                  {t('admin.statusFailedKyc')}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                  {t('admin.statusPendingKyc')}
                                </span>
                              )}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleToggleHostVerified(u.id, u.name)}
                                className={`p-1 px-2.5 rounded-full text-[9px] font-black uppercase transition-colors cursor-pointer inline-flex items-center gap-1 ${
                                  u.isVerified 
                                    ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                                    : 'bg-brand-gray-100 text-brand-gray-400 hover:bg-brand-gray-200'
                                }`}
                              >
                                <UserCheck className="w-3 h-3" />
                                <span>{u.isVerified ? t('admin.crmDrawerKycOk') : t('admin.statusFailedKyc')}</span>
                              </button>
                            </td>
                            <td className="p-4 text-center font-bold text-brand-gray-600">{u.swapsCount || 0}</td>
                            <td className="p-4 text-center">
                              {u.isSuspended ? (
                                <span className="inline-block px-2 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-black rounded uppercase">{t('admin.statusSuspended')}</span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black rounded uppercase">{t('admin.statusActive')}</span>
                              )}
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => { setSelectedUserId(u.id); setUserDrawerOpen(true); }}
                                  className="p-1.5 rounded-lg text-brand-gray-500 hover:text-brand-black hover:bg-brand-gray-100 transition-colors cursor-pointer text-[10px] font-black flex items-center gap-1 border border-brand-gray-200/50 shadow-xs"
                                  title={t('admin.crmBtn')}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>{t('admin.crmBtn')}</span>
                                </button>
                                <button
                                  onClick={() => handleToggleSuspension(u.id, u.name)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    u.isSuspended 
                                      ? 'text-emerald-600 hover:bg-emerald-50' 
                                      : 'text-rose-600 hover:bg-rose-50'
                                  }`}
                                  title={u.isSuspended ? t('admin.actionUnsuspend') : t('admin.actionSuspend')}
                                >
                                  {u.isSuspended ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalUserPages > 1 && (
                  <div className="flex items-center justify-between border-t border-brand-gray-100 pt-4">
                    <span className="text-[10px] text-brand-gray-400 font-bold">
                      {t('admin.showingUsersMsg', { 
                        start: (userPage - 1) * ADMIN_PAGINATION_LIMIT + 1, 
                        end: Math.min(filteredUsers.length, userPage * ADMIN_PAGINATION_LIMIT), 
                        total: filteredUsers.length 
                      })}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setUserPage(prev => Math.max(1, prev - 1))}
                        disabled={userPage === 1}
                        className="p-2 border border-brand-gray-200 rounded-xl hover:bg-brand-gray-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-black text-brand-black px-3 select-none">
                        {userPage} / {totalUserPages}
                      </span>
                      <button
                        onClick={() => setUserPage(prev => Math.min(totalUserPages, prev + 1))}
                        disabled={userPage === totalUserPages}
                        className="p-2 border border-brand-gray-200 rounded-xl hover:bg-brand-gray-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 4: SWAPS LEDGER */}
            {activeTab === 'swaps' && (
              <motion.div
                key="swaps"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-brand-gray-200/70 rounded-3xl shadow-premium p-6 sm:p-8"
              >
                <div className="mb-6">
                  <h2 className="text-base font-black text-brand-black tracking-tight">{t('admin.swapLedgerTitle')}</h2>
                  <p className="text-xs text-brand-gray-500 mt-0.5">
                    {t('admin.swapLedgerDesc')}
                  </p>
                </div>

                {/* Filters */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="sm:col-span-2 relative">
                    <Search className="w-4 h-4 text-brand-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={t('admin.searchSwaps')}
                      value={swapSearch}
                      onChange={(e) => { setSwapSearch(e.target.value); setSwapPage(1); }}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-gray-200/60 focus:outline-none focus:ring-2 focus:ring-brand-accent/10 focus:border-brand-accent text-xs font-semibold bg-brand-gray-50/50"
                    />
                  </div>

                  <div>
                    <select
                      value={swapStatusFilter}
                      onChange={(e) => { setSwapStatusFilter(e.target.value); setSwapPage(1); }}
                      className="w-full px-3 py-2.5 rounded-xl border border-brand-gray-200/60 text-xs font-semibold bg-brand-gray-50/50 focus:outline-none focus:border-brand-accent"
                    >
                      <option value="All">{t('admin.statusSelector')}</option>
                      <option value="PENDING">PENDING</option>
                      <option value="APPROVED">APPROVED</option>
                      <option value="DECLINED">DECLINED</option>
                    </select>
                  </div>
                </div>

                {/* Swaps Ledger Table */}
                <div className="overflow-x-auto border border-brand-gray-150 rounded-2xl mb-6">
                  <table className="w-full border-collapse text-left text-xs font-semibold text-brand-black">
                    <thead>
                      <tr className="bg-brand-gray-50 border-b border-brand-gray-200/60 text-brand-gray-500 uppercase tracking-widest text-[9px] font-black select-none">
                        <th className="p-4">{t('admin.colSwapId')}</th>
                        <th className="p-4">{t('admin.colSender')}</th>
                        <th className="p-4">{t('admin.colReceiver')}</th>
                        <th className="p-4">{t('admin.colDates')}</th>
                        <th className="p-4 text-center">{t('admin.colStatus')}</th>
                        <th className="p-4 text-center">{t('admin.colDisputed')}</th>
                        <th className="p-4 text-right">{t('admin.colConciliation')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedSwaps.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-brand-gray-400 font-bold">
                            {t('admin.emptySwapsMsg')}
                          </td>
                        </tr>
                      ) : (
                        paginatedSwaps.map((s) => {
                          const senderUser = users.find(u => u.id === s.senderId);
                          const receiverUser = users.find(u => u.id === s.receiverId);
                          return (
                            <tr key={s.id} className="border-b border-brand-gray-100 hover:bg-brand-gray-50/50 transition-colors">
                              <td className="p-4 font-bold text-brand-accent">{s.id}</td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <ProfileAvatar
                                    src={senderUser?.avatar}
                                    name={senderUser?.name || 'Towers México'}
                                    className="h-6 w-6"
                                    textClassName="text-[8px]"
                                  />
                                  <span className="font-bold">{senderUser?.name}</span>
                                </div>
                                <span className="text-[10px] text-brand-gray-400 mt-0.5 block truncate max-w-[120px]" title={s.senderPropertyId}>Prop: {s.senderPropertyId}</span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <ProfileAvatar
                                    src={receiverUser?.avatar}
                                    name={receiverUser?.name || 'Towers México'}
                                    className="h-6 w-6"
                                    textClassName="text-[8px]"
                                  />
                                  <span className="font-bold">{receiverUser?.name}</span>
                                </div>
                                <span className="text-[10px] text-brand-gray-400 mt-0.5 block truncate max-w-[120px]" title={s.receiverPropertyId}>Prop: {s.receiverPropertyId}</span>
                              </td>
                              <td className="p-4">
                                <span className="flex items-center gap-1 text-[10px] text-brand-gray-500 font-bold">
                                  <Calendar className="w-3.5 h-3.5 text-brand-accent/40" />
                                  {s.startDate} al {s.endDate}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`inline-block px-2.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                  s.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                                  s.status === 'DECLINED' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700 animate-pulse'
                                }`}>
                                  {s.status}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                {s.isDisputed ? (
                                  <span className="inline-block px-2 py-0.5 rounded bg-rose-500 text-white text-[8px] font-black uppercase animate-pulse">{t('admin.disputeCritical')}</span>
                                ) : (
                                  <span className="inline-block px-2 py-0.5 rounded bg-brand-gray-100 text-brand-gray-400 text-[8px] font-black uppercase">{t('admin.incidentNone')}</span>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <select
                                    value={s.status}
                                    onChange={(e) => handleSwapStatusOverride(s.id, e.target.value as any)}
                                    className="px-2 py-1 bg-brand-gray-50 border border-brand-gray-200 rounded-lg text-[10px] font-bold text-brand-black"
                                  >
                                    <option value="PENDING">PENDING</option>
                                    <option value="APPROVED">APPROVED</option>
                                    <option value="DECLINED">DECLINED</option>
                                  </select>

                                  {!s.isDisputed && s.status === 'APPROVED' && (
                                    <button
                                      onClick={() => handleOpenDisputeModal(s.id)}
                                      className="p-1 px-2 text-[9px] font-black bg-rose-50 hover:bg-rose-100 text-rose-600 rounded border border-rose-200 cursor-pointer"
                                    >
                                      {t('admin.actionReport')}
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleDeleteSwap(s.id)}
                                    className="p-1 text-brand-gray-400 hover:text-brand-rose hover:bg-brand-rose/5 rounded cursor-pointer"
                                    title={t('admin.actionDelete')}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalSwapPages > 1 && (
                  <div className="flex items-center justify-between border-t border-brand-gray-100 pt-4">
                    <span className="text-[10px] text-brand-gray-400 font-bold">
                      {t('admin.showingSwapsMsg', { 
                        start: (swapPage - 1) * ADMIN_PAGINATION_LIMIT + 1, 
                        end: Math.min(filteredSwaps.length, swapPage * ADMIN_PAGINATION_LIMIT), 
                        total: filteredSwaps.length 
                      })}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setSwapPage(prev => Math.max(1, prev - 1))}
                        disabled={swapPage === 1}
                        className="p-2 border border-brand-gray-200 rounded-xl hover:bg-brand-gray-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-black text-brand-black px-3 select-none">
                        {swapPage} / {totalSwapPages}
                      </span>
                      <button
                        onClick={() => setSwapPage(prev => Math.min(totalSwapPages, prev + 1))}
                        disabled={swapPage === totalSwapPages}
                        className="p-2 border border-brand-gray-200 rounded-xl hover:bg-brand-gray-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 5: MODERATION & DISPUTES */}
            {activeTab === 'moderation' && (
              <motion.div
                key="moderation"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-brand-gray-200/70 rounded-3xl shadow-premium p-6 sm:p-8"
              >
                <div className="mb-6">
                  <h2 className="text-base font-black text-brand-black tracking-tight">{t('admin.disputeTitle')}</h2>
                  <p className="text-xs text-brand-gray-500 mt-0.5">
                    {t('admin.disputeDesc')}
                  </p>
                </div>

                {/* List of active disputed swaps */}
                <div className="flex flex-col gap-4">
                  {swaps.filter(s => s.isDisputed).length === 0 ? (
                    <div className="border border-brand-gray-200/50 p-8 rounded-3xl text-center">
                      <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
                        <CheckCircle className="w-6 h-6" />
                      </div>
                      <h3 className="text-xs font-black text-brand-black tracking-tight mb-1">
                        {t('admin.emptyDisputes')}
                      </h3>
                      <p className="text-[10px] text-brand-gray-400">
                        El ecosistema Towers México funciona perfectamente y los anfitriones cumplen con las normas.
                      </p>
                    </div>
                  ) : (
                    swaps.filter(s => s.isDisputed).map((disputedSwap) => {
                      const sender = users.find(u => u.id === disputedSwap.senderId);
                      const receiver = users.find(u => u.id === disputedSwap.receiverId);
                      return (
                        <div key={disputedSwap.id} className="border border-rose-200 bg-rose-50/10 p-5 rounded-3xl shadow-xs relative overflow-hidden">
                          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                              <div>
                                <h4 className="text-xs font-black text-brand-black flex items-center gap-1.5">
                                  <span>{t('admin.disputeLabel')} #{disputedSwap.id}</span>
                                  <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[8px] font-black uppercase rounded animate-pulse">{t('admin.disputeCritical')}</span>
                                </h4>
                                <p className="text-[11px] font-semibold text-brand-gray-600 mt-2">
                                  <strong>{t('admin.disputeReasonLabel')}</strong> {disputedSwap.disputeReason || 'Reclamo del usuario sobre el cumplimiento de reglas o calidad.'}
                                </p>
                                <p className="text-[10px] text-brand-gray-400 mt-2">
                                  {t('admin.disputeFiledLabel', { sender: sender?.name || 'Sender', receiver: receiver?.name || 'Receiver' })}
                                </p>
                              </div>
                            </div>

                            <button
                              onClick={() => handleResolveSwapDispute(disputedSwap.id)}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-colors shrink-0 shadow-xs flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>{t('admin.actionResolveDispute')}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Operational mock moderation incidents */}
                  <div className="mt-6 pt-6 border-t border-brand-gray-200/60">
                    <h3 className="text-xs font-black text-brand-black tracking-tight mb-4">{t('admin.otherIncidentsTitle')}</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      <div className="border border-brand-gray-200/60 p-4 rounded-2xl bg-white shadow-xs">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[8px] font-black uppercase rounded">{t('admin.incidentReview')}</span>
                          <span className="text-[10px] text-brand-gray-400 font-bold">Ayer</span>
                        </div>
                        <h4 className="text-xs font-bold text-brand-black">{t('admin.incidentContentTitle')}</h4>
                        <p className="text-[10px] text-brand-gray-500 font-medium leading-relaxed mt-1">
                          {t('admin.incidentContentDesc')}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[9px] font-bold text-amber-600">{t('admin.incidentReview')}</span>
                          <button 
                            onClick={() => alert('Incidencia archivada')}
                            className="text-[9px] font-black uppercase text-brand-gray-500 hover:text-brand-black border border-brand-gray-200 px-2 py-1 rounded"
                          >
                            {t('admin.incidentDismiss')}
                          </button>
                        </div>
                      </div>

                      <div className="border border-brand-gray-200/60 p-4 rounded-2xl bg-white shadow-xs">
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-rose-50 text-rose-700 text-[8px] font-black uppercase rounded">{t('admin.disputeCritical')}</span>
                          <span className="text-[10px] text-brand-gray-400 font-bold">Hace 2 días</span>
                        </div>
                        <h4 className="text-xs font-bold text-brand-black">{t('admin.incidentDamageTitle')}</h4>
                        <p className="text-[10px] text-brand-gray-500 font-medium leading-relaxed mt-1">
                          {t('admin.incidentDamageDesc')}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> {t('admin.incidentResolved')}
                          </span>
                          <span className="text-[9px] text-brand-gray-400 font-bold">{t('admin.incidentBond')}</span>
                        </div>
                      </div>

                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB 6: REPORTS & COMPLIANCE */}
            {activeTab === 'reports' && (
              <AdminReportsTab
                key="reports"
                totalSwaps={swaps.length}
                approvedSwaps={swaps.filter((swap) => swap.status === 'APPROVED').length}
                verificationFee={verificationFee}
                commissionRate={commissionRate}
                featuredProperties={properties.filter((property) => property.isFeatured).length}
                totalProperties={properties.length}
                verifiedUsers={users.filter((user) => user.kycStatus === 'VERIFIED').length}
              />
            )}

            {/* TAB 7: SYSTEM SETTINGS */}
            {activeTab === 'settings' && (
              <AdminSettingsTab
                key="settings"
                verificationFee={verificationFee}
                commissionRate={commissionRate}
                geminiActive={geminiActive}
                voiceEngine={voiceEngine}
                voiceEngineStatus={voiceEngineStatus}
                saving={settingsSaving}
                success={settingsSuccess}
                error={settingsError}
                onVerificationFeeChange={setVerificationFee}
                onCommissionRateChange={setCommissionRate}
                onToggleGemini={toggleGemini}
                onVoiceEngineChange={setVoiceEngine}
                onSave={handleSaveSettings}
              />
            )}

          </AnimatePresence>

        </div>

      </div>

      {cmsEditorProperty && (
        <PropertyEditorModal
          isOpen={Boolean(cmsEditorProperty)}
          property={cmsEditorProperty}
          onClose={() => setCmsEditorPropertyId(null)}
          onSubmit={handleCmsEditorSave}
          onDelete={handleCmsEditorDelete}
        />
      )}

      <AnimatePresence>
        {publisherModalOpen && (
          <PublisherOnboardingModal
            isOpen={publisherModalOpen}
            currentUser={currentUser}
            onClose={() => setPublisherModalOpen(false)}
            onComplete={(profile) => {
              setVerifiedPublisherType(profile.representativeType);
              setPublisherModalOpen(false);
              setPropertyWizardOpen(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {propertyWizardOpen && (
          <PropertyWizardModal
            isOpen={propertyWizardOpen}
            publisherRepresentativeType={verifiedPublisherType || undefined}
            onClose={() => {
              setPropertyWizardOpen(false);
              setWizardDraft(readPropertyWizardDraft());
            }}
            onSubmit={handleAdminWizardSubmit}
          />
        )}
      </AnimatePresence>

      <AdminPropertyDrawer
        isOpen={propertyDrawerOpen}
        editingPropertyId={editingPropertyId}
        title={formTitle}
        description={formDesc}
        type={formType}
        location={formLocation}
        country={formCountry}
        address={formAddress}
        tier={formTier}
        imageUrls={formImageUrls}
        rules={formRules}
        bedrooms={formBedrooms}
        bathrooms={formBathrooms}
        guests={formGuests}
        amenities={formAmenities}
        onClose={() => setPropertyDrawerOpen(false)}
        onSubmit={handleSaveProperty}
        onTitleChange={setFormTitle}
        onDescriptionChange={setFormDesc}
        onTypeChange={setFormType}
        onLocationChange={setFormLocation}
        onCountryChange={setFormCountry}
        onAddressChange={setFormAddress}
        onTierChange={setFormTier}
        onImageUrlsChange={setFormImageUrls}
        onRulesChange={setFormRules}
        onBedroomsChange={setFormBedrooms}
        onBathroomsChange={setFormBathrooms}
        onGuestsChange={setFormGuests}
        onToggleAmenity={handleToggleAmenityCheckbox}
      />
      <AdminUserDrawer
        isOpen={userDrawerOpen}
        details={selectedUserDetails}
        users={users}
        onClose={() => setUserDrawerOpen(false)}
        onToggleHostVerified={handleToggleHostVerified}
        onToggleSuspension={handleToggleSuspension}
      />
      {/* 5. MODAL: REPORT DISPUTE DIALOG */}
      {disputeModalOpen && (
        <div className="fixed inset-0 bg-brand-black/40 z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-white border border-brand-gray-200 rounded-3xl p-6 shadow-floating text-left"
          >
            <h3 className="text-sm font-black text-brand-black tracking-tight mb-2">
              {t('admin.modalDisputeTitle')}
            </h3>
            <p className="text-[10px] text-brand-gray-500 font-medium mb-4">
              {t('admin.modalDisputeDesc', { id: disputeSwapId })}
            </p>

            <textarea
              rows={3}
              value={disputeReasonText}
              onChange={(e) => setDisputeReasonText(e.target.value)}
              placeholder={t('admin.modalDisputePlaceholder')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-semibold resize-none mb-4"
            />

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDisputeModalOpen(false)}
                className="px-4 py-2 text-[10px] font-bold text-brand-gray-500 hover:text-brand-black cursor-pointer"
              >
                {t('admin.modalDisputeCancel')}
              </button>
              <button
                type="button"
                onClick={handleTriggerDispute}
                className="px-4 py-2 text-[10px] font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                {t('admin.modalDisputeConfirm')}
              </button>
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}
