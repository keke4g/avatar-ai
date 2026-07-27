"use client";
import React from "react";
import { useLayoutContext } from "../lib/context/LayoutContext";
import Navbar from "./Navbar";
import EternaConcierge from "./EternaConcierge";
import Footer from "./Footer";
import DebugOverlay from "./DebugOverlay";
import AuthRecoveryRedirect from "./AuthRecoveryRedirect";

export default function LayoutContent({ children }: { children: React.ReactNode }) {
  const { hideHeader, hideFooter } = useLayoutContext();

  return (
    <div className="flex flex-col min-h-screen">
      <AuthRecoveryRedirect />
      {!hideHeader && <Navbar />}
      <EternaConcierge />
      <DebugOverlay />
      <main className={`flex-grow ${hideHeader ? "" : "pt-24 pb-16"}`}>
        {children}
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}
