"use client";
import React from "react";
import { useLayoutContext } from "../lib/context/LayoutContext";
import Navbar from "./Navbar";
import EternaConcierge from "./EternaConcierge";
import Footer from "./Footer";
import DebugOverlay from "./DebugOverlay";
import ComfortPanel from "./v2/ComfortPanel";
import { usePathname } from "next/navigation";

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const { hideHeader, hideFooter } = useLayoutContext();
  const pathname = usePathname();
  const isImmersiveHome = pathname === "/";
  const shouldHideHeader = hideHeader || isImmersiveHome;
  const shouldHideFooter = hideFooter || isImmersiveHome;

  return (
    <div className="flex flex-col min-h-screen">
      <a href="#main-content" className="fixed left-4 top-4 z-[200] -translate-y-24 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-bold text-white shadow-xl transition focus:translate-y-0">
        Saltar al contenido
      </a>
      {!shouldHideHeader && <Navbar />}
      <EternaConcierge />
      <ComfortPanel />
      <DebugOverlay />
      <main id="main-content" tabIndex={-1} className={`flex-grow ${shouldHideHeader ? "" : "pt-24 pb-16"}`}>
        {children}
      </main>
      {!shouldHideFooter && <Footer />}
    </div>
  );
}
