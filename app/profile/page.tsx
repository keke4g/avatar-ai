"use client";

import React, { useState } from 'react';
import { useSwap } from '../../lib/context/SwapContext';
import { useTranslation } from '../../lib/context/LanguageContext';
import AuthGuard from '../../components/AuthGuard';
import {
  User, MapPin, CheckCircle2, ShieldCheck,
  Settings, RefreshCw, BadgeCheck, AlertCircle, Check, Trash2, X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { User as AuraUser } from '../../lib/types';
import ProfileAvatar from '../../components/ProfileAvatar';
import ProfilePhotoUploader from '../../components/ProfilePhotoUploader';
import { normalizeProfileSettings } from '../../lib/profile/profileSettings';
import { supabase } from '../../lib/supabaseClient';

type SubTabType = 'personal' | 'verification';

export default function ProfilePage() {
  return (
    <AuthGuard>
      <ProfilePageContent />
    </AuthGuard>
  );
}

function ProfilePageContent() {
  const { currentUser } = useSwap();
  if (!currentUser) return null;
  return <ProfileEditor key={currentUser.id} currentUser={currentUser} />;
}

function ProfileEditor({ currentUser }: { currentUser: AuraUser }) {
  const { t, language } = useTranslation();
  const { updateProfileMock } = useSwap();

  // Sub Tab states
  const [activeTab, setActiveTab] = useState<SubTabType>('personal');

  // Input states initialized from current logged-in user
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio || '');
  const [location, setLocation] = useState(currentUser.location || '');
  const [avatar, setAvatar] = useState(currentUser.avatar);

  // Simulated validation indicators
  const role = currentUser.role;
  const kycStatus = currentUser.kycStatus;
  const isVerified = currentUser.isVerified;
  
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const expectedDeleteConfirmation = language === 'es' ? 'ELIMINAR' : 'DELETE';

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSaving(true);
    setSaveError('');
    setSaveSuccess(false);

    try {
      const normalized = normalizeProfileSettings({ name, bio, location, avatar });
      await updateProfileMock(normalized);

      setName(normalized.name);
      setBio(normalized.bio);
      setLocation(normalized.location);
      window.dispatchEvent(new CustomEvent('auraswap:flow-event', { detail: { event: 'profile_saved' } }));
      setSaveSuccess(true);
      window.setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('[ProfilePage] Profile save failed:', error);
      setSaveError(
        language === 'es'
          ? 'No pudimos guardar tus cambios. Revisa los datos e inténtalo nuevamente.'
          : 'We could not save your changes. Check your information and try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation.trim().toUpperCase() !== expectedDeleteConfirmation) return;

    setIsDeleting(true);
    setDeleteError('');

    try {
      const { error } = await supabase.functions.invoke('delete-account', {
        body: { confirmation: expectedDeleteConfirmation },
      });
      if (error) throw error;

      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      for (const key of Object.keys(window.localStorage)) {
        if (key.startsWith('auraswap_') || key.startsWith('towers-')) {
          window.localStorage.removeItem(key);
        }
      }
      window.location.replace('/');
    } catch (error) {
      console.error('[ProfilePage] Account deletion failed:', error);
      setDeleteError(
        language === 'es'
          ? 'No pudimos eliminar tu cuenta. Inténtalo nuevamente o solicita ayuda en gardens.towers@gmail.com.'
          : 'We could not delete your account. Try again or request help at gardens.towers@gmail.com.',
      );
      setIsDeleting(false);
    }
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
          <span>{language === 'es' ? 'Cuenta sincronizada' : 'Account synced'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: Premium Dossier Preview Card */}
        <div className="lg:col-span-4 bg-white border border-brand-gray-200/80 rounded-3xl p-5 shadow-floating flex flex-col items-center text-center relative overflow-hidden">
          <div className="absolute -top-10 -left-10 w-24 h-24 rounded-full bg-brand-accent/5 filter blur-lg pointer-events-none" />
          
          <ProfileAvatar
            src={avatar}
            name={name}
            className="mb-4 h-20 w-20 border border-brand-gray-200 shadow-sm"
            textClassName="text-2xl"
          />

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
            &ldquo;{bio || 'Sin biografía disponible...'}&rdquo;
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
                {location || (language === 'es' ? 'Sin ubicación' : 'No location')}
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
                  {/* Profile photo or deterministic initial */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('profile.avatarLabel')}
                    </label>
                    <ProfilePhotoUploader
                      userId={currentUser.id}
                      name={name}
                      value={avatar}
                      onChange={setAvatar}
                    />
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
                          maxLength={120}
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
                          maxLength={160}
                          value={location}
                          onChange={(e) => setLocation(e.target.value)}
                          placeholder={language === 'es' ? 'Ej. Culiacán, Sinaloa' : 'e.g. Culiacán, Sinaloa'}
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
                      maxLength={500}
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
                  <div className="rounded-2xl border border-brand-gray-200 bg-brand-gray-50/70 p-4">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-accent" />
                      <div>
                        <p className="text-xs font-black text-brand-black">
                          {language === 'es' ? 'Acceso administrado de forma segura' : 'Securely managed access'}
                        </p>
                        <p className="mt-1 text-[10px] font-semibold leading-relaxed text-brand-gray-500">
                          {language === 'es'
                            ? 'Tu rol y estado de verificación solo pueden ser modificados por un administrador.'
                            : 'Only an administrator can change your role and verification status.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      {
                        label: t('profile.roleLabel'),
                        value: role === 'INTERNAL_ADVISOR'
                          ? (language === 'es' ? 'Asesor interno' : 'Internal advisor')
                          : role,
                      },
                      {
                        label: t('profile.kycLabel'),
                        value: kycStatus === 'VERIFIED'
                          ? t('profile.kycStatusVerified')
                          : kycStatus === 'FAILED'
                            ? t('profile.kycStatusFailed')
                            : t('profile.kycStatusPending'),
                      },
                      {
                        label: t('profile.badgeLabel'),
                        value: isVerified
                          ? t('profile.verifiedBadgeActive')
                          : t('profile.verifiedBadgeInactive'),
                      },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl border border-brand-gray-200 bg-white p-4">
                        <p className="text-[9px] font-black uppercase tracking-wider text-brand-gray-400">
                          {item.label}
                        </p>
                        <p className="mt-2 text-xs font-black text-brand-black">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                </motion.div>
              )}
            </AnimatePresence>

            {/* Save Buttons and alerts */}
            <div className="pt-6 border-t border-brand-gray-100 flex flex-col gap-3.5 mt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-3.5 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 disabled:cursor-wait disabled:opacity-60 text-white font-bold text-xs tracking-wider uppercase transition-colors shadow-premium cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSaving ? (
                  <RefreshCw className="w-4 h-4 text-brand-accent animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-brand-accent" />
                )}
                <span>
                  {isSaving
                    ? (language === 'es' ? 'Guardando…' : 'Saving…')
                    : t('profile.saveBtn')}
                </span>
              </button>

              {saveError && (
                <motion.div
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-center text-xs font-bold text-rose-700 flex items-center justify-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saveError}</span>
                </motion.div>
              )}

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

      <section className="mt-8 rounded-3xl border border-rose-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-rose-600">
              {language === 'es' ? 'Control de cuenta' : 'Account control'}
            </p>
            <h2 className="mt-2 text-lg font-black tracking-tight text-brand-black">
              {language === 'es' ? 'Eliminar mi cuenta' : 'Delete my account'}
            </h2>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-brand-gray-500">
              {language === 'es'
                ? 'Elimina definitivamente tu perfil, propiedades, conversaciones, archivos y demás datos vinculados a tu cuenta.'
                : 'Permanently delete your profile, properties, conversations, files, and other data linked to your account.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setDeleteConfirmation('');
              setDeleteError('');
              setIsDeleteDialogOpen(true);
            }}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border border-rose-300 px-5 text-xs font-black uppercase tracking-wider text-rose-700 transition hover:bg-rose-50"
          >
            <Trash2 className="h-4 w-4" />
            {language === 'es' ? 'Eliminar cuenta' : 'Delete account'}
          </button>
        </div>
      </section>

      <AnimatePresence>
        {isDeleteDialogOpen && (
          <motion.div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl sm:p-8"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600">
                    {language === 'es' ? 'Acción permanente' : 'Permanent action'}
                  </p>
                  <h2 id="delete-account-title" className="mt-2 text-2xl font-black tracking-tight text-brand-black">
                    {language === 'es' ? '¿Eliminar tu cuenta?' : 'Delete your account?'}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => !isDeleting && setIsDeleteDialogOpen(false)}
                  className="rounded-full border border-brand-gray-200 p-2 text-brand-gray-500 transition hover:text-brand-black"
                  aria-label={language === 'es' ? 'Cerrar' : 'Close'}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="mt-5 text-sm font-semibold leading-6 text-brand-gray-600">
                {language === 'es'
                  ? 'Esta acción cerrará tu sesión y eliminará definitivamente el contenido asociado. No podrás recuperar la cuenta.'
                  : 'This will sign you out and permanently delete associated content. The account cannot be recovered.'}
              </p>

              <label className="mt-6 block text-[10px] font-black uppercase tracking-wider text-brand-black">
                {language === 'es'
                  ? `Escribe ${expectedDeleteConfirmation} para confirmar`
                  : `Type ${expectedDeleteConfirmation} to confirm`}
              </label>
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                disabled={isDeleting}
                autoComplete="off"
                className="mt-2 w-full rounded-2xl border border-brand-gray-200 px-4 py-3 text-sm font-black uppercase outline-none transition focus:border-rose-500"
              />

              {deleteError && (
                <p role="alert" className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-bold leading-5 text-rose-700">
                  {deleteError}
                </p>
              )}

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={isDeleting}
                  onClick={() => setIsDeleteDialogOpen(false)}
                  className="rounded-full border border-brand-gray-200 px-5 py-3 text-xs font-black uppercase tracking-wider text-brand-black disabled:opacity-50"
                >
                  {language === 'es' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="button"
                  disabled={
                    isDeleting ||
                    deleteConfirmation.trim().toUpperCase() !== expectedDeleteConfirmation
                  }
                  onClick={handleDeleteAccount}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-rose-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {isDeleting
                    ? (language === 'es' ? 'Eliminando…' : 'Deleting…')
                    : (language === 'es' ? 'Eliminar definitivamente' : 'Delete permanently')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
