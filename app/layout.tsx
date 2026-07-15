import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SwapProvider } from "../lib/context/SwapContext";
import { LanguageProvider } from "../lib/context/LanguageContext";
import { LiveContextProvider } from "../lib/context/LiveContext";
import { Suspense } from "react";
import { LayoutProvider } from "../lib/context/LayoutContext";
import LayoutContent from "../components/LayoutContent";
import { AuraV2Provider } from "../lib/context/AuraV2Context";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AuraSwap — Premium Home Swapping for Homeowners",
  description:
    "Exchange properties with verified homeowners for vacations instead of renting. AuraSwap charges zero rent, connecting trusted hosts worldwide.",
  keywords: ["home swap", "house exchange", "premium travel", "verified vacation", "homeowner network"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX" className={`${inter.variable} scroll-smooth`}>
      <body className="font-sans antialiased bg-brand-gray-50 text-brand-black min-h-screen flex flex-col justify-between selection:bg-brand-accent/20 selection:text-brand-accent">
        <LanguageProvider>
          <SwapProvider>
            <AuraV2Provider>
              <Suspense fallback={null}>
                <LiveContextProvider>
                  <LayoutProvider>
                    <LayoutContent>
                      {children}
                    </LayoutContent>
                  </LayoutProvider>
                </LiveContextProvider>
              </Suspense>
            </AuraV2Provider>
          </SwapProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
