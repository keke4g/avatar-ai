'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, LoaderCircle, TriangleAlert } from 'lucide-react';
import { supabase } from '../../../lib/supabaseClient';

const safeRelativePath = (value: string | null): string => {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/explore';
  return value;
};

export default function GoogleAuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    let active = true;

    const finishSignIn = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const next = safeRelativePath(params.get('next'));
      const providerError = params.get('error_description') || params.get('error');

      if (providerError) {
        console.error('[Google Auth] Provider callback failed:', providerError);
        if (active) setStatus('error');
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('[Google Auth] Code exchange failed:', error.message);
          if (active) setStatus('error');
          return;
        }
      } else {
        // A session may already exist when returning from an older deployment
        // that still handled OAuth URLs automatically. Accept that valid state
        // instead of showing a false callback error.
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          if (active) setStatus('error');
          return;
        }
      }

      // A Google login can link to an older email/password account. In that
      // case the auth identity has Google's correct name, while the existing
      // public profile may still contain a stale value. The RPC only updates
      // profiles whose Google identity is newer than their last profile edit.
      const { error: profileSyncError } = await supabase.rpc('sync_google_profile_identity');
      if (profileSyncError) {
        // Profile synchronization must not invalidate an otherwise successful
        // authentication. Older deployments may briefly run before the
        // accompanying migration is available.
        console.warn('[Google Auth] Unable to synchronize Google profile name:', profileSyncError.message);
      }

      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { Browser } = await import('@capacitor/browser');
          await Browser.close().catch(() => undefined);
        }
      } catch {
        // Browser.close is only available inside the Android container.
      }

      if (!active) return;
      setStatus('success');
      // Reload the application shell so SwapContext reads the synchronized
      // profile instead of retaining the pre-sync value from SIGNED_IN.
      window.setTimeout(() => window.location.replace(next), 350);
    };

    finishSignIn().catch((error) => {
      console.error('[Google Auth] Unexpected callback failure:', error);
      if (active) setStatus('error');
    });

    return () => {
      active = false;
    };
  }, [router]);

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-112px)] w-full max-w-xl items-center justify-center px-5 py-12">
      <section className="w-full rounded-[30px] border border-brand-gray-200 bg-white p-8 text-center shadow-[0_28px_80px_rgba(15,23,42,0.12)]">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gray-50">
          {status === 'loading' && <LoaderCircle className="h-7 w-7 animate-spin text-brand-accent" />}
          {status === 'success' && <CheckCircle2 className="h-7 w-7 text-emerald-600" />}
          {status === 'error' && <TriangleAlert className="h-7 w-7 text-rose-600" />}
        </div>
        <h1 className="text-2xl font-black tracking-tight text-brand-black">
          {status === 'loading' && 'Conectando tu cuenta'}
          {status === 'success' && 'Acceso completado'}
          {status === 'error' && 'No pudimos iniciar sesión'}
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm font-semibold leading-relaxed text-brand-gray-500">
          {status === 'loading' && 'Estamos terminando el acceso seguro con Google.'}
          {status === 'success' && 'Tu cuenta está lista. Te llevaremos a Towers México.'}
          {status === 'error' && 'Regresa al inicio de sesión e inténtalo nuevamente.'}
        </p>
        {status === 'error' && (
          <button
            type="button"
            onClick={() => router.replace('/login?oauthError=callback')}
            className="mt-6 min-h-12 rounded-2xl bg-brand-black px-6 text-xs font-black uppercase tracking-wider text-white"
          >
            Volver al inicio de sesión
          </button>
        )}
      </section>
    </main>
  );
}
