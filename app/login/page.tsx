"use client";

import React, { useState, useEffect } from 'react';
import { useSwap } from '../../lib/context/SwapContext';
import { useTranslation } from '../../lib/context/LanguageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  KeyRound, UserPlus, HelpCircle, ArrowRight, CheckCircle2, 
  AlertTriangle, Mail, Lock, User, Terminal, LogOut
} from 'lucide-react';

import { useSupabase } from '../../lib/services/ServiceFactory';

type TabType = 'login' | 'register' | 'forgot' | 'verify';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isVerifiedParam = searchParams.get('verified') === 'true';
  const { t, language } = useTranslation();
  const { 
    loginMock, registerMock, resetPasswordMock, logoutMock, 
    currentUser, resendVerificationEmail 
  } = useSwap();

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('login');

  // Input Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Validation States
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [isResentSuccess, setIsResentSuccess] = useState(false);

  // UX Verification Flows States
  const [resendCooldown, setResendCooldown] = useState(0);
  const [redirectCountdown, setRedirectCountdown] = useState(5);

  // 1. Restore registered pending verification email on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pendingEmail = localStorage.getItem('auraswap_pending_verification_email');
      if (pendingEmail && !email) {
        setEmail(pendingEmail);
      }
    }
  }, []);

  // 2. Clear pending email from storage once successfully verified
  useEffect(() => {
    if (isVerifiedParam && typeof window !== 'undefined') {
      localStorage.removeItem('auraswap_pending_verification_email');
    }
  }, [isVerifiedParam]);

  // 3. Cooldown timer for email resending
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  // 4. Countdown timer for automatic onboarding redirection on verified success
  useEffect(() => {
    if (isVerifiedParam) {
      if (redirectCountdown > 0) {
        const timer = setTimeout(() => {
          setRedirectCountdown(prev => prev - 1);
        }, 1000);
        return () => clearTimeout(timer);
      } else {
        router.push('/onboarding');
      }
    }
  }, [isVerifiedParam, redirectCountdown, router]);

  // Pre-configured developer quick roles
  const presetUsers = [
    { name: 'Mateo Valenzuela', email: 'admin@auraswap.com', role: 'ADMIN', badge: 'Global Admin', avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80' },
    { name: 'Sofia Alvarez', email: 'host@auraswap.com', role: 'HOST', badge: 'Verified Host', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80' },
    { name: 'Carlos Mendoza', email: 'member@auraswap.com', role: 'MEMBER', badge: 'Active Member', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80' }
  ];

  // Form submission handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setErrorMsg(null);

    setTimeout(async () => {
      try {
        const success = await loginMock(email, password);
        setLoading(false);
        if (success) {
          router.push('/explore');
        }
      } catch (err: any) {
        setLoading(false);
        console.error('[Login] Auth error caught:', err);
        // Specifically detect email not confirmed error from Supabase
        if (
          err.message?.includes('Email not confirmed') || 
          err.message?.includes('confirm') || 
          err.code === 'email_not_confirmed'
        ) {
          setErrorMsg(t('auth.errorEmailNotConfirmed'));
        } else {
          setErrorMsg(t('auth.errorInvalidCreds'));
        }
      }
    }, 600);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name || !regPassword || !confirmPassword) return;
    setErrorMsg(null);

    if (regPassword.length < 6) {
      setErrorMsg(language === 'es' ? 'La contraseña debe tener al menos 6 caracteres.' : 'Password must be at least 6 characters.');
      return;
    }

    if (regPassword !== confirmPassword) {
      setErrorMsg(language === 'es' ? 'Las contraseñas no coinciden.' : 'Passwords do not match.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    setTimeout(async () => {
      try {
        await registerMock(email, name, regPassword);
        setLoading(false);
        if (useSupabase) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('auraswap_pending_verification_email', email);
          }
          setActiveTab('verify'); // Switch to beautiful verification screen!
        } else {
          router.push('/onboarding'); // Staging mock bypasses email checks
        }
      } catch (err: any) {
        setLoading(false);
        setErrorMsg(err.message || 'Error en el registro');
      }
    }, 650);
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setErrorMsg(null);

    setTimeout(async () => {
      try {
        await resetPasswordMock(email);
        setLoading(false);
        setForgotSuccess(true);
      } catch (err: any) {
        setLoading(false);
        setErrorMsg(err.message || 'Error al enviar');
      }
    }, 600);
  };

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      await resendVerificationEmail(email);
      setLoading(false);
      setIsResentSuccess(true);
      setResendCooldown(60); // 60s cooldown trigger
      setTimeout(() => setIsResentSuccess(false), 5000);
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Error al reenviar');
    }
  };

  const handleQuickSwitch = async (emailAddr: string) => {
    setLoading(true);
    setErrorMsg(null);
    setForgotSuccess(false);
    
    setTimeout(async () => {
      try {
        await loginMock(emailAddr, 'password');
        setLoading(false);
        router.push('/explore');
      } catch (err) {
        // Fallback for mock switches if offline
        setLoading(false);
        router.push('/explore');
      }
    }, 300);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch w-full max-w-5xl">
      
      {/* LEFT COLUMN: Premium Auth Console Card */}
      <div className="lg:col-span-7 bg-white border border-brand-gray-200/80 rounded-3xl p-6 sm:p-8 shadow-floating flex flex-col justify-between relative overflow-hidden">
        <div className="absolute -top-10 -left-10 w-24 h-24 rounded-full bg-brand-accent/5 filter blur-lg pointer-events-none" />
        
        <div>
          {/* Header Tabs (Hidden in verified success view and verify email view) */}
          {!isVerifiedParam && activeTab !== 'verify' && (
            <div className="flex items-center gap-1.5 p-1 bg-brand-gray-50 border border-brand-gray-200/50 rounded-2xl mb-8 select-none">
              <button
                onClick={() => { setActiveTab('login'); setErrorMsg(null); setForgotSuccess(false); }}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'login'
                    ? 'bg-brand-black text-white shadow-premium'
                    : 'text-brand-gray-500 hover:text-brand-black'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{language === 'es' ? 'Ingresar' : 'Log In'}</span>
              </button>

              <button
                onClick={() => { setActiveTab('register'); setErrorMsg(null); setForgotSuccess(false); }}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'register'
                    ? 'bg-brand-black text-white shadow-premium'
                    : 'text-brand-gray-500 hover:text-brand-black'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{language === 'es' ? 'Registrarse' : 'Sign Up'}</span>
              </button>

              <button
                onClick={() => { setActiveTab('forgot'); setErrorMsg(null); setForgotSuccess(false); }}
                className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'forgot'
                    ? 'bg-brand-black text-white shadow-premium'
                    : 'text-brand-gray-500 hover:text-brand-black'
                }`}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>{language === 'es' ? 'Recuperar' : 'Recovery'}</span>
              </button>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* EMAIL VERIFIED SUCCESS VIEW */}
            {isVerifiedParam ? (
              <motion.div
                key="verified-success-tab"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col gap-6 py-4 text-center select-none"
              >
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm mx-auto mb-2">
                  <CheckCircle2 className="w-9 h-9 animate-pulse" />
                </div>

                <div>
                  <h2 className="text-2xl font-black text-brand-black tracking-tight mb-2">
                    {t('auth.verifiedSuccessTitle')}
                  </h2>
                  <p className="text-xs text-brand-gray-500 leading-relaxed font-semibold max-w-sm mx-auto">
                    {t('auth.verifiedSuccessDesc')}
                  </p>

                  {/* Premium Countdown Alert Banner */}
                  <div className="mt-5 p-3.5 bg-brand-accent/5 border border-brand-accent/10 rounded-2xl text-[11px] font-bold text-brand-accent flex items-center justify-center gap-2 animate-pulse max-w-sm mx-auto">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-ping" />
                    <span>
                      {t('auth.redirectingText', { seconds: redirectCountdown })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => router.push('/onboarding')}
                  className="w-full py-3.5 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-premium mt-4 cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{t('auth.verifiedSuccessBtn')}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-brand-accent" />
                </button>
              </motion.div>
            ) : activeTab === 'verify' ? (
              /* EMAIL VERIFICATION SENT VIEW */
              <motion.div
                key="verify-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-5 select-none"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent mb-2">
                  <Mail className="w-6 h-6 animate-bounce" />
                </div>

                <div>
                  <h2 className="text-xl font-black text-brand-black tracking-tight leading-none mb-2">
                    {t('auth.verifyEmailTitle')}
                  </h2>
                  <p className="text-xs text-brand-gray-400 font-semibold">
                    {t('auth.verifyEmailSubtitle')}
                  </p>
                </div>

                {isResentSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-250 rounded-2xl text-[11px] font-bold text-emerald-600 flex items-center gap-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{t('auth.verifyEmailResendSuccess')}</span>
                  </div>
                )}

                {errorMsg && (
                  <div className="p-3.5 bg-rose-50 border border-rose-250 rounded-2xl text-[11px] font-bold text-rose-600 flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <p className="text-xs text-brand-gray-500 leading-relaxed font-semibold">
                  {t('auth.verifyEmailDesc').replace('{email}', email)}
                </p>

                <div className="flex flex-col gap-3 mt-4">
                  <button
                    onClick={handleResend}
                    disabled={loading || resendCooldown > 0}
                    className="w-full py-3.5 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-premium cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-brand-gray-200 border-t-white animate-spin" />
                    ) : (
                      <>
                        <span>
                          {resendCooldown > 0 
                            ? (language === 'es' ? `Reenviar en ${resendCooldown}s` : `Resend in ${resendCooldown}s`)
                            : t('auth.verifyEmailResendBtn')
                          }
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-brand-accent" />
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => { setActiveTab('login'); setErrorMsg(null); }}
                    className="w-full py-3.5 px-6 rounded-full border border-brand-gray-200 hover:bg-brand-gray-50 text-brand-black font-bold text-xs tracking-wider uppercase transition-all cursor-pointer text-center"
                  >
                    {t('auth.backToLogin')}
                  </button>
                </div>
              </motion.div>
            ) : activeTab === 'login' ? (
              /* LOGIN VIEW */
              <motion.div
                key="login-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-5"
              >
                <div>
                  <h2 className="text-xl font-black text-brand-black tracking-tight leading-none mb-2">
                    {t('auth.loginTitle')}
                  </h2>
                  <p className="text-xs text-brand-gray-400 font-semibold">
                    {t('auth.loginSubtitle')}
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-[11px] font-bold text-rose-600 flex flex-col gap-2">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{errorMsg}</span>
                    </div>
                    {errorMsg === t('auth.errorEmailNotConfirmed') && (
                      <button
                        type="button"
                        onClick={() => { setActiveTab('verify'); setErrorMsg(null); }}
                        className="text-[10px] text-brand-accent hover:underline text-left pl-6.5 font-extrabold cursor-pointer"
                      >
                        {language === 'es' ? 'Ir a la pantalla de reenvío de correo →' : 'Go to email resend screen →'}
                      </button>
                    )}
                  </div>
                )}

                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('auth.emailLabel')}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('auth.emailPlaceholder')}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-gray-200/80 focus:outline-none focus:border-brand-black text-xs font-semibold bg-brand-gray-50/30"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                        {t('auth.passwordLabel')}
                      </label>
                      <button
                        type="button"
                        onClick={() => setActiveTab('forgot')}
                        className="text-[10px] font-black text-brand-accent hover:underline cursor-pointer"
                      >
                        {t('auth.forgotTrigger')}
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('auth.passwordPlaceholder')}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-gray-200/80 focus:outline-none focus:border-brand-black text-xs font-semibold bg-brand-gray-50/30"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-premium mt-2 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {loading ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-brand-gray-200 border-t-white animate-spin" />
                    ) : (
                      <>
                        <span>{t('auth.loginBtn')}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-brand-accent" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : activeTab === 'register' ? (
              /* REGISTER VIEW */
              <motion.div
                key="register-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-5"
              >
                <div>
                  <h2 className="text-xl font-black text-brand-black tracking-tight leading-none mb-2">
                    {t('auth.signupTitle')}
                  </h2>
                  <p className="text-xs text-brand-gray-400 font-semibold">
                    {t('auth.signupSubtitle')}
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3.5 bg-rose-50 border border-rose-250 rounded-2xl text-[11px] font-bold text-rose-600 flex items-start gap-2.5 animate-in fade-in">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleRegister} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('auth.nameLabel')}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('auth.namePlaceholder')}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-gray-200/80 focus:outline-none focus:border-brand-black text-xs font-semibold bg-brand-gray-50/30"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('auth.emailLabel')}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('auth.emailPlaceholder')}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-gray-200/80 focus:outline-none focus:border-brand-black text-xs font-semibold bg-brand-gray-50/30"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('auth.passwordLabel')}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder={t('auth.passwordPlaceholder')}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-gray-200/80 focus:outline-none focus:border-brand-black text-xs font-semibold bg-brand-gray-50/30"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {language === 'es' ? 'Confirmar Contraseña' : 'Confirm Password'}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={language === 'es' ? 'Repite tu contraseña' : 'Repeat your password'}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-gray-200/80 focus:outline-none focus:border-brand-black text-xs font-semibold bg-brand-gray-50/30"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-premium mt-2 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
                  >
                    {loading ? (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-brand-gray-200 border-t-white animate-spin" />
                    ) : (
                      <>
                        <span>{t('auth.signupBtn')}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-brand-accent" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            ) : (
              /* FORGOT PASSWORD VIEW */
              <motion.div
                key="forgot-tab"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-5"
              >
                <div>
                  <h2 className="text-xl font-black text-brand-black tracking-tight leading-none mb-2">
                    {t('auth.forgotTitle')}
                  </h2>
                  <p className="text-xs text-brand-gray-400 font-semibold">
                    {t('auth.forgotSubtitle')}
                  </p>
                </div>

                {forgotSuccess ? (
                  <div className="p-5 bg-emerald-50 border border-emerald-250 rounded-2xl flex flex-col gap-3 shadow-xs text-left animate-in fade-in">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      <span className="text-xs font-black uppercase tracking-wider">{t('auth.forgotSuccessTitle')}</span>
                    </div>
                    <p className="text-[11px] font-semibold text-brand-gray-650 leading-relaxed">
                      {t('auth.forgotSuccessDesc')}
                    </p>
                    <button
                      onClick={() => { setForgotSuccess(false); setActiveTab('login'); }}
                      className="py-2.5 px-4 bg-brand-black hover:bg-brand-black/90 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-xs self-start"
                    >
                      {t('auth.backToLogin')}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleForgot} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                        {t('auth.emailLabel')}
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t('auth.emailPlaceholder')}
                          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-brand-gray-200/80 focus:outline-none focus:border-brand-black text-xs font-semibold bg-brand-gray-50/30"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 px-6 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-all shadow-premium mt-2 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      {loading ? (
                        <div className="w-3.5 h-3.5 rounded-full border-2 border-brand-gray-200 border-t-white animate-spin" />
                      ) : (
                        <>
                          <span>{t('auth.recoverBtn')}</span>
                          <ArrowRight className="w-3.5 h-3.5 text-brand-accent" />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="border-t border-brand-gray-100 pt-5 mt-8 flex justify-between items-center text-[10px] font-bold text-brand-gray-400 select-none">
          <span>AuraSwap Network</span>
          <span>Secured Live Session</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Developer Testing Dashboard */}
      <div className="lg:col-span-5 flex flex-col gap-6">
        <div className="bg-brand-black border border-brand-gray-800 rounded-3xl p-6 shadow-floating text-white relative overflow-hidden flex-1 flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full bg-brand-accent/5 filter blur-lg pointer-events-none" />
          
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent">
                <Terminal className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[8px] font-black uppercase tracking-wider text-brand-accent leading-none">Developer Console</span>
                <h3 className="text-xs font-black tracking-tight leading-none mt-0.5">
                  {t('auth.quickSwapTitle')}
                </h3>
              </div>
            </div>

            <p className="text-[10px] text-brand-gray-400 font-semibold leading-relaxed mb-6">
              {t('auth.quickSwapDesc')}
            </p>

            {/* Roles swappers grid */}
            <div className="flex flex-col gap-3">
              {presetUsers.map((preset) => (
                <button
                  key={preset.email}
                  onClick={() => handleQuickSwitch(preset.email)}
                  className="w-full p-3 rounded-2xl bg-brand-gray-900/60 hover:bg-brand-gray-900 border border-brand-gray-800 hover:border-brand-gray-700 text-left transition-all flex items-center justify-between gap-3 cursor-pointer text-xs group"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={preset.avatar}
                      alt={preset.name}
                      className="w-8 h-8 rounded-full object-cover border border-brand-gray-800 group-hover:border-brand-accent/50 shrink-0"
                    />
                    <div>
                      <p className="font-extrabold text-white group-hover:text-brand-accent transition-colors">{preset.name}</p>
                      <p className="text-[9px] text-brand-gray-500 font-bold uppercase mt-0.5 tracking-wider">{preset.email}</p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase shrink-0 ${
                    preset.role === 'ADMIN' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                    preset.role === 'HOST' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                    'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {preset.badge}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {currentUser && (
            <div className="mt-8 pt-5 border-t border-brand-gray-800 flex items-center justify-between gap-4 animate-in fade-in select-none">
              <div className="flex items-center gap-2">
                <img src={currentUser.avatar} className="w-7 h-7 rounded-full object-cover border border-brand-gray-800" />
                <div className="text-[10px]">
                  <p className="font-extrabold text-white leading-none">{currentUser.name}</p>
                  <p className="text-[8px] text-brand-gray-500 uppercase font-black tracking-wider mt-0.5 leading-none">{currentUser.role}</p>
                </div>
              </div>

              <button
                onClick={() => logoutMock()}
                className="px-3 py-1.5 rounded-lg border border-brand-rose/25 bg-brand-rose/5 hover:bg-brand-rose/10 text-[9px] font-black uppercase tracking-wider text-brand-rose transition-colors cursor-pointer flex items-center gap-1 shrink-0"
              >
                <LogOut className="w-3 h-3" />
                <span>{language === 'es' ? 'Salir' : 'Logout'}</span>
              </button>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-12 md:px-24 py-12 relative min-h-[85vh] flex items-center justify-center">
      
      {/* Ambient background glows */}
      <div className="absolute top-1/4 right-10 w-96 h-96 rounded-full bg-brand-accent/5 filter blur-3xl pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '6s' }} />
      <div className="absolute bottom-1/4 left-10 w-96 h-96 rounded-full bg-brand-rose/5 filter blur-3xl pointer-events-none -z-10 animate-pulse" style={{ animationDuration: '8s' }} />

      <React.Suspense fallback={<div className="w-8 h-8 rounded-full border-4 border-brand-gray-205 border-t-brand-accent animate-spin mx-auto" />}>
        <LoginForm />
      </React.Suspense>
    </div>
  );
}
