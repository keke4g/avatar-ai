"use client";

import React, { useState, useMemo } from 'react';
import { useSwap } from '../../lib/context/SwapContext';
import { useTranslation } from '../../lib/context/LanguageContext';
import { useRouter } from 'next/navigation';
import AuthGuard from '../../components/AuthGuard';
import { 
  Shield, Activity, Building, Users, RefreshCw, FileText, 
  CheckCircle, AlertTriangle, Settings, Search, Filter, 
  ChevronLeft, ChevronRight, Plus, Edit, 
  Trash2, Eye, EyeOff, Star, X, Lock, Unlock, TrendingUp, 
  MapPin, UserCheck, AlertCircle, Check, DollarSign, Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnalyticsService } from '../../lib/services/AnalyticsService';
import confetti from 'canvas-confetti';

type AdminTab = 'overview' | 'properties' | 'users' | 'swaps' | 'reports' | 'moderation' | 'settings';

export default function AdminPage() {
  const router = useRouter();
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
    updateUserKyc, 
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
  const [propertySortField, setPropertySortField] = useState<'title' | 'type' | 'location' | 'auraScore'>('title');
  const [propertySortAsc, setPropertySortAsc] = useState(true);
  const [propertyPage, setPropertyPage] = useState(1);

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


  // Property Form Drawer States
  const [propertyDrawerOpen, setPropertyDrawerOpen] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);
  
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
  const [auditLog, setAuditLog] = useState([
    { id: 1, type: 'KYC', key: 'auditKycDesc', params: { name: 'Carlos Mendoza' }, time: '10m', status: 'pending' },
    { id: 2, type: 'PROPERTY', key: 'auditPropDesc', params: { name: 'Sofia Alvarez', title: 'Shibuya Studio' }, time: '1h', status: 'success' },
    { id: 3, type: 'DISPUTE', key: 'auditDisputeDesc', params: { id: 'swap-preload-1' }, time: '3h', status: 'alert' },
    { id: 4, type: 'USER', key: 'auditUserDesc', params: { name: 'Chloe Laurent' }, time: '5h', status: 'info' }
  ]);

  const addAudit = (type: string, key: string, params: any, status: 'pending' | 'success' | 'alert' | 'info') => {
    setAuditLog(prev => [
      { id: Date.now(), type, key, params, time: 'justNow', status },
      ...prev.slice(0, 7)
    ]);
  };

  const renderAuditDesc = (log: any) => {
    return t(`admin.${log.key}`, log.params);
  };

  const renderAuditTime = (time: string) => {
    if (time === 'justNow') return t('admin.auditJustNow');
    if (time.endsWith('m')) return t('admin.auditMinsAgo', { minutes: time.replace('m', '') });
    if (time.endsWith('h')) return t('admin.auditHrsAgo', { hours: time.replace('h', '') });
    if (time.endsWith('d')) return t('admin.auditDaysAgo', { days: time.replace('d', '') });
    return time;
  };

  // 401 & 403 Auth Protection Checks
  if (!currentUser) {
    return <AuthGuard />;
  }

  if (currentUser.role !== 'ADMIN') {
    return <AuthGuard requireAdmin />;
  }

  // 1. Reactive statistics calculations via AnalyticsService
  const dashboardStats = useMemo(() => {
    return AnalyticsService.getDashboardMetrics(properties, users, swaps);
  }, [properties, users, swaps]);

  const countryMetrics = useMemo(() => {
    return AnalyticsService.getCountryListingMetrics(properties);
  }, [properties]);

  // 2. Properties CMS processing
  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(propertySearch.toLowerCase()) || 
                            p.location.toLowerCase().includes(propertySearch.toLowerCase()) ||
                            p.country.toLowerCase().includes(propertySearch.toLowerCase());
      const matchesType = propertyTypeFilter === 'All' || p.type === propertyTypeFilter;
      const matchesTier = propertyTierFilter === 'All' || p.valueRating === propertyTierFilter;
      return matchesSearch && matchesType && matchesTier;
    });
  }, [properties, propertySearch, propertyTypeFilter, propertyTierFilter]);

  const sortedProperties = useMemo(() => {
    return [...filteredProperties].sort((a, b) => {
      let comparison = 0;
      if (propertySortField === 'title') comparison = a.title.localeCompare(b.title);
      else if (propertySortField === 'type') comparison = a.type.localeCompare(b.type);
      else if (propertySortField === 'location') comparison = a.location.localeCompare(b.location);
      else if (propertySortField === 'auraScore') comparison = a.auraScore - b.auraScore;
      return propertySortAsc ? comparison : -comparison;
    });
  }, [filteredProperties, propertySortField, propertySortAsc]);

  const PAGINATION_LIMIT = 5;
  const paginatedProperties = useMemo(() => {
    const start = (propertyPage - 1) * PAGINATION_LIMIT;
    return sortedProperties.slice(start, start + PAGINATION_LIMIT);
  }, [sortedProperties, propertyPage]);

  const totalPropertyPages = Math.ceil(sortedProperties.length / PAGINATION_LIMIT);

  // 3. Users CRM processing
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase());
      const matchesRole = userRoleFilter === 'All' || u.role === userRoleFilter;
      const matchesKyc = userKycFilter === 'All' || u.kycStatus === userKycFilter;
      return matchesSearch && matchesRole && matchesKyc;
    });
  }, [users, userSearch, userRoleFilter, userKycFilter]);

  const paginatedUsers = useMemo(() => {
    const start = (userPage - 1) * PAGINATION_LIMIT;
    return filteredUsers.slice(start, start + PAGINATION_LIMIT);
  }, [filteredUsers, userPage]);

  const totalUserPages = Math.ceil(filteredUsers.length / PAGINATION_LIMIT);

  // 4. Swaps CRM processing
  const filteredSwaps = useMemo(() => {
    return swaps.filter(s => {
      const senderUser = users.find(u => u.id === s.senderId);
      const receiverUser = users.find(u => u.id === s.receiverId);
      const matchesSearch = s.message.toLowerCase().includes(swapSearch.toLowerCase()) ||
                            (senderUser && senderUser.name.toLowerCase().includes(swapSearch.toLowerCase())) ||
                            (receiverUser && receiverUser.name.toLowerCase().includes(swapSearch.toLowerCase()));
      const matchesStatus = swapStatusFilter === 'All' || s.status === swapStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [swaps, users, swapSearch, swapStatusFilter]);

  const paginatedSwaps = useMemo(() => {
    const start = (swapPage - 1) * PAGINATION_LIMIT;
    return filteredSwaps.slice(start, start + PAGINATION_LIMIT);
  }, [filteredSwaps, swapPage]);

  const totalSwapPages = Math.ceil(filteredSwaps.length / PAGINATION_LIMIT);

  // Fetch details for the selected user history drawer
  const selectedUserDetails = useMemo(() => {
    if (!selectedUserId) return null;
    const userObj = users.find(u => u.id === selectedUserId);
    if (!userObj) return null;
    const userProperties = properties.filter(p => p.hostId === selectedUserId);
    const userSwaps = swaps.filter(s => s.senderId === selectedUserId || s.receiverId === selectedUserId);
    return {
      user: userObj,
      properties: userProperties,
      swaps: userSwaps
    };
  }, [selectedUserId, users, properties, swaps]);

  // Handler to open property drawer for creation
  const handleOpenCreateDrawer = () => {
    setEditingPropertyId(null);
    setFormTitle('');
    setFormDesc('');
    setFormType('Apartment');
    setFormLocation('');
    setFormCountry('');
    setFormAddress('');
    setFormTier('Premium');
    setFormImageUrls('https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80');
    setFormRules('Be respectful of our domestic space.\nQuiet hours after 10:00 PM.');
    setFormBedrooms(2);
    setFormBathrooms(2);
    setFormGuests(4);
    setFormAmenities(['Wifi', 'Air Conditioning', 'Workstation']);
    setPropertyDrawerOpen(true);
  };

  // Handler to open property drawer for editing
  const handleOpenEditDrawer = (property: any) => {
    setEditingPropertyId(property.id);
    setFormTitle(property.title);
    setFormDesc(property.description || '');
    setFormType(property.type);
    setFormLocation(property.location);
    setFormCountry(property.country);
    setFormAddress(property.address || '');
    setFormTier(property.valueRating);
    setFormImageUrls(property.images.join('\n'));
    setFormRules(property.rules ? property.rules.join('\n') : '');
    setFormBedrooms(property.bedrooms || 2);
    setFormBathrooms(property.bathrooms || 2);
    setFormGuests(property.maxGuests || 4);
    setFormAmenities(property.amenities || []);
    setPropertyDrawerOpen(true);
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

  const handleTogglePublish = (id: string, name: string) => {
    togglePublish(id);
    const prop = properties.find(p => p.id === id);
    const nextPublished = prop ? !prop.isPublished : false;
    addAudit('PROPERTY', 'auditPropDesc', { name: currentUser.name, title: name }, nextPublished ? 'success' : 'info');
  };

  const handleToggleFeature = (id: string, name: string) => {
    toggleFeature(id);
    addAudit('PROPERTY', 'auditPropDesc', { name: currentUser.name, title: name }, 'success');
  };

  const handleDeleteProperty = (id: string, name: string) => {
    if (confirm(t('admin.confirmDeleteProp', { name }))) {
      deleteProperty(id);
      addAudit('PROPERTY', 'auditPropDesc', { name: currentUser.name, title: name }, 'alert');
    }
  };

  // User CRUD hooks
  const handleApproveKyc = (userId: string, name: string) => {
    updateUserKyc(userId, 'VERIFIED');
    addAudit('KYC', 'auditKycDesc', { name }, 'success');
    confetti({
      particleCount: 40,
      spread: 30,
      origin: { y: 0.8 }
    });
  };

  const handleToggleHostVerified = (userId: string, name: string) => {
    toggleHostVerified(userId);
    addAudit('USER', 'auditUserDesc', { name }, 'success');
  };

  const handleToggleSuspension = (userId: string, name: string) => {
    toggleUserSuspension(userId);
    addAudit('USER', 'auditUserDesc', { name }, 'alert');
  };

  const handleChangeRole = (userId: string, role: 'ADMIN' | 'HOST' | 'MEMBER', name: string) => {
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

  const handleSaveSettings = () => {
    setSettingsSuccess(true);
    addAudit('SETTINGS', 'auditSettingDesc', {}, 'success');
    setTimeout(() => setSettingsSuccess(false), 3000);
  };

  // Multi-select handler for amenities
  const handleToggleAmenityCheckbox = (amenity: string) => {
    setFormAmenities(prev => 
      prev.includes(amenity) ? prev.filter(a => a !== amenity) : [...prev, amenity]
    );
  };

  // Standard platform amenities list
  const AMENITIES_LIST = [
    'Wifi', 'Air Conditioning', 'Infinity Pool', 'Ocean Views', 
    'Private Beach', 'Chef Kitchen', 'Tesla Charger', 'Sonos System',
    'Workstation', 'Coffee Station', 'Bicycles', 'Gym', 'Heated Jacuzzi'
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-12 md:px-24 py-10 relative">
      
      {/* Glow ambient lights */}
      <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-brand-accent/5 filter blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-20 left-10 w-80 h-80 rounded-full bg-brand-rose/5 filter blur-3xl pointer-events-none -z-10" />

      {/* Header section with admin shield banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-10 pb-6 border-b border-brand-gray-200/60">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-brand-black flex items-center justify-center text-white shadow-glow">
              <Shield className="w-5 h-5 text-brand-accent animate-pulse" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-brand-gray-500">AuraSwap Network</span>
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

      {/* Cockpit Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 flex flex-col gap-2">
          
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full text-left px-5 py-3.5 rounded-2xl text-xs font-black tracking-wide flex items-center justify-between transition-all select-none cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-brand-black text-white shadow-premium'
                : 'bg-white hover:bg-brand-gray-50 text-brand-gray-500 hover:text-brand-black border border-brand-gray-200/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Activity className="w-4 h-4" />
              <span>{t('admin.tabOverview')}</span>
            </div>
            <TrendingUp className="w-3.5 h-3.5 opacity-60" />
          </button>

          <button
            onClick={() => setActiveTab('properties')}
            className={`w-full text-left px-5 py-3.5 rounded-2xl text-xs font-black tracking-wide flex items-center justify-between transition-all select-none cursor-pointer ${
              activeTab === 'properties'
                ? 'bg-brand-black text-white shadow-premium'
                : 'bg-white hover:bg-brand-gray-50 text-brand-gray-500 hover:text-brand-black border border-brand-gray-200/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Building className="w-4 h-4" />
              <span>{t('admin.tabProperties')}</span>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${
              activeTab === 'properties' ? 'bg-white/20 text-white' : 'bg-brand-gray-100 text-brand-gray-500'
            }`}>
              {properties.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`w-full text-left px-5 py-3.5 rounded-2xl text-xs font-black tracking-wide flex items-center justify-between transition-all select-none cursor-pointer ${
              activeTab === 'users'
                ? 'bg-brand-black text-white shadow-premium'
                : 'bg-white hover:bg-brand-gray-50 text-brand-gray-500 hover:text-brand-black border border-brand-gray-200/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4" />
              <span>{t('admin.tabUsers')}</span>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${
              activeTab === 'users' ? 'bg-white/20 text-white' : 'bg-brand-gray-100 text-brand-gray-500'
            }`}>
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('swaps')}
            className={`w-full text-left px-5 py-3.5 rounded-2xl text-xs font-black tracking-wide flex items-center justify-between transition-all select-none cursor-pointer ${
              activeTab === 'swaps'
                ? 'bg-brand-black text-white shadow-premium'
                : 'bg-white hover:bg-brand-gray-50 text-brand-gray-500 hover:text-brand-black border border-brand-gray-200/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <RefreshCw className="w-4 h-4" />
              <span>{t('admin.tabSwaps')}</span>
            </div>
            <span className={`px-2 py-0.5 rounded-md text-[9px] font-black ${
              activeTab === 'swaps' ? 'bg-white/20 text-white' : 'bg-brand-gray-100 text-brand-gray-500'
            }`}>
              {swaps.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('moderation')}
            className={`w-full text-left px-5 py-3.5 rounded-2xl text-xs font-black tracking-wide flex items-center justify-between transition-all select-none cursor-pointer ${
              activeTab === 'moderation'
                ? 'bg-brand-black text-white shadow-premium'
                : 'bg-white hover:bg-brand-gray-50 text-brand-gray-500 hover:text-brand-black border border-brand-gray-200/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-4 h-4" />
              <span>{t('admin.tabModeration')}</span>
            </div>
            {swaps.filter(s => s.isDisputed).length > 0 && (
              <span className="w-2.5 h-2.5 rounded-full bg-brand-rose animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('reports')}
            className={`w-full text-left px-5 py-3.5 rounded-2xl text-xs font-black tracking-wide flex items-center justify-between transition-all select-none cursor-pointer ${
              activeTab === 'reports'
                ? 'bg-brand-black text-white shadow-premium'
                : 'bg-white hover:bg-brand-gray-50 text-brand-gray-500 hover:text-brand-black border border-brand-gray-200/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <FileText className="w-4 h-4" />
              <span>{t('admin.reportsTitle')}</span>
            </div>
            <span className="text-[9px] font-black tracking-wider text-brand-accent uppercase bg-brand-accent/10 px-2 py-0.5 rounded-md">Realtime</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full text-left px-5 py-3.5 rounded-2xl text-xs font-black tracking-wide flex items-center justify-between transition-all select-none cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-brand-black text-white shadow-premium'
                : 'bg-white hover:bg-brand-gray-50 text-brand-gray-500 hover:text-brand-black border border-brand-gray-200/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <Settings className="w-4 h-4" />
              <span>{t('admin.tabSettings')}</span>
            </div>
          </button>

        </div>

        {/* Dynamic Display Panel */}
        <div className="lg:col-span-3">
          
          <AnimatePresence mode="wait">
            
            {/* TAB 1: OVERVIEW */}
            {activeTab === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex flex-col gap-8"
              >
                {/* 6 Grid Metrics cards */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  
                  <div className="bg-white border border-brand-gray-200/70 p-5 rounded-3xl shadow-premium relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-500 leading-tight">
                        {t('admin.metricActiveProps')}
                      </span>
                      <Building className="w-4 h-4 text-brand-accent" />
                    </div>
                    <div className="mt-4">
                      <span className="text-3xl font-black text-brand-black leading-none tracking-tight">
                        {dashboardStats.activeProperties}
                      </span>
                      <p className="text-[10px] text-emerald-500 font-bold mt-1 flex items-center gap-1">
                        <span>{t('admin.systemActive')}</span>
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-brand-gray-200/70 p-5 rounded-3xl shadow-premium relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-500 leading-tight">
                        {t('admin.metricTotalUsers')}
                      </span>
                      <Users className="w-4 h-4 text-brand-accent" />
                    </div>
                    <div className="mt-4">
                      <span className="text-3xl font-black text-brand-black leading-none tracking-tight">
                        {dashboardStats.totalUsers}
                      </span>
                      <p className="text-[10px] text-emerald-500 font-bold mt-1 flex items-center gap-1">
                        <span>↑ 14.8%</span>
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-brand-gray-200/70 p-5 rounded-3xl shadow-premium relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-500 leading-tight">
                        {t('admin.metricCompletedSwaps')}
                      </span>
                      <RefreshCw className="w-4 h-4 text-brand-accent" />
                    </div>
                    <div className="mt-4">
                      <span className="text-3xl font-black text-brand-black leading-none tracking-tight">
                        {dashboardStats.completedSwaps}
                      </span>
                      <p className="text-[10px] text-brand-accent font-bold mt-1">
                        {t('admin.successRate')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-brand-gray-200/70 p-5 rounded-3xl shadow-premium relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-500 leading-tight">
                        {t('admin.metricPendingSwaps')}
                      </span>
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="mt-4">
                      <span className="text-3xl font-black text-brand-black leading-none tracking-tight">
                        {dashboardStats.pendingSwaps}
                      </span>
                      <p className="text-[10px] text-brand-gray-400 font-bold mt-1">
                        {t('admin.tabModeration')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-brand-gray-200/70 p-5 rounded-3xl shadow-premium relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-500 leading-tight">
                        {t('admin.metricVerifiedHosts')}
                      </span>
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="mt-4">
                      <span className="text-3xl font-black text-brand-black leading-none tracking-tight">
                        {dashboardStats.verifiedHosts}
                      </span>
                      <p className="text-[10px] text-emerald-500 font-bold mt-1">
                        {t('admin.confidenceMetric')}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white border border-brand-gray-200/70 p-5 rounded-3xl shadow-premium relative overflow-hidden flex flex-col justify-between min-h-[120px]">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-500 leading-tight">
                        {t('admin.growthPercent')}
                      </span>
                      <TrendingUp className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="mt-4">
                      <span className="text-3xl font-black text-brand-black leading-none tracking-tight">
                        +{dashboardStats.growthPercent}%
                      </span>
                      <p className="text-[10px] text-brand-accent font-bold mt-1">
                        {t('admin.growthTarget')}
                      </p>
                    </div>
                  </div>

                </div>

                {/* SVG Area Line Chart */}
                <div className="bg-white border border-brand-gray-200/70 p-6 sm:p-8 rounded-3xl shadow-premium">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                    <div>
                      <h2 className="text-sm font-black text-brand-black tracking-tight">
                        {t('admin.growthTrendTitle')}
                      </h2>
                      <p className="text-[11px] text-brand-gray-500 mt-0.5">
                        {t('admin.growthTrendDesc')}
                      </p>
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

                      <path 
                        d="M 0 170 C 62.5 130, 62.5 130, 125 110 C 187.5 100, 187.5 100, 250 100 C 312.5 90, 312.5 90, 375 90 C 437.5 70, 437.5 70, 500 50 L 500 170 L 0 170 Z" 
                        fill="url(#gradientProp)" 
                      />

                      <path 
                        d="M 0 170 C 62.5 160, 62.5 160, 125 150 C 187.5 140, 187.5 140, 250 140 C 312.5 130, 312.5 130, 375 130 C 437.5 120, 437.5 120, 500 110 L 500 170 L 0 170 Z" 
                        fill="url(#gradientSwap)" 
                      />

                      <path 
                        d="M 0 170 C 62.5 130, 62.5 130, 125 110 C 187.5 100, 187.5 100, 250 100 C 312.5 90, 312.5 90, 375 90 C 437.5 70, 437.5 70, 500 50" 
                        fill="none" 
                        stroke="#6366f1" 
                        strokeWidth="3" 
                        strokeLinecap="round"
                      />

                      <path 
                        d="M 0 170 C 62.5 160, 62.5 160, 125 150 C 187.5 140, 187.5 140, 250 140 C 312.5 130, 312.5 130, 375 130 C 437.5 120, 437.5 120, 500 110" 
                        fill="none" 
                        stroke="#10b981" 
                        strokeWidth="3" 
                        strokeLinecap="round"
                      />

                      <circle cx="0" cy="170" r="4" fill="#ffffff" stroke="#6366f1" strokeWidth="2" />
                      <circle cx="125" cy="110" r="4" fill="#ffffff" stroke="#6366f1" strokeWidth="2" />
                      <circle cx="250" cy="100" r="4" fill="#ffffff" stroke="#6366f1" strokeWidth="2" />
                      <circle cx="375" cy="90" r="4" fill="#ffffff" stroke="#6366f1" strokeWidth="2" />
                      <circle cx="500" cy="50" r="4" fill="#ffffff" stroke="#6366f1" strokeWidth="2" />

                      <circle cx="0" cy="170" r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
                      <circle cx="125" cy="150" r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
                      <circle cx="250" cy="140" r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
                      <circle cx="375" cy="130" r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2" />
                      <circle cx="500" cy="110" r="4" fill="#ffffff" stroke="#10b981" strokeWidth="2" />

                      <text x="0" y="190" fill="#a1a1aa" fontSize="8" fontWeight="bold" textAnchor="middle">Jan</text>
                      <text x="125" y="190" fill="#a1a1aa" fontSize="8" fontWeight="bold" textAnchor="middle">Feb</text>
                      <text x="250" y="190" fill="#a1a1aa" fontSize="8" fontWeight="bold" textAnchor="middle">Mar</text>
                      <text x="375" y="190" fill="#a1a1aa" fontSize="8" fontWeight="bold" textAnchor="middle">Apr</text>
                      <text x="500" y="190" fill="#a1a1aa" fontSize="8" fontWeight="bold" textAnchor="middle">May</text>
                    </svg>
                  </div>
                </div>

                {/* Country distribution metrics & Activity feed row */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  
                  {/* Countries listed */}
                  <div className="md:col-span-2 bg-white border border-brand-gray-200/70 p-6 rounded-3xl shadow-premium flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-black text-brand-black tracking-tight mb-1">{t('admin.countryListingTitle')}</h3>
                      <p className="text-[10px] text-brand-gray-500 mb-6">{t('admin.countryListingDesc')}</p>
                      
                      <div className="flex flex-col gap-4">
                        {countryMetrics.map((c, i) => {
                          const percentage = Math.min(100, Math.max(10, (c.value / properties.length) * 100));
                          return (
                            <div key={c.name} className="flex flex-col gap-1.5">
                              <div className="flex justify-between items-center text-[10px] font-bold">
                                <span className="text-brand-black flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-brand-accent/70" />
                                  {c.name || 'Other'}
                                </span>
                                <span className="text-brand-gray-500">{c.value} {c.value === 1 ? t('admin.anuncioLabel') : t('admin.anunciosLabel')}</span>
                              </div>
                              <div className="w-full h-2 bg-brand-gray-100 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  transition={{ duration: 0.8, delay: i * 0.1 }}
                                  className="h-full bg-brand-accent rounded-full" 
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Operational system log */}
                  <div className="md:col-span-3 bg-white border border-brand-gray-200/70 p-6 rounded-3xl shadow-premium flex flex-col justify-between">
                    <div>
                      <h3 className="text-xs font-black text-brand-black tracking-tight mb-1">{t('admin.auditTitle')}</h3>
                      <p className="text-[10px] text-brand-gray-500 mb-4">{t('admin.auditDesc')}</p>

                      <div className="flex flex-col gap-3">
                        {auditLog.map((log) => (
                          <div key={log.id} className="flex items-start justify-between gap-3 text-[10px] pb-3 border-b border-brand-gray-100 last:border-0 last:pb-0">
                            <div className="flex items-start gap-2.5">
                              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase shrink-0 mt-0.5 ${
                                log.status === 'success' ? 'bg-emerald-500/10 text-emerald-600' :
                                log.status === 'alert' ? 'bg-rose-500/10 text-rose-600' :
                                log.status === 'pending' ? 'bg-amber-500/10 text-amber-600' : 'bg-brand-accent/10 text-brand-accent'
                              }`}>
                                {log.type}
                              </span>
                              <p className="text-brand-black font-semibold line-clamp-1">{renderAuditDesc(log)}</p>
                            </div>
                            <span className="text-brand-gray-400 font-bold shrink-0">{renderAuditTime(log.time)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB 2: PROPERTIES CMS */}
            {activeTab === 'properties' && (
              <motion.div
                key="properties"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-brand-gray-200/70 rounded-3xl shadow-premium p-6 sm:p-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-base font-black text-brand-black tracking-tight">{t('admin.catalogTitle')}</h2>
                    <p className="text-xs text-brand-gray-500">
                      {t('admin.catalogDesc')}
                    </p>
                  </div>

                  <button
                    onClick={handleOpenCreateDrawer}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-colors shadow-sm select-none cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t('admin.addPropTitle')}</span>
                  </button>
                </div>

                {/* Search & Filter Bar */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-6">
                  <div className="sm:col-span-2 relative">
                    <Search className="w-4 h-4 text-brand-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder={t('admin.searchProps')}
                      value={propertySearch}
                      onChange={(e) => { setPropertySearch(e.target.value); setPropertyPage(1); }}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-gray-200/60 focus:outline-none focus:ring-2 focus:ring-brand-accent/10 focus:border-brand-accent text-xs font-semibold bg-brand-gray-50/50"
                    />
                  </div>

                  <div>
                    <select
                      value={propertyTypeFilter}
                      onChange={(e) => { setPropertyTypeFilter(e.target.value); setPropertyPage(1); }}
                      className="w-full px-3 py-2.5 rounded-xl border border-brand-gray-200/60 text-xs font-semibold bg-brand-gray-50/50 focus:outline-none focus:border-brand-accent"
                    >
                      <option value="All">{t('admin.catSelector')}</option>
                      <option value="Apartment">Apartment</option>
                      <option value="Beach House">Beach House</option>
                      <option value="Cabin">Cabin</option>
                      <option value="Penthouse">Penthouse</option>
                      <option value="Villa">Villa</option>
                      <option value="Loft">Loft</option>
                    </select>
                  </div>

                  <div>
                    <select
                      value={propertyTierFilter}
                      onChange={(e) => { setPropertyTierFilter(e.target.value); setPropertyPage(1); }}
                      className="w-full px-3 py-2.5 rounded-xl border border-brand-gray-200/60 text-xs font-semibold bg-brand-gray-50/50 focus:outline-none focus:border-brand-accent"
                    >
                      <option value="All">{t('admin.tierSelector')}</option>
                      <option value="Premium">Premium</option>
                      <option value="Luxury">Luxury</option>
                      <option value="Exclusive">Exclusive</option>
                      <option value="Curated">Curated</option>
                    </select>
                  </div>
                </div>

                {/* Table CRM properties list */}
                <div className="overflow-x-auto border border-brand-gray-150 rounded-2xl mb-6">
                  <table className="w-full border-collapse text-left text-xs font-semibold text-brand-black">
                    <thead>
                      <tr className="bg-brand-gray-50 border-b border-brand-gray-200/60 text-brand-gray-500 uppercase tracking-widest text-[9px] font-black select-none">
                        <th className="p-4">{t('admin.colProperty')}</th>
                        <th className="p-4">{t('admin.colType')}</th>
                        <th className="p-4">{t('admin.colLocation')}</th>
                        <th className="p-4 text-center">{t('admin.colAura')}</th>
                        <th className="p-4 text-center">{t('admin.colPublished')}</th>
                        <th className="p-4 text-center">{t('admin.colFeatured')}</th>
                        <th className="p-4 text-right">{t('admin.colActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedProperties.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-brand-gray-400 font-bold">
                            {t('admin.emptyPropsMsg')}
                          </td>
                        </tr>
                      ) : (
                        paginatedProperties.map((p) => (
                          <tr key={p.id} className="border-b border-brand-gray-100 hover:bg-brand-gray-50/50 transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <img
                                  src={p.images[0]}
                                  alt={p.title}
                                  className="w-12 h-9 rounded-md object-cover border border-brand-gray-200/50 shrink-0"
                                />
                                <div>
                                  <p className="font-bold text-brand-black line-clamp-1">{p.title}</p>
                                  <p className="text-[10px] text-brand-gray-400 font-bold mt-0.5 uppercase tracking-wide">ID: {p.id}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-brand-gray-500 font-bold">{p.type}</td>
                            <td className="p-4">
                              <span className="flex items-center gap-1 text-brand-gray-600">
                                <MapPin className="w-3.5 h-3.5 text-brand-accent/50" />
                                {p.location}, {p.country}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-brand-accent/10 text-brand-accent">
                                {p.auraScore}% Aura
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleTogglePublish(p.id, p.title)}
                                className={`p-1.5 rounded-full transition-colors cursor-pointer inline-flex items-center justify-center ${
                                  p.isPublished !== false 
                                    ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100' 
                                    : 'bg-brand-gray-100 text-brand-gray-400 hover:bg-brand-gray-200'
                                }`}
                                title={p.isPublished !== false ? t('admin.actionUnpublish') : t('admin.actionPublish')}
                              >
                                {p.isPublished !== false ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleToggleFeature(p.id, p.title)}
                                className={`p-1.5 rounded-full transition-colors cursor-pointer inline-flex items-center justify-center ${
                                  (p as any).isFeatured 
                                    ? 'bg-amber-50 text-amber-600 hover:bg-amber-100' 
                                    : 'bg-brand-gray-100 text-brand-gray-400 hover:bg-brand-gray-200'
                                }`}
                                title={(p as any).isFeatured ? t('admin.actionUnfeature') : t('admin.actionFeature')}
                              >
                                <Star className={`w-4 h-4 ${(p as any).isFeatured ? 'fill-amber-500 stroke-amber-500' : ''}`} />
                              </button>
                            </td>
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleOpenEditDrawer(p)}
                                  className="p-1.5 rounded-lg text-brand-gray-500 hover:text-brand-black hover:bg-brand-gray-100 transition-colors cursor-pointer"
                                  title={t('admin.actionEdit')}
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteProperty(p.id, p.title)}
                                  className="p-1.5 rounded-lg text-brand-gray-400 hover:text-brand-rose hover:bg-brand-rose/5 transition-colors cursor-pointer"
                                  title={t('admin.actionDelete')}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination footer */}
                {totalPropertyPages > 1 && (
                  <div className="flex items-center justify-between border-t border-brand-gray-100 pt-4">
                    <span className="text-[10px] text-brand-gray-400 font-bold">
                      {t('admin.showingPropsMsg', { 
                        start: (propertyPage - 1) * PAGINATION_LIMIT + 1, 
                        end: Math.min(sortedProperties.length, propertyPage * PAGINATION_LIMIT), 
                        total: sortedProperties.length 
                      })}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setPropertyPage(prev => Math.max(1, prev - 1))}
                        disabled={propertyPage === 1}
                        className="p-2 border border-brand-gray-200 rounded-xl hover:bg-brand-gray-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-black text-brand-black px-3 select-none">
                        {propertyPage} / {totalPropertyPages}
                      </span>
                      <button
                        onClick={() => setPropertyPage(prev => Math.min(totalPropertyPages, prev + 1))}
                        disabled={propertyPage === totalPropertyPages}
                        className="p-2 border border-brand-gray-200 rounded-xl hover:bg-brand-gray-50 disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
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
                                <img
                                  src={u.avatar}
                                  alt={u.name}
                                  className="w-9 h-9 rounded-full object-cover border border-brand-gray-200/60 shrink-0"
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
                                <div className="flex items-center gap-1.5">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                    {t('admin.statusPendingKyc')}
                                  </span>
                                  <button
                                    onClick={() => handleApproveKyc(u.id, u.name)}
                                    className="px-2 py-1 rounded bg-brand-black hover:bg-brand-black/90 text-white font-bold text-[8px] uppercase tracking-wider cursor-pointer"
                                  >
                                    {t('admin.actionApprove')}
                                  </button>
                                </div>
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
                        start: (userPage - 1) * PAGINATION_LIMIT + 1, 
                        end: Math.min(filteredUsers.length, userPage * PAGINATION_LIMIT), 
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
                                  <img src={senderUser?.avatar} className="w-6 h-6 rounded-full object-cover" />
                                  <span className="font-bold">{senderUser?.name}</span>
                                </div>
                                <span className="text-[10px] text-brand-gray-400 mt-0.5 block truncate max-w-[120px]" title={s.senderPropertyId}>Prop: {s.senderPropertyId}</span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center gap-2">
                                  <img src={receiverUser?.avatar} className="w-6 h-6 rounded-full object-cover" />
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
                        start: (swapPage - 1) * PAGINATION_LIMIT + 1, 
                        end: Math.min(filteredSwaps.length, swapPage * PAGINATION_LIMIT), 
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
                        El ecosistema AuraSwap funciona perfectamente y los anfitriones cumplen con las normas.
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
              <motion.div
                key="reports"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-brand-gray-200/70 rounded-3xl shadow-premium p-6 sm:p-8"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-brand-gray-100">
                  <div>
                    <h2 className="text-base font-black text-brand-black tracking-tight">{t('admin.reportsTitle')}</h2>
                    <p className="text-xs text-brand-gray-500 mt-0.5">
                      {t('admin.reportsDesc')}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      confetti({ particleCount: 60, spread: 45 });
                      alert('Exporting Ledger PDF...');
                    }}
                    className="flex items-center gap-1 px-4 py-2 border border-brand-gray-200 rounded-xl hover:bg-brand-gray-50 text-xs font-bold text-brand-black select-none cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-brand-accent" />
                    <span>{t('admin.reportsExport')}</span>
                  </button>
                </div>

                {/* Financial overview breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                  
                  <div className="border border-brand-gray-150 p-5 rounded-2xl bg-brand-gray-50/50">
                    <span className="text-[9px] font-black uppercase tracking-wider text-brand-gray-500">{t('admin.reportsVerifFees')}</span>
                    <h3 className="text-2xl font-black text-brand-black tracking-tight mt-2">
                      {(swaps.length * verificationFee).toFixed(2)}€
                    </h3>
                    <p className="text-[10px] text-brand-gray-400 font-bold mt-1">
                      {t('admin.reportsVerifSub', { count: swaps.length, fee: verificationFee })}
                    </p>
                  </div>

                  <div className="border border-brand-gray-150 p-5 rounded-2xl bg-brand-gray-50/50">
                    <span className="text-[9px] font-black uppercase tracking-wider text-brand-gray-500">{t('admin.reportsCommFees')}</span>
                    <h3 className="text-2xl font-black text-brand-black tracking-tight mt-2">
                      {(swaps.filter(s => s.status === 'APPROVED').length * 150 * (commissionRate / 100)).toFixed(2)}€
                    </h3>
                    <p className="text-[10px] text-brand-gray-400 font-bold mt-1">
                      {t('admin.reportsCommSub', { rate: commissionRate })}
                    </p>
                  </div>

                  <div className="border border-brand-gray-150 p-5 rounded-2xl bg-brand-gray-50/50">
                    <span className="text-[9px] font-black uppercase tracking-wider text-brand-gray-500">{t('admin.reportsNetFees')}</span>
                    <h3 className="text-2xl font-black text-brand-accent tracking-tight mt-2">
                      {((swaps.length * verificationFee) + (swaps.filter(s => s.status === 'APPROVED').length * 150 * (commissionRate / 100))).toFixed(2)}€
                    </h3>
                    <p className="text-[10px] text-emerald-500 font-bold mt-1">
                      {t('admin.reportsNetSub')}
                    </p>
                  </div>

                </div>

                {/* Conversion breakdown */}
                <div>
                  <h3 className="text-xs font-black text-brand-black tracking-tight mb-4">{t('admin.reportsPerformance')}</h3>
                  
                  <div className="border border-brand-gray-150 rounded-2xl overflow-hidden text-xs">
                    <div className="bg-brand-gray-50 p-3 border-b border-brand-gray-200 text-brand-gray-500 font-black text-[9px] uppercase tracking-wider flex justify-between">
                      <span>{t('admin.reportsMetricName')}</span>
                      <span>{t('admin.reportsMetricVal')}</span>
                    </div>

                    <div className="p-3 border-b border-brand-gray-100 flex justify-between items-center">
                      <span className="font-bold text-brand-black">{t('admin.reportsTotalFeat')}</span>
                      <span className="font-black text-brand-accent">
                        {t('admin.reportsFeatVal', { featured: properties.filter((p: any) => p.isFeatured).length, total: properties.length })}
                      </span>
                    </div>

                    <div className="p-3 border-b border-brand-gray-100 flex justify-between items-center">
                      <span className="font-bold text-brand-black">{t('admin.reportsConvRate')}</span>
                      <span className="font-black text-emerald-600">
                        {t('admin.reportsConvVal', { percent: ((swaps.filter(s => s.status === 'APPROVED').length / Math.max(1, swaps.length)) * 100).toFixed(1) })}
                      </span>
                    </div>

                    <div className="p-3 flex justify-between items-center">
                      <span className="font-bold text-brand-black">{t('admin.reportsKycVerified')}</span>
                      <span className="font-black text-brand-black">
                        {t('admin.reportsKycVal', { count: users.filter(u => u.kycStatus === 'VERIFIED').length })}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 7: SYSTEM SETTINGS */}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white border border-brand-gray-200/70 rounded-3xl shadow-premium p-6 sm:p-8"
              >
                <div className="mb-6">
                  <h2 className="text-base font-black text-brand-black tracking-tight">
                    {t('admin.settingsTitle')}
                  </h2>
                  <p className="text-xs text-brand-gray-500 mt-0.5">
                    {t('admin.settingsDesc')}
                  </p>
                </div>

                {/* Form fields settings */}
                <div className="flex flex-col gap-6 max-w-md">
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-black text-brand-black">
                      {t('admin.verifFeeLabel')}
                    </label>
                    <div className="relative">
                      <DollarSign className="w-4 h-4 text-brand-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="number"
                        value={verificationFee}
                        onChange={(e) => setVerificationFee(Number(e.target.value))}
                        className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-brand-gray-200/60 focus:outline-none focus:border-brand-accent text-xs font-bold bg-brand-gray-50/50"
                      />
                    </div>
                    <span className="text-[10px] text-brand-gray-400 leading-normal mt-0.5">
                      {t('admin.settingsVerifDesc')}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-black text-brand-black">
                      {t('admin.serviceFeeLabel')}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="0.5"
                        max="5.0"
                        step="0.1"
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(Number(e.target.value))}
                        className="w-full accent-brand-accent cursor-pointer"
                      />
                      <span className="text-xs font-black text-brand-black shrink-0 px-2 py-1 bg-brand-gray-100 rounded-lg">
                        {commissionRate}%
                      </span>
                    </div>
                    <span className="text-[10px] text-brand-gray-400 leading-normal mt-0.5">
                      {t('admin.settingsCommDesc')}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 pt-4 border-t border-brand-gray-100 mt-2">
                    <label className="text-xs font-black text-brand-black flex items-center justify-between">
                      <span>Modo Cerebro Gemini</span>
                      <button
                        type="button"
                        onClick={toggleGemini}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 ${
                          geminiActive ? 'bg-brand-accent' : 'bg-brand-gray-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            geminiActive ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </label>
                    <span className="text-[10px] text-brand-gray-400 leading-normal">
                      {geminiActive 
                        ? "Conectada a Gemini: Eterna procesará cada mensaje directamente con Gemini Flash." 
                        : "Desconectada: Eterna usará la API del servidor local o el motor viejo."}
                    </span>
                  </div>

                  <div className="pt-4 border-t border-brand-gray-100 mt-2">
                    <button
                      onClick={handleSaveSettings}
                      className="w-full py-3 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-colors shadow-sm select-none cursor-pointer"
                    >
                      {t('admin.settingsSave')}
                    </button>

                    {settingsSuccess && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-4 p-3 bg-emerald-50 border border-emerald-250 rounded-xl text-center text-xs font-bold text-emerald-600"
                      >
                        {t('admin.settingsSuccess')}
                      </motion.div>
                    )}
                  </div>

                </div>
              </motion.div>
            )}

          </AnimatePresence>

        </div>

      </div>

      {/* 3. SLIDING DRAWER SHEET: CREATE & EDIT PROPERTIES */}
      <AnimatePresence>
        {propertyDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setPropertyDrawerOpen(false)}
              className="fixed inset-0 bg-brand-black z-50 cursor-pointer"
            />

            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full sm:max-w-xl bg-white shadow-floating z-50 overflow-y-auto border-l border-brand-gray-200 flex flex-col"
            >
              <div className="p-6 border-b border-brand-gray-200/60 bg-brand-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-brand-black tracking-tight">
                    {editingPropertyId ? t('admin.editPropTitle') : t('admin.addPropTitle')}
                  </h3>
                  <p className="text-[10px] text-brand-gray-400 font-semibold mt-0.5">
                    {t('admin.drawerDesc')}
                  </p>
                </div>
                <button
                  onClick={() => setPropertyDrawerOpen(false)}
                  className="p-1.5 rounded-full hover:bg-brand-gray-200 transition-colors text-brand-gray-500 hover:text-brand-black cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveProperty} className="p-6 flex flex-col gap-5 overflow-y-auto flex-1">
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propNameLabel')}</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder={t('admin.propNamePlaceholder')}
                    className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propTypeLabel')}</label>
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-brand-gray-200 text-xs font-bold"
                    >
                      <option value="Apartment">Apartment</option>
                      <option value="Beach House">Beach House</option>
                      <option value="Cabin">Cabin</option>
                      <option value="Penthouse">Penthouse</option>
                      <option value="Villa">Villa</option>
                      <option value="Loft">Loft</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propTierLabel')}</label>
                    <select
                      value={formTier}
                      onChange={(e) => setFormTier(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-xl border border-brand-gray-200 text-xs font-bold"
                    >
                      <option value="Premium">Premium</option>
                      <option value="Luxury">Luxury</option>
                      <option value="Exclusive">Exclusive</option>
                      <option value="Curated">Curated</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propCityLabel')}</label>
                    <input
                      type="text"
                      required
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      placeholder={t('admin.propCityPlaceholder')}
                      className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-semibold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propCountryLabel')}</label>
                    <input
                      type="text"
                      required
                      value={formCountry}
                      onChange={(e) => setFormCountry(e.target.value)}
                      placeholder={t('admin.propCountryPlaceholder')}
                      className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-semibold"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propAddressLabel')}</label>
                  <input
                    type="text"
                    value={formAddress}
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder={t('admin.propAddressPlaceholder')}
                    className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-semibold"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propCapacityLabel')}</label>
                    <input
                      type="number"
                      min="1"
                      value={formGuests}
                      onChange={(e) => setFormGuests(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-bold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propBedsLabel')}</label>
                    <input
                      type="number"
                      min="1"
                      value={formBedrooms}
                      onChange={(e) => setFormBedrooms(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-bold"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propBathsLabel')}</label>
                    <input
                      type="number"
                      min="1"
                      value={formBathrooms}
                      onChange={(e) => setFormBathrooms(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propDescLabel')}</label>
                  <textarea
                    rows={4}
                    required
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder={t('admin.propDescPlaceholder')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-medium leading-relaxed resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propImagesLabel')}</label>
                  <textarea
                    rows={3}
                    value={formImageUrls}
                    onChange={(e) => setFormImageUrls(e.target.value)}
                    placeholder="https://images.unsplash.com/... (one image URL per line)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-[10px] font-bold leading-normal resize-none"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propRulesLabel')}</label>
                  <textarea
                    rows={2}
                    value={formRules}
                    onChange={(e) => setFormRules(e.target.value)}
                    placeholder="e.g. No smoking inside..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-[10px] font-semibold leading-normal resize-none"
                  />
                </div>

                {/* Amenities checklist */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                    {t('admin.propAmenitiesLabel')}
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    {AMENITIES_LIST.map((amenity) => {
                      const isChecked = formAmenities.includes(amenity);
                      return (
                        <button
                          key={amenity}
                          type="button"
                          onClick={() => handleToggleAmenityCheckbox(amenity)}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-[10px] font-bold text-left transition-colors cursor-pointer ${
                            isChecked 
                              ? 'bg-brand-accent/5 border-brand-accent text-brand-accent' 
                              : 'bg-white border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-50'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                            isChecked ? 'bg-brand-accent border-brand-accent text-white' : 'border-brand-gray-300'
                          }`}>
                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span>{amenity}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Save Button */}
                <div className="pt-6 mt-4 border-t border-brand-gray-100 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPropertyDrawerOpen(false)}
                    className="w-1/3 py-3 border border-brand-gray-200 rounded-full hover:bg-brand-gray-50 text-xs font-bold text-brand-black select-none cursor-pointer"
                  >
                    {t('admin.drawerClose')}
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-3 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-colors shadow-sm select-none cursor-pointer"
                  >
                    {t('admin.propSaveBtn')}
                  </button>
                </div>

              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* 4. CRM SLIDING DRAWER SHEET: USER PROFILE & SWAP NEGOTIATIONS HISTORY */}
      <AnimatePresence>
        {userDrawerOpen && selectedUserDetails && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              onClick={() => setUserDrawerOpen(false)}
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
                  onClick={() => setUserDrawerOpen(false)}
                  className="p-1.5 rounded-full hover:bg-brand-gray-200 transition-colors text-brand-gray-500 hover:text-brand-black cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex flex-col gap-6 overflow-y-auto flex-1">
                
                {/* Profile block */}
                <div className="flex items-center gap-4 p-4 border border-brand-gray-200/70 rounded-3xl bg-brand-gray-50/50">
                  <img
                    src={selectedUserDetails.user.avatar}
                    alt={selectedUserDetails.user.name}
                    className="w-14 h-14 rounded-full object-cover border border-white shadow-sm shrink-0"
                  />
                  <div>
                    <h4 className="text-sm font-black text-brand-black tracking-tight flex items-center gap-1.5">
                      <span>{selectedUserDetails.user.name}</span>
                      {selectedUserDetails.user.isVerified && (
                        <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-black uppercase rounded">{t('admin.crmDrawerKycOk')}</span>
                      )}
                    </h4>
                    <p className="text-[10px] text-brand-gray-400 font-bold uppercase tracking-wider mt-0.5">{t('admin.crmDrawerRole')} {selectedUserDetails.user.role}</p>
                    <p className="text-[9px] text-brand-gray-400 font-semibold mt-1">{t('admin.crmDrawerDetails')} {selectedUserDetails.user.id}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleHostVerified(selectedUserDetails.user.id, selectedUserDetails.user.name)}
                    className={`py-2.5 px-4 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer text-center ${
                      selectedUserDetails.user.isVerified 
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100' 
                        : 'bg-white border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-50'
                    }`}
                  >
                    {t('admin.crmDrawerVerifyHost')}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleSuspension(selectedUserDetails.user.id, selectedUserDetails.user.name)}
                    className={`py-2.5 px-4 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer text-center ${
                      selectedUserDetails.user.isSuspended 
                        ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' 
                        : 'bg-white border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-50'
                    }`}
                  >
                    {selectedUserDetails.user.isSuspended ? t('admin.crmDrawerActivate') : t('admin.crmDrawerSuspend')}
                  </button>
                </div>

                {/* Listed Properties */}
                <div>
                  <h4 className="text-[10px] font-black text-brand-black uppercase tracking-wider mb-3">
                    {t('admin.crmDrawerPropsTitle', { count: selectedUserDetails.properties.length })}
                  </h4>
                  {selectedUserDetails.properties.length === 0 ? (
                    <p className="text-[10px] text-brand-gray-400 font-bold">{t('admin.crmDrawerNoProps')}</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {selectedUserDetails.properties.map(p => (
                        <div key={p.id} className="border border-brand-gray-200/60 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs bg-white">
                          <div className="flex items-center gap-2.5">
                            <img src={p.images[0]} className="w-10 h-7 rounded object-cover" />
                            <div>
                              <p className="font-bold text-brand-black line-clamp-1">{p.title}</p>
                              <p className="text-[9px] text-brand-gray-400 font-bold mt-0.5">{p.location}, {p.country}</p>
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${
                            p.isPublished !== false ? 'bg-emerald-50 text-emerald-600' : 'bg-brand-gray-100 text-brand-gray-400'
                          }`}>
                            {p.isPublished !== false ? t('admin.statusPublished') : t('admin.statusDraft')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Swap Timeline */}
                <div>
                  <h4 className="text-[10px] font-black text-brand-black uppercase tracking-wider mb-3">
                    {t('admin.crmDrawerSwapsTitle', { count: selectedUserDetails.swaps.length })}
                  </h4>
                  {selectedUserDetails.swaps.length === 0 ? (
                    <p className="text-[10px] text-brand-gray-400 font-bold">{t('admin.crmDrawerNoSwaps')}</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {selectedUserDetails.swaps.map(s => {
                        const isSender = s.senderId === selectedUserDetails.user.id;
                        const partner = users.find(u => u.id === (isSender ? s.receiverId : s.senderId));
                        return (
                          <div key={s.id} className="border border-brand-gray-200 p-4 rounded-2xl bg-white shadow-xs">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[9px] font-black text-brand-accent uppercase tracking-wider">ID: {s.id}</span>
                              <span className={`px-2 py-0.5 text-[8px] font-black uppercase rounded ${
                                s.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600' :
                                s.status === 'DECLINED' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600 animate-pulse'
                              }`}>
                                {s.status}
                              </span>
                            </div>

                            <p className="text-[10px] text-brand-gray-600 font-semibold mb-2">
                              {isSender ? 'Propuso trueque a' : 'Recibió oferta de'}: <strong>{partner?.name || 'Otro anfitrión'}</strong>
                            </p>

                            <p className="text-[9px] text-brand-gray-400 font-medium bg-brand-gray-50 p-2.5 rounded-lg italic line-clamp-2">
                              "{s.message}"
                            </p>

                            <div className="flex items-center justify-between text-[9px] text-brand-gray-400 font-bold mt-3 pt-2.5 border-t border-brand-gray-100">
                              <span>Período: {s.startDate} al {s.endDate}</span>
                              {s.isDisputed && (
                                <span className="text-rose-600 uppercase font-black tracking-wider animate-pulse flex items-center gap-0.5">
                                  <AlertTriangle className="w-3 h-3" /> Disputado
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Close footer button */}
              <div className="p-4 border-t border-brand-gray-100 bg-brand-gray-50">
                <button
                  onClick={() => setUserDrawerOpen(false)}
                  className="w-full py-3 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-colors shadow-sm select-none cursor-pointer"
                >
                  {t('admin.crmDrawerClose')}
                </button>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

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
