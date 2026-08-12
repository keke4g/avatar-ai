"use client";

import React, { useEffect, useState } from 'react';
import { useSwap } from '../../lib/context/SwapContext';
import { useTranslation } from '../../lib/context/LanguageContext';
import { useSupabase } from '../../lib/services/ServiceFactory';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Compass, ShieldCheck, Check, ArrowRight, ArrowLeft,
  Upload, File, CheckCircle2, User, MapPin
} from 'lucide-react';
import { launchConfetti } from '@/components/runtime/launchConfetti';
import ProfilePhotoUploader from '../../components/ProfilePhotoUploader';

type StepType = 0 | 1 | 2 | 3;

export default function OnboardingPage() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const { currentUser, completeOnboardingMock } = useSwap();

  // Active Wizard Step
  const [step, setStep] = useState<StepType>(0);
  
  // Profile Type selection (Fase 0)
  const [profileType, setProfileType] = useState<'OWNER' | 'AGENT' | 'PROPERTY_MANAGER'>('OWNER');

  // STEP 1 FIELDS: Destinations
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  
  // STEP 2 FIELDS: KYC Upload
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileUploaded, setFileUploaded] = useState(false);
  const [fileName, setFileName] = useState('');
  const [uploadError, setUploadError] = useState('');
  const [finishing, setFinishing] = useState(false);

  // STEP 3 FIELDS: Bio & Avatar
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Curated target cities options
  const targetCities = [
    { id: 'Kyoto', name: 'Kyoto, Japan', img: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=300&q=80' },
    { id: 'Tuscany', name: 'Tuscany, Italy', img: 'https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=300&q=80' },
    { id: 'Paris', name: 'Paris, France', img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=300&q=80' },
    { id: 'Cancun', name: 'Cancún, Mexico', img: 'https://images.unsplash.com/photo-1552074284-5e88ef1aef18?auto=format&fit=crop&w=300&q=80' },
    { id: 'CDMX', name: 'CDMX, Mexico', img: 'https://images.unsplash.com/photo-1585464231875-d9ef1f5ad396?auto=format&fit=crop&w=300&q=80' },
    { id: 'Tokyo', name: 'Tokyo, Japan', img: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=300&q=80' }
  ];

  useEffect(() => {
    if (!useSupabase || !currentUser?.id) return;

    let cancelled = false;
    const restorePendingSubmission = async () => {
      const { data, error } = await supabase
        .from('kyc_requests')
        .select('original_file_name,status')
        .eq('user_id', currentUser.id)
        .eq('status', 'PENDING')
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error('[Onboarding] Unable to restore pending KYC request:', error);
        return;
      }
      if (data) {
        setFileName(data.original_file_name);
        setUploadProgress(100);
        setFileUploaded(true);
      }
    };

    void restorePendingSubmission();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  const handleToggleCity = (cityId: string) => {
    setSelectedCities(prev =>
      prev.includes(cityId) ? prev.filter(c => c !== cityId) : [...prev, cityId]
    );
  };

  const handleKycUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const allowedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);
    const maxFileSize = 10 * 1024 * 1024;

    setUploadError('');
    setFileUploaded(false);
    setFileName(file.name);
    setUploadProgress(0);

    if (!allowedMimeTypes.has(file.type)) {
      setUploadError(language === 'es'
        ? 'Usa un archivo PDF, JPG o PNG válido.'
        : 'Use a valid PDF, JPG, or PNG file.');
      e.target.value = '';
      return;
    }

    if (file.size <= 0 || file.size > maxFileSize) {
      setUploadError(language === 'es'
        ? 'El documento debe pesar menos de 10 MB.'
        : 'The document must be smaller than 10 MB.');
      e.target.value = '';
      return;
    }

    if (!useSupabase) {
      setUploadError(language === 'es'
        ? 'La verificación de identidad requiere el backend seguro de Supabase.'
        : 'Identity verification requires the secure Supabase backend.');
      e.target.value = '';
      return;
    }

    setUploading(true);
    setUploadProgress(15);

    let objectPath = '';
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user || authData.user.id !== currentUser?.id) {
        throw new Error(language === 'es'
          ? 'Tu sesión expiró. Inicia sesión nuevamente.'
          : 'Your session expired. Please sign in again.');
      }

      const extension = file.type === 'application/pdf'
        ? 'pdf'
        : file.type === 'image/png'
          ? 'png'
          : 'jpg';
      objectPath = `${authData.user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: storageError } = await supabase.storage
        .from('kyc-documents')
        .upload(objectPath, file, {
          cacheControl: '3600',
          contentType: file.type,
          upsert: false
        });

      if (storageError) throw storageError;
      setUploadProgress(75);

      const { error: requestError } = await supabase.rpc('submit_kyc_request', {
        target_object_path: objectPath,
        target_original_file_name: file.name,
        target_mime_type: file.type,
        target_size_bytes: file.size
      });

      if (requestError) {
        await supabase.storage.from('kyc-documents').remove([objectPath]);
        throw requestError;
      }

      setUploadProgress(100);
      setFileUploaded(true);
    } catch (error) {
      console.error('[Onboarding] Secure KYC upload failed:', error);
      setUploadError(error instanceof Error
        ? error.message
        : language === 'es'
          ? 'No pudimos enviar el documento. Inténtalo de nuevo.'
          : 'We could not submit the document. Please try again.');
      setUploadProgress(0);
      e.target.value = '';
    } finally {
      setUploading(false);
    }
  };

  const handleFinishOnboarding = async () => {
    setFinishing(true);
    try {
      await completeOnboardingMock(selectedCities, bio, avatarUrl, profileType);

      launchConfetti({
        particleCount: 180,
        spread: 80,
        origin: { y: 0.6 }
      });

      router.push('/dashboard');
    } catch (error) {
      console.error('[Onboarding] Profile completion failed:', error);
      setUploadError(language === 'es'
        ? 'El documento está en revisión, pero no pudimos guardar el perfil. Inténtalo nuevamente.'
        : 'The document is under review, but we could not save the profile. Please try again.');
      setFinishing(false);
    }
  };

  // Redirect to login if user is completely logged out (route protection simulation)
  if (!currentUser) {
    if (typeof window !== 'undefined') {
      router.push('/login');
    }
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 min-h-[85vh] flex flex-col justify-center select-none relative">
      
      {/* Ambient background glows */}
      <div className="absolute top-10 right-10 w-80 h-80 rounded-full bg-brand-accent/5 filter blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 left-10 w-80 h-80 rounded-full bg-brand-rose/5 filter blur-3xl pointer-events-none -z-10" />

      {/* Progress Wizard Steps Head */}
      <div className="flex items-center justify-between mb-8 max-w-lg mx-auto w-full">
        <div className="flex flex-col items-center gap-1.5 relative z-10">
          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-black transition-all ${
            step >= 0 ? 'bg-brand-black text-white border-brand-black shadow-premium' : 'bg-white border-brand-gray-300 text-brand-gray-400'
          }`}>
            {step > 0 ? <Check className="w-4 h-4 stroke-[3]" /> : '0'}
          </div>
          <span className="text-[8px] font-black uppercase tracking-wider text-brand-gray-400">{language === 'es' ? 'Rol' : 'Role'}</span>
        </div>

        <div className="flex-1 h-0.5 bg-brand-gray-200 mx-2 relative -top-3">
          <motion.div 
            className="h-full bg-brand-black" 
            initial={{ width: '0%' }}
            animate={{ width: step > 0 ? '100%' : '0%' }}
          />
        </div>

        <div className="flex flex-col items-center gap-1.5 relative z-10">
          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-black transition-all ${
            step >= 1 ? 'bg-brand-black text-white border-brand-black shadow-premium' : 'bg-white border-brand-gray-300 text-brand-gray-400'
          }`}>
            {step > 1 ? <Check className="w-4 h-4 stroke-[3]" /> : '1'}
          </div>
          <span className="text-[8px] font-black uppercase tracking-wider text-brand-gray-400">{t('onboarding.step1Title') || 'Destinos'}</span>
        </div>

        <div className="flex-1 h-0.5 bg-brand-gray-200 mx-2 relative -top-3">
          <motion.div 
            className="h-full bg-brand-black" 
            initial={{ width: '0%' }}
            animate={{ width: step > 1 ? '100%' : '0%' }}
          />
        </div>

        <div className="flex flex-col items-center gap-1.5 relative z-10">
          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-black transition-all ${
            step >= 2 ? 'bg-brand-black text-white border-brand-black shadow-premium' : 'bg-white border-brand-gray-300 text-brand-gray-400'
          }`}>
            {step > 2 ? <Check className="w-4 h-4 stroke-[3]" /> : '2'}
          </div>
          <span className="text-[8px] font-black uppercase tracking-wider text-brand-gray-400">{t('onboarding.step2Title') || 'KYC'}</span>
        </div>

        <div className="flex-1 h-0.5 bg-brand-gray-200 mx-2 relative -top-3">
          <motion.div 
            className="h-full bg-brand-black" 
            initial={{ width: '0%' }}
            animate={{ width: step > 2 ? '100%' : '0%' }}
          />
        </div>

        <div className="flex flex-col items-center gap-1.5 relative z-10">
          <div className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-black transition-all ${
            step === 3 ? 'bg-brand-black text-white border-brand-black shadow-premium' : 'bg-white border-brand-gray-300 text-brand-gray-400'
          }`}>
            3
          </div>
          <span className="text-[8px] font-black uppercase tracking-wider text-brand-gray-400">{t('onboarding.step3Title') || 'Perfil'}</span>
        </div>
      </div>

      {/* Main Glassmorphic Setup Console */}
      <div className="bg-white border border-brand-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-floating min-h-[420px] flex flex-col justify-between relative overflow-hidden">
        
        <AnimatePresence mode="wait">
          
          {/* STEP 0: Role Selection */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="flex flex-col gap-6"
            >
              <div>
                <span className="text-[9px] uppercase font-black tracking-widest text-brand-accent flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>{language === 'es' ? 'Paso 0: Rol' : 'Step 0: Role'}</span>
                </span>
                <h2 className="text-xl font-black text-brand-black tracking-tight mt-1 mb-2">
                  {language === 'es' ? '¿Cómo deseas utilizar Towers México?' : 'How do you want to use Towers México?'}
                </h2>
                <p className="text-xs text-brand-gray-500 font-semibold leading-relaxed">
                  {language === 'es' 
                    ? 'Selecciona la opción que mejor te represente para adaptar el panel de administración, contratos y distribución legal.' 
                    : 'Select the option that best represents you to adapt the management panel, contracts and legal distribution.'}
                </p>
              </div>

              <div className="flex flex-col gap-3.5">
                <button
                  type="button"
                  onClick={() => setProfileType('OWNER')}
                  className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 ${
                    profileType === 'OWNER' 
                      ? 'border-brand-accent bg-brand-accent/[0.02] shadow-sm' 
                      : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-accent/5 flex items-center justify-center shrink-0">
                    <User className="w-5 h-5 text-brand-accent" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-black block">
                      {language === 'es' ? 'Soy Propietario' : 'I am an Owner'}
                    </span>
                    <span className="text-[10px] text-brand-gray-500 leading-normal mt-0.5 block">
                      {language === 'es' 
                        ? 'Intercambio o vendo mis propios inmuebles de forma directa y autónoma.' 
                        : 'I exchange or sell my own properties directly and autonomously.'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setProfileType('AGENT')}
                  className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 ${
                    profileType === 'AGENT' 
                      ? 'border-brand-accent bg-brand-accent/[0.02] shadow-sm' 
                      : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-accent/5 flex items-center justify-center shrink-0">
                    <Compass className="w-5 h-5 text-brand-accent" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-black block">
                      {language === 'es' ? 'Soy Asesor / Broker Inmobiliario' : 'I am a Real Estate Advisor / Broker'}
                    </span>
                    <span className="text-[10px] text-brand-gray-500 leading-normal mt-0.5 block">
                      {language === 'es' 
                        ? 'Represento a clientes y comercializo múltiples propiedades inmobiliarias.' 
                        : 'I represent clients and market multiple real estate properties.'}
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setProfileType('PROPERTY_MANAGER')}
                  className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 ${
                    profileType === 'PROPERTY_MANAGER' 
                      ? 'border-brand-accent bg-brand-accent/[0.02] shadow-sm' 
                      : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-brand-accent/5 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-brand-accent" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-brand-black block">
                      {language === 'es' ? 'Soy Administrador de Propiedades' : 'I am a Property Manager'}
                    </span>
                    <span className="text-[10px] text-brand-gray-500 leading-normal mt-0.5 block">
                      {language === 'es' 
                        ? 'Gestiono propiedades de terceros para renta vacacional, renta tradicional o administración patrimonial.' 
                        : 'I manage third-party properties for vacation rental, traditional rental, or asset management.'}
                    </span>
                  </div>
                </button>
              </div>

              {/* Progress and control buttons */}
              <div className="flex justify-end pt-6 border-t border-brand-gray-100 mt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="py-3 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer flex items-center gap-1.5 shadow-premium"
                >
                  <span>{t('onboarding.nextBtn')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-brand-accent" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 1: Cities preferences selection */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="flex flex-col gap-6"
            >
              <div>
                <span className="text-[9px] uppercase font-black tracking-widest text-brand-accent flex items-center gap-1">
                  <Compass className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '8s' }} />
                  <span>{t('onboarding.step1Title')}</span>
                </span>
                <h2 className="text-xl font-black text-brand-black tracking-tight mt-1 mb-2">
                  {language === 'es' ? 'Elige tus destinos soñados' : 'Pick your dream destinations'}
                </h2>
                <p className="text-xs text-brand-gray-500 font-semibold leading-relaxed">
                  {t('onboarding.step1Subtitle')}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {targetCities.map((city) => {
                  const isChecked = selectedCities.includes(city.id);
                  return (
                    <button
                      key={city.id}
                      onClick={() => handleToggleCity(city.id)}
                      className={`relative rounded-2xl border overflow-hidden p-3.5 text-left transition-all cursor-pointer flex flex-col justify-between min-h-[90px] group ${
                        isChecked 
                          ? 'bg-brand-black border-brand-black text-white shadow-premium' 
                          : 'bg-brand-gray-50/50 border-brand-gray-200 text-brand-black hover:bg-brand-gray-50'
                      }`}
                    >
                      <MapPin className={`w-4 h-4 ${isChecked ? 'text-brand-accent' : 'text-brand-gray-400 group-hover:text-brand-black transition-colors'}`} />
                      
                      <div>
                        <p className="text-[10px] font-black leading-none">{city.name.split(',')[0]}</p>
                        <p className={`text-[8px] font-bold uppercase mt-1 tracking-wider leading-none ${isChecked ? 'text-brand-gray-300' : 'text-brand-gray-400'}`}>
                          {city.name.split(',')[1].trim()}
                        </p>
                      </div>

                      {isChecked && (
                        <div className="absolute top-2.5 right-2.5 w-4 h-4 bg-brand-accent rounded-full flex items-center justify-center text-white">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Progress and control buttons */}
              <div className="flex justify-between pt-6 border-t border-brand-gray-100 mt-4">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="py-3 px-6 rounded-full border border-brand-gray-200 hover:bg-brand-gray-50 text-brand-black font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-brand-gray-400" />
                  <span>{t('onboarding.backBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={selectedCities.length === 0}
                  className="py-3 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer flex items-center gap-1.5 shadow-premium disabled:opacity-40"
                >
                  <span>{t('onboarding.nextBtn')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-brand-accent" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Private KYC Document Upload */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="flex flex-col gap-6"
            >
              <div>
                <span className="text-[9px] uppercase font-black tracking-widest text-brand-accent flex items-center gap-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t('onboarding.step2Title')}</span>
                </span>
                <h2 className="text-xl font-black text-brand-black tracking-tight mt-1 mb-2">
                  {language === 'es' ? 'Verificación de Seguridad KYC' : 'KYC Security Audit'}
                </h2>
                <p className="text-xs text-brand-gray-500 font-semibold leading-relaxed">
                  {t('onboarding.step2Subtitle')}
                </p>
              </div>

              {/* Documents are uploaded directly to the private KYC bucket. */}
              <div className="border-2 border-dashed border-brand-gray-200/80 hover:border-brand-black transition-colors rounded-2xl p-6 text-center bg-brand-gray-50/20 relative flex flex-col items-center justify-center min-h-[160px]">
                <input
                  type="file"
                  id="kyc-file-input"
                  className="hidden"
                  onChange={handleKycUpload}
                  accept=".pdf,.jpg,.jpeg,.png"
                />

                {uploading ? (
                  <div className="flex flex-col items-center w-full max-w-xs animate-in fade-in">
                    <div className="w-10 h-10 rounded-full border-4 border-brand-gray-200 border-t-brand-accent animate-spin mb-4" />
                    <p className="text-[10px] font-black uppercase tracking-wider text-brand-gray-500 mb-2">
                      {t('onboarding.kycProgress')}
                    </p>
                    <div className="w-full h-1.5 bg-brand-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-accent transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                    </div>
                  </div>
                ) : fileUploaded ? (
                  <div className="flex flex-col items-center gap-2 animate-in fade-in">
                    <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-2 border border-emerald-100">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <p className="text-xs font-black text-brand-black">
                      {language === 'es' ? 'Documento enviado a revisión' : 'Document submitted for review'}
                    </p>
                    <p className="text-[10px] text-brand-gray-400 font-semibold flex items-center gap-1 mt-0.5">
                      <File className="w-3.5 h-3.5 text-brand-gray-400" />
                      <span>{fileName}</span>
                    </p>
                  </div>
                ) : (
                  <label htmlFor="kyc-file-input" className="cursor-pointer flex flex-col items-center gap-3 w-full">
                    <Upload className="w-8 h-8 text-brand-gray-400" />
                    <p className="text-[10px] text-brand-gray-500 font-bold max-w-sm leading-relaxed">
                      {t('onboarding.kycDropzone')}
                    </p>
                    <span className="px-3.5 py-1.5 bg-brand-black hover:bg-brand-black/90 text-white font-bold text-[9px] uppercase tracking-wider rounded-xl transition-colors shadow-xs">
                      {t('onboarding.kycSelectFile')}
                    </span>
                  </label>
                )}
              </div>

              {uploadError && (
                <p role="alert" className="text-[10px] font-bold text-red-600">
                  {uploadError}
                </p>
              )}

              {fileUploaded && (
                <p className="text-[10px] font-semibold leading-relaxed text-brand-gray-500">
                  {language === 'es'
                    ? 'Tu estado permanecerá PENDIENTE hasta que un administrador revise el documento. La carga no verifica automáticamente tu identidad.'
                    : 'Your status will remain PENDING until an administrator reviews the document. Uploading never verifies your identity automatically.'}
                </p>
              )}

              {/* Controls */}
              <div className="flex justify-between pt-6 border-t border-brand-gray-100 mt-4">
                <button
                  onClick={() => setStep(1)}
                  className="py-3 px-6 rounded-full border border-brand-gray-200 hover:bg-brand-gray-50 text-brand-black font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-brand-gray-400" />
                  <span>{t('onboarding.backBtn')}</span>
                </button>

                <button
                  onClick={() => setStep(3)}
                  disabled={!fileUploaded}
                  className="py-3 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer flex items-center gap-1.5 shadow-premium disabled:opacity-40"
                >
                  <span>{t('onboarding.nextBtn')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-brand-accent" />
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Bio & Avatar choice */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 15 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -15 }}
              className="flex flex-col gap-6"
            >
              <div>
                <span className="text-[9px] uppercase font-black tracking-widest text-brand-accent flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>{t('onboarding.step3Title')}</span>
                </span>
                <h2 className="text-xl font-black text-brand-black tracking-tight mt-1 mb-2">
                  {language === 'es' ? 'Preséntate a la red' : 'Introduce yourself to the network'}
                </h2>
                <p className="text-xs text-brand-gray-500 font-semibold leading-relaxed">
                  {t('onboarding.step3Subtitle')}
                </p>
              </div>

              {/* Bio and Avatar Forms */}
              <div className="flex flex-col gap-4">
                
                {/* Profile photo or deterministic initial */}
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                    {t('profile.avatarLabel')}
                  </label>
                  <ProfilePhotoUploader
                    userId={currentUser.id}
                    name={currentUser.name}
                    value={avatarUrl}
                    onChange={setAvatarUrl}
                    compact
                  />
                </div>

                {/* Introductory Bio */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                    {t('profile.bioLabel')}
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder={t('onboarding.bioPlaceholder')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-black text-xs font-semibold leading-relaxed resize-none"
                  />
                </div>
              </div>

              {uploadError && (
                <p role="alert" className="text-[10px] font-bold text-red-600">
                  {uploadError}
                </p>
              )}

              {/* Controls */}
              <div className="flex justify-between pt-6 border-t border-brand-gray-100 mt-4">
                <button
                  onClick={() => setStep(2)}
                  className="py-3 px-6 rounded-full border border-brand-gray-200 hover:bg-brand-gray-50 text-brand-black font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5 text-brand-gray-400" />
                  <span>{t('onboarding.backBtn')}</span>
                </button>

                <button
                  onClick={handleFinishOnboarding}
                  disabled={!bio || !fileUploaded || finishing}
                  className="py-3 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-colors cursor-pointer flex items-center gap-1.5 shadow-premium disabled:opacity-40"
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-accent animate-pulse" />
                  <span>{finishing
                    ? (language === 'es' ? 'Guardando…' : 'Saving…')
                    : t('onboarding.completeBtn')}</span>
                </button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

      </div>

    </div>
  );
}
