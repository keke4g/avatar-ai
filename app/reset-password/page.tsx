"use client";

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { useTranslation } from '../../lib/context/LanguageContext';

type RecoveryState = 'verifying' | 'ready' | 'invalid' | 'saving';

const hasRecoveryHint = (): boolean => {
  if (typeof window === 'undefined') return false;

  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const searchParams = new URLSearchParams(window.location.search);
  return hashParams.get('type') === 'recovery'
    || searchParams.get('type') === 'recovery'
    || searchParams.has('code');
};

export default function ResetPasswordPage() {
  const router = useRouter();
  const { language } = useTranslation();
  const isSpanish = language === 'es';
  const recoveryLanguage = useRef(language);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>('verifying');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let recoveryConfirmed = false;
    const recoveryHint = hasRecoveryHint();
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const authError = hashParams.get('error_description');

    if (authError) {
      setErrorMessage(
        recoveryLanguage.current === 'es'
          ? 'El enlace de recuperación expiró o ya fue utilizado.'
          : 'The recovery link has expired or has already been used.',
      );
      setRecoveryState('invalid');
      return;
    }

    const markReady = () => {
      if (!active) return;
      recoveryConfirmed = true;
      setErrorMessage(null);
      setRecoveryState('ready');
    };

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        markReady();
        return;
      }

      if (recoveryHint && session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
        markReady();
      }
    });

    const verifySession = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (!active) return;

      if (!error && recoveryHint && data.session) {
        markReady();
        return;
      }

      const code = new URLSearchParams(window.location.search).get('code');
      if (code && !data.session) {
        const exchange = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        if (!exchange.error && exchange.data.session) {
          markReady();
        }
      }
    };

    void verifySession();

    const verificationTimeout = window.setTimeout(() => {
      if (!active || recoveryConfirmed) return;
      setErrorMessage(
        recoveryLanguage.current === 'es'
          ? 'Este enlace no es válido o ya expiró. Solicita uno nuevo para continuar.'
          : 'This link is invalid or has expired. Request a new one to continue.',
      );
      setRecoveryState('invalid');
    }, 5000);

    return () => {
      active = false;
      window.clearTimeout(verificationTimeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage(
        isSpanish
          ? 'La nueva contraseña debe tener al menos 8 caracteres.'
          : 'Your new password must contain at least 8 characters.',
      );
      return;
    }

    if (password !== confirmation) {
      setErrorMessage(isSpanish ? 'Las contraseñas no coinciden.' : 'Passwords do not match.');
      return;
    }

    setRecoveryState('saving');
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage(
        isSpanish
          ? `No fue posible actualizar la contraseña: ${error.message}`
          : `Unable to update your password: ${error.message}`,
      );
      setRecoveryState('ready');
      return;
    }

    await supabase.auth.signOut();
    router.replace('/login?passwordReset=true');
  };

  return (
    <div className="relative mx-auto flex min-h-[calc(100vh-10rem)] w-full max-w-6xl items-center justify-center overflow-hidden px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute left-[10%] top-[15%] h-64 w-64 rounded-full bg-brand-accent/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[10%] right-[8%] h-56 w-56 rounded-full bg-violet-200/20 blur-3xl" />

      <section className="relative w-full max-w-[540px] overflow-hidden rounded-[30px] border border-brand-gray-200/80 bg-white/95 p-6 shadow-[0_32px_90px_-38px_rgba(15,23,42,0.32)] backdrop-blur-xl sm:p-9">
        <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-brand-accent to-transparent" />

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-black text-white shadow-premium">
            <KeyRound className="h-5 w-5 text-brand-accent" aria-hidden="true" />
          </div>
          <div>
            <div className="mb-1.5 inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-brand-accent">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {isSpanish ? 'Recuperación segura' : 'Secure recovery'}
            </div>
            <h1 className="text-2xl font-black tracking-[-0.035em] text-brand-black sm:text-[30px]">
              {isSpanish ? 'Crea una nueva contraseña' : 'Create a new password'}
            </h1>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-brand-gray-500">
              {isSpanish
                ? 'Elige una contraseña diferente a la anterior para proteger tu cuenta.'
                : 'Choose a password different from your previous one to protect your account.'}
            </p>
          </div>
        </div>

        {recoveryState === 'verifying' ? (
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-brand-gray-200 bg-brand-gray-50/80 p-4">
            <LoaderCircle className="h-5 w-5 animate-spin text-brand-accent" aria-hidden="true" />
            <div>
              <p className="text-xs font-black text-brand-black">
                {isSpanish ? 'Validando el enlace' : 'Validating your link'}
              </p>
              <p className="mt-0.5 text-[10px] font-semibold text-brand-gray-500">
                {isSpanish ? 'Esto tomará solo unos segundos.' : 'This will only take a few seconds.'}
              </p>
            </div>
          </div>
        ) : recoveryState === 'invalid' ? (
          <div className="mt-8">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="text-xs font-bold leading-relaxed">{errorMessage}</p>
              </div>
            </div>
            <Link
              href="/login?mode=forgot"
              className="mt-5 inline-flex min-h-[50px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-black px-5 text-xs font-black uppercase tracking-wider text-white transition hover:bg-brand-black/90"
            >
              {isSpanish ? 'Solicitar un enlace nuevo' : 'Request a new link'}
              <ArrowRight className="h-4 w-4 text-brand-accent" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="new-password" className="text-[10px] font-black uppercase tracking-wider text-brand-black">
                {isSpanish ? 'Nueva contraseña' : 'New password'}
              </label>
              <div className="relative mt-1.5">
                <LockKeyhole className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray-400" aria-hidden="true" />
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                  className="h-[54px] w-full rounded-2xl border border-brand-gray-200 bg-brand-gray-50/50 pl-11 pr-12 text-sm font-semibold outline-none transition focus:border-brand-accent focus:bg-white focus:ring-4 focus:ring-brand-accent/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={isSpanish ? 'Mostrar u ocultar contraseña' : 'Show or hide password'}
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-brand-gray-400 transition hover:bg-white hover:text-brand-black"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-1.5 text-[10px] font-semibold text-brand-gray-400">
                {isSpanish ? 'Mínimo 8 caracteres.' : 'At least 8 characters.'}
              </p>
            </div>

            <div>
              <label htmlFor="confirm-password" className="text-[10px] font-black uppercase tracking-wider text-brand-black">
                {isSpanish ? 'Confirma la contraseña' : 'Confirm password'}
              </label>
              <div className="relative mt-1.5">
                <Check className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-gray-400" aria-hidden="true" />
                <input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  minLength={8}
                  required
                  autoComplete="new-password"
                  className="h-[54px] w-full rounded-2xl border border-brand-gray-200 bg-brand-gray-50/50 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-brand-accent focus:bg-white focus:ring-4 focus:ring-brand-accent/10"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-[11px] font-bold leading-relaxed text-rose-700">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={recoveryState === 'saving'}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-brand-black px-6 text-xs font-black uppercase tracking-wider text-white shadow-[0_16px_34px_rgba(9,9,11,0.18)] transition hover:-translate-y-0.5 hover:bg-brand-black/90 disabled:cursor-wait disabled:opacity-60"
            >
              {recoveryState === 'saving' ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  {isSpanish ? 'Guardando…' : 'Saving…'}
                </>
              ) : (
                <>
                  {isSpanish ? 'Guardar nueva contraseña' : 'Save new password'}
                  <ArrowRight className="h-4 w-4 text-brand-accent" aria-hidden="true" />
                </>
              )}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
