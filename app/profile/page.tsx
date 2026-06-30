"use client";

import React, { useState, useEffect } from 'react';
import { useSwap } from '../../lib/context/SwapContext';
import { useTranslation } from '../../lib/context/LanguageContext';
import AuthGuard from '../../components/AuthGuard';
import { 
  User, Mail, MapPin, FileText, CheckCircle2, ShieldCheck, 
  Settings, Award, RefreshCw, BadgeCheck, AlertCircle, Sparkles, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type SubTabType = 'personal' | 'verification';

export default function ProfilePage() {
  const { t, language } = useTranslation();
  const { currentUser, updateProfileMock } = useSwap();

  // Route protection gate check
  if (!currentUser) {
    return <AuthGuard />;
  }

  // Sub Tab states
  const [activeTab, setActiveTab] = useState<SubTabType>('personal');

  // Input states initialized from current logged-in user
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [city, setCity] = useState(currentUser.favorites ? currentUser.favorites[0] || 'Tokyo' : 'Tokyo');
  const [avatar, setAvatar] = useState(currentUser.avatar);

  // Simulated validation indicators
  const [role, setRole] = useState(currentUser.role);
  const [kycStatus, setKycStatus] = useState(currentUser.kycStatus);
  const [isVerified, setIsVerified] = useState(currentUser.isVerified);
  
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Preset Unsplash profiles for premium avatar selections
  const curatedAvatars = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80',
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=150&q=80',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=150&q=80',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=150&q=80'
  ];

  // Keep state synced if currentUser changes (e.g. via quick roles switcher)
  useEffect(() => {
    setName(currentUser.name);
    setBio(currentUser.bio || '');
    setCity(currentUser.favorites ? currentUser.favorites[0] || 'Tokyo' : 'Tokyo');
    setAvatar(currentUser.avatar);
    setRole(currentUser.role);
    setKycStatus(currentUser.kycStatus);
    setIsVerified(currentUser.isVerified);
  }, [currentUser]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Save in SwapContext (fully reactive and mock-persisted)
    updateProfileMock({
      name,
      bio,
      favorites: [city],
      avatar,
      role,
      kycStatus,
      isVerified
    });

    window.dispatchEvent(new CustomEvent('auraswap:flow-event', { detail: { event: 'profile_saved' } }));

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 sm:px-12 md:px-24 py-10 relative">
      
      {/* Ambient background glows */}
      <div className="absolute top-1/4 right-10 w-80 h-80 rounded-full bg-brand-accent/5 filter blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-1/4 left-10 w-80 h-80 rounded-full bg-brand-rose/5 filter blur-3xl pointer-events-none -z-10 animate-pulse" />

      {/* Profile Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-8 pb-6 border-b border-brand-gray-200/60">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-brand-black flex items-center justify-center text-white shadow-glow">
              <Settings className="w-5 h-5 text-brand-accent animate-spin" style={{ animationDuration: '10s' }} />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-brand-gray-400">Verified Member Console</span>
              <h1 className="text-2xl sm:text-3xl font-black text-brand-black tracking-tight leading-none mt-0.5">
                {t('profile.title')}
              </h1>
            </div>
          </div>
          <p className="text-xs text-brand-gray-500 font-semibold">
            {t('profile.subtitle')}
          </p>
        </div>

        {/* Sync loading badge */}
        <div className="glass px-3.5 py-2 rounded-full text-[10px] font-black uppercase text-brand-black border border-brand-gray-200/50 shadow-sm flex items-center gap-2">
          <RefreshCw className="w-3.5 h-3.5 text-brand-accent animate-spin" />
          <span>Local Sync Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Premium Dossier Preview Card */}
        <div className="lg:col-span-4 bg-white border border-brand-gray-200/80 rounded-3xl p-5 shadow-floating flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-24 h-24 rounded-full bg-brand-accent/5 filter blur-lg pointer-events-none" />
          
          <div className="w-20 h-20 rounded-full overflow-hidden border border-brand-gray-200 shadow-sm relative group shrink-0 mb-4">
            <img src={avatar} alt={name} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-brand-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
              <Sparkles className="w-5 h-5" />
            </div>
          </div>

          <h2 className="text-base font-black text-brand-black tracking-tight flex items-center gap-1.5 justify-center leading-none">
            <span>{name}</span>
            {isVerified && (
              <BadgeCheck className="w-4 h-4 text-emerald-500 fill-emerald-50" />
            )}
          </h2>
          
          <p className="text-[9px] text-brand-gray-400 font-black uppercase mt-1.5 tracking-wider leading-none">
            {role}
          </p>

          <p className="text-[10px] text-brand-gray-500 font-semibold leading-relaxed mt-4 line-clamp-3 italic">
            "{bio || 'Sin biografía disponible...'}"
          </p>

          <div className="w-full border-t border-brand-gray-100 pt-4 mt-5 flex flex-col gap-2.5 text-[10px] font-bold text-left">
            <div className="flex justify-between items-center">
              <span className="text-brand-gray-400">KYC Status:</span>
              <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                kycStatus === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                kycStatus === 'FAILED' ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
              }`}>
                {kycStatus}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-brand-gray-400">Preferencia:</span>
              <span className="text-brand-black flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-brand-accent/70" />
                {city}
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Profile Editor and Simulation Cockpit */}
        <div className="lg:col-span-8 bg-white border border-brand-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-floating">
          
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b border-brand-gray-100 pb-4 mb-6">
            <button
              onClick={() => setActiveTab('personal')}
              className={`pb-2.5 px-1 text-xs font-black uppercase tracking-wider relative cursor-pointer ${
                activeTab === 'personal' ? 'text-brand-black' : 'text-brand-gray-400 hover:text-brand-black'
              }`}
            >
              <span>{t('profile.tabPersonal')}</span>
              {activeTab === 'personal' && (
                <motion.div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-black" layoutId="profile-tab-line" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('verification')}
              className={`pb-2.5 px-1 text-xs font-black uppercase tracking-wider relative cursor-pointer ${
                activeTab === 'verification' ? 'text-brand-black' : 'text-brand-gray-400 hover:text-brand-black'
              }`}
            >
              <span>{t('profile.tabVerified')}</span>
              {activeTab === 'verification' && (
                <motion.div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-black" layoutId="profile-tab-line" />
              )}
            </button>
          </div>

          <form onSubmit={handleSaveProfile} className="flex flex-col gap-6">
            
            <AnimatePresence mode="wait">
              {activeTab === 'personal' ? (
                <motion.div
                  key="personal-fields"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex flex-col gap-5"
                >
                  {/* Premium Portrait selector */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('profile.avatarLabel')}
                    </label>
                    <div className="flex items-center gap-3 overflow-x-auto py-1">
                      {curatedAvatars.map((url, idx) => {
                        const isSel = avatar === url;
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setAvatar(url)}
                            className={`w-11 h-11 rounded-full overflow-hidden border-2 cursor-pointer transition-all hover:scale-105 shrink-0 ${
                              isSel ? 'border-brand-accent ring-2 ring-brand-accent/25 scale-105 shadow-sm' : 'border-brand-gray-200'
                            }`}
                          >
                            <img src={url} className="w-full h-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                        {t('profile.nameLabel')}
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-gray-200/80 focus:outline-none focus:border-brand-black text-xs font-semibold"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                        {t('profile.cityLabel')}
                      </label>
                      <div className="relative">
                        <MapPin className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          required
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-gray-200/80 focus:outline-none focus:border-brand-black text-xs font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('profile.bioLabel')}
                    </label>
                    <textarea
                      rows={4}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="Cuéntale a la red..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-black text-xs font-semibold leading-relaxed resize-none animate-none"
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="verification-fields"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  className="flex flex-col gap-6"
                >
                  {/* Tester switchers: Roles */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('profile.roleLabel')}
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {(['MEMBER', 'HOST', 'ADMIN'] as const).map(roleOption => (
                        <button
                          key={roleOption}
                          type="button"
                          onClick={() => setRole(roleOption)}
                          className={`py-2 px-3 border rounded-xl text-[10px] font-black uppercase text-center transition-all cursor-pointer ${
                            role === roleOption
                              ? 'bg-brand-black border-brand-black text-white shadow-premium'
                              : 'bg-white border-brand-gray-200 text-brand-gray-500 hover:bg-brand-gray-50'
                          }`}
                        >
                          {roleOption}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tester switchers: KYC */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('profile.kycLabel')}
                    </label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {(['PENDING', 'VERIFIED', 'FAILED'] as const).map(kycOption => (
                        <button
                          key={kycOption}
                          type="button"
                          onClick={() => setKycStatus(kycOption)}
                          className={`py-2 px-3 border rounded-xl text-[10px] font-black uppercase text-center transition-all cursor-pointer ${
                            kycStatus === kycOption
                              ? 'bg-brand-black border-brand-black text-white shadow-premium'
                              : 'bg-white border-brand-gray-200 text-brand-gray-500 hover:bg-brand-gray-50'
                          }`}
                        >
                          {kycOption === 'VERIFIED' ? t('profile.kycStatusVerified') :
                           kycOption === 'FAILED' ? t('profile.kycStatusFailed') : t('profile.kycStatusPending')}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tester switchers: Verified host badge */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('profile.badgeLabel')}
                    </label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setIsVerified(true)}
                        className={`py-2 px-3 border rounded-xl text-[10px] font-black uppercase text-center transition-all cursor-pointer ${
                          isVerified
                            ? 'bg-emerald-600 border-emerald-600 text-white shadow-premium'
                            : 'bg-white border-brand-gray-200 text-brand-gray-500 hover:bg-brand-gray-50'
                        }`}
                      >
                        {t('profile.verifiedBadgeActive')}
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsVerified(false)}
                        className={`py-2 px-3 border rounded-xl text-[10px] font-black uppercase text-center transition-all cursor-pointer ${
                          !isVerified
                            ? 'bg-rose-600 border-rose-600 text-white shadow-premium'
                            : 'bg-white border-brand-gray-200 text-brand-gray-500 hover:bg-brand-gray-50'
                        }`}
                      >
                        {t('profile.verifiedBadgeInactive')}
                      </button>
                    </div>
                  </div>

                </motion.div>
              )}
            </AnimatePresence>

            {/* Save Buttons and alerts */}
            <div className="pt-6 border-t border-brand-gray-100 flex flex-col gap-3.5 mt-2">
              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-colors shadow-premium cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-brand-accent animate-pulse" />
                <span>{t('profile.saveBtn')}</span>
              </button>

              {saveSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 bg-emerald-50 border border-emerald-250 rounded-xl text-center text-xs font-bold text-emerald-600 flex items-center justify-center gap-2 animate-in fade-in"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{t('profile.saveSuccess')}</span>
                </motion.div>
              )}
            </div>

          </form>

        </div>

      </div>

    </div>
  );
}
