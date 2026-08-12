import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SwapProvider } from "../lib/context/SwapContext";
import { LanguageProvider } from "../lib/context/LanguageContext";
import { LiveContextProvider } from "../lib/context/LiveContext";
import { Suspense } from "react";
import { LayoutProvider } from "../lib/context/LayoutContext";
import LayoutContent from "./_components/LayoutContent";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://towersmexico.com"),
  title: {
    default: "Towers México — Propiedades en México",
    template: "%s | Towers México",
  },
  description:
    "Descubre, publica, compra, vende, renta o intercambia propiedades verificadas con Towers México.",
  keywords: ["propiedades en México", "inmuebles", "casas en venta", "departamentos", "renta", "Towers México"],
  icons: {
    apple: "/towers-mexico-logo-blue.png",
  },
  openGraph: {
    siteName: "Towers México",
    title: "Towers México — Propiedades en México",
    description: "Propiedades verificadas para comprar, vender, rentar o intercambiar en México.",
    type: "website",
    locale: "es_MX",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} scroll-smooth`}>
      <body className="font-sans antialiased bg-brand-gray-50 text-brand-black min-h-screen flex flex-col justify-between selection:bg-brand-accent/20 selection:text-brand-accent">
        <LanguageProvider>
          <SwapProvider>
            <Suspense fallback={null}>
              <LiveContextProvider>
                <LayoutProvider>
                  <LayoutContent>
                    {children}
                  </LayoutContent>
                </LayoutProvider>
              </LiveContextProvider>
            </Suspense>
          </SwapProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
