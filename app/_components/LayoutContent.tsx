"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import AuthRecoveryRedirect from "@/components/AuthRecoveryRedirect";
import DebugOverlay from "@/components/DebugOverlay";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { useLayoutContext } from "@/lib/context/LayoutContext";

const EternaConcierge = dynamic(
  () => import("@/features/eterna/components/EternaConcierge"),
  { ssr: false },
);

export default function LayoutContent({ children }: { children: ReactNode }) {
  const { hideHeader, hideFooter } = useLayoutContext();
  const pathname = usePathname();
  const hideEterna = pathname.startsWith('/appointments');

  return (
    <div className="flex min-h-screen flex-col">
      <AuthRecoveryRedirect />
      {!hideHeader && <Navbar />}
      {!hideEterna && <EternaConcierge />}
      <Suspense fallback={null}>
        <DebugOverlay />
      </Suspense>
      <main className={`flex-grow ${hideHeader ? "" : "pb-16 pt-24"}`}>
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
