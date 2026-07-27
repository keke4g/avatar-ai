"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export default function AuthRecoveryRedirect() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === '/reset-password') return;

    const hash = window.location.hash;
    const params = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    if (params.get('type') !== 'recovery') return;

    window.location.replace(`/reset-password${hash}`);
  }, [pathname]);

  return null;
}
