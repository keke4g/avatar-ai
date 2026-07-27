"use client";

import React, { useState, useEffect } from 'react';
import { useSwap } from '../../lib/context/SwapContext';
import { useTranslation } from '../../lib/context/LanguageContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  KeyRound, UserPlus, HelpCircle, ArrowRight, CheckCircle2, 
  AlertTriangle, Mail, Lock, User, ShieldCheck
} from 'lucide-react';

import { useSupabase } from '../../lib/services/ServiceFactory';

type TabType = 'login' | 'register' | 'forgot' | 'verify';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isVerifiedParam = searchParams.get('verified') === 'true';
  const isPasswordResetParam = searchParams.get('passwordReset') === 'true';
  const requestedMode = searchParams.get('mode');
  const { t, language } = useTranslation();
  const { 
    loginMock, registerMock, resetPasswordMock, resendVerificationEmail
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

  useEffect(() => {
    if (requestedMode === 'forgot') {
      setActiveTab('forgot');
      setForgotSuccess(false);
      setErrorMsg(null);
    }
  }, [requestedMode]);

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

  return (
    <div className="w-full max-w-[620px]">
      <div className="relative flex flex-col justify-between overflow-hidden rounded-[28px] border border-brand-gray-200/80 bg-white/95 p-5 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:rounded-[34px] sm:p-8 md:p-10">
        <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-brand-accent/70 to-transparent" />
        <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-brand-accent/8 blur-3xl" />
        
        <div>
          {/* Header Tabs (Hidden in verified success view and verify email view) */}
          {!isVerifiedParam && activeTab !== 'verify' && (
            <div className="mb-7 grid grid-cols-3 gap-1 rounded-2xl border border-brand-gray-200/60 bg-brand-gray-50/80 p-1 select-none sm:mb-9 sm:gap-1.5">
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setErrorMsg(null); setForgotSuccess(false); }}
                className={`flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 text-[9px] font-black uppercase tracking-[0.08em] transition-all cursor-pointer sm:gap-1.5 sm:text-[10px] sm:tracking-wider ${
                  activeTab === 'login'
                    ? 'bg-brand-black text-white shadow-premium'
                    : 'text-brand-gray-500 hover:text-brand-black'
                }`}
              >
                <KeyRound className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{language === 'es' ? 'Ingresar' : 'Log In'}</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('register'); setErrorMsg(null); setForgotSuccess(false); }}
                className={`flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 text-[9px] font-black uppercase tracking-[0.08em] transition-all cursor-pointer sm:gap-1.5 sm:text-[10px] sm:tracking-wider ${
                  activeTab === 'register'
                    ? 'bg-brand-black text-white shadow-premium'
                    : 'text-brand-gray-500 hover:text-brand-black'
                }`}
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{language === 'es' ? 'Registrarse' : 'Sign Up'}</span>
              </button>

              <button
                type="button"
                onClick={() => { setActiveTab('forgot'); setErrorMsg(null); setForgotSuccess(false); }}
                className={`flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-xl px-1 text-[9px] font-black uppercase tracking-[0.08em] transition-all cursor-pointer sm:gap-1.5 sm:text-[10px] sm:tracking-wider ${
                  activeTab === 'forgot'
                    ? 'bg-brand-black text-white shadow-premium'
                    : 'text-brand-gray-500 hover:text-brand-black'
                }`}
              >
                <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{language === 'es' ? 'Recuperar' : 'Recovery'}</span>
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
                className="flex flex-col gap-6"
              >
                <div>
                  <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                    <ShieldCheck className="h-3 w-3" />
                    <span>{language === 'es' ? 'Acceso protegido' : 'Protected access'}</span>
                  </div>
                  <h2 className="mb-2 text-2xl font-black leading-tight tracking-tight text-brand-black sm:text-[28px]">
                    {t('auth.loginTitle')}
                  </h2>
                  <p className="max-w-md text-xs font-semibold leading-relaxed text-brand-gray-500 sm:text-[13px]">
                    {t('auth.loginSubtitle')}
                  </p>
                </div>

                {isPasswordResetParam && (
                  <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-[11px] font-bold leading-relaxed text-emerald-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {language === 'es'
                        ? 'Tu contraseña fue actualizada. Ya puedes iniciar sesión con la nueva.'
                        : 'Your password was updated. You can now sign in with your new password.'}
                    </span>
                  </div>
                )}

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

                <form onSubmit={handleLogin} className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="login-email" className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('auth.emailLabel')}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="login-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('auth.emailPlaceholder')}
                        autoComplete="email"
                        className="h-[52px] w-full rounded-2xl border border-brand-gray-200/90 bg-brand-gray-50/40 pl-11 pr-4 text-sm font-semibold transition-all placeholder:text-brand-gray-400 focus:border-brand-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-accent/10"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <label htmlFor="login-password" className="text-[10px] font-black text-brand-black uppercase tracking-wider">
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
                        id="login-password"
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder={t('auth.passwordPlaceholder')}
                        autoComplete="current-password"
                        className="h-[52px] w-full rounded-2xl border border-brand-gray-200/90 bg-brand-gray-50/40 pl-11 pr-4 text-sm font-semibold transition-all placeholder:text-brand-gray-400 focus:border-brand-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-accent/10"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-1 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-black px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_14px_30px_rgba(9,9,11,0.18)] transition-all hover:-translate-y-0.5 hover:bg-brand-black/90 hover:shadow-[0_18px_34px_rgba(9,9,11,0.24)] active:translate-y-0 cursor-pointer disabled:opacity-40"
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
                    <label htmlFor="register-name" className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('auth.nameLabel')}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="register-name"
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('auth.namePlaceholder')}
                        autoComplete="name"
                        className="h-[52px] w-full rounded-2xl border border-brand-gray-200/90 bg-brand-gray-50/40 pl-11 pr-4 text-sm font-semibold transition-all placeholder:text-brand-gray-400 focus:border-brand-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-accent/10"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="register-email" className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('auth.emailLabel')}
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="register-email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('auth.emailPlaceholder')}
                        autoComplete="email"
                        className="h-[52px] w-full rounded-2xl border border-brand-gray-200/90 bg-brand-gray-50/40 pl-11 pr-4 text-sm font-semibold transition-all placeholder:text-brand-gray-400 focus:border-brand-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-accent/10"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="register-password" className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {t('auth.passwordLabel')}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="register-password"
                        type="password"
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder={t('auth.passwordPlaceholder')}
                        autoComplete="new-password"
                        className="h-[52px] w-full rounded-2xl border border-brand-gray-200/90 bg-brand-gray-50/40 pl-11 pr-4 text-sm font-semibold transition-all placeholder:text-brand-gray-400 focus:border-brand-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-accent/10"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="register-password-confirmation" className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                      {language === 'es' ? 'Confirmar Contraseña' : 'Confirm Password'}
                    </label>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        id="register-password-confirmation"
                        type="password"
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={language === 'es' ? 'Repite tu contraseña' : 'Repeat your password'}
                        autoComplete="new-password"
                        className="h-[52px] w-full rounded-2xl border border-brand-gray-200/90 bg-brand-gray-50/40 pl-11 pr-4 text-sm font-semibold transition-all placeholder:text-brand-gray-400 focus:border-brand-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-accent/10"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="mt-1 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-black px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_14px_30px_rgba(9,9,11,0.18)] transition-all hover:-translate-y-0.5 hover:bg-brand-black/90 active:translate-y-0 cursor-pointer disabled:opacity-40"
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
                      <label htmlFor="recovery-email" className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                        {t('auth.emailLabel')}
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-brand-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          id="recovery-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t('auth.emailPlaceholder')}
                          autoComplete="email"
                          className="h-[52px] w-full rounded-2xl border border-brand-gray-200/90 bg-brand-gray-50/40 pl-11 pr-4 text-sm font-semibold transition-all placeholder:text-brand-gray-400 focus:border-brand-accent focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-accent/10"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="mt-1 flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-black px-6 py-3.5 text-xs font-bold uppercase tracking-wider text-white shadow-[0_14px_30px_rgba(9,9,11,0.18)] transition-all hover:-translate-y-0.5 hover:bg-brand-black/90 active:translate-y-0 cursor-pointer disabled:opacity-40"
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

        <div className="mt-8 flex flex-col items-center justify-between gap-2 border-t border-brand-gray-100 pt-5 text-center text-[9px] font-bold uppercase tracking-[0.12em] text-brand-gray-400 select-none min-[420px]:flex-row min-[420px]:text-left">
          <span>AuraSwap Network</span>
          <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
            <Lock className="h-3 w-3" />
            {language === 'es' ? 'Sesión cifrada y protegida' : 'Encrypted and protected session'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="relative mx-auto flex min-h-[calc(100dvh-112px)] max-w-7xl items-center justify-center overflow-hidden px-4 py-8 pb-28 sm:px-8 sm:py-12 sm:pb-24 lg:px-12">
      
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -right-24 top-10 -z-10 h-80 w-80 rounded-full bg-brand-accent/6 blur-3xl sm:h-[420px] sm:w-[420px]" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 -z-10 h-80 w-80 rounded-full bg-emerald-100/40 blur-3xl sm:h-[420px] sm:w-[420px]" />
      <div className="pointer-events-none absolute inset-x-6 top-1/2 -z-10 h-px bg-gradient-to-r from-transparent via-brand-gray-200/70 to-transparent" />

      <React.Suspense fallback={<div className="w-8 h-8 rounded-full border-4 border-brand-gray-205 border-t-brand-accent animate-spin mx-auto" />}>
        <LoginForm />
      </React.Suspense>
    </main>
  );
}
