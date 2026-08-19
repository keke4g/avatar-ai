import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SwapProvider } from "../lib/context/SwapContext";
import { LanguageProvider } from "../lib/context/LanguageContext";
import { LiveContextProvider } from "../lib/context/LiveContext";
import { LayoutProvider } from "../lib/context/LayoutContext";
import { ThemeProvider } from "../lib/context/ThemeContext";
import LayoutContent from "./_components/LayoutContent";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// This runs while the document is still being parsed, before the first paint.
// Keep the server default deterministic and let the browser promote a saved
// preference (including the legacy home_theme value) without a theme flash.
const THEME_BOOTSTRAP_SCRIPT = `(function(){var root=document.documentElement;try{var site=localStorage.getItem("site_theme");var legacy=localStorage.getItem("home_theme");var theme=(site==="dark"||site==="light")?site:((legacy==="dark"||legacy==="light")?legacy:"dark");localStorage.setItem("site_theme",theme);localStorage.setItem("home_theme",theme);root.dataset.theme=theme;root.classList.toggle("dark",theme==="dark");root.classList.toggle("theme-dark",theme==="dark");root.classList.toggle("theme-light",theme==="light");root.style.colorScheme=theme}catch(_){root.dataset.theme="dark";root.classList.add("dark","theme-dark");root.classList.remove("theme-light");root.style.colorScheme="dark"}})()`;

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
    <html
      lang="es"
      className={`${inter.variable} scroll-smooth dark theme-dark`}
      data-theme="dark"
      suppressHydrationWarning
    >
      <head>
        <script
          id="theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }}
        />
      </head>
      <body className="font-sans antialiased bg-brand-gray-50 text-brand-black min-h-screen flex flex-col justify-between selection:bg-brand-accent/20 selection:text-brand-accent">
        <LanguageProvider>
          <SwapProvider>
            <LiveContextProvider>
              <LayoutProvider>
                <ThemeProvider>
                  <LayoutContent>
                    {children}
                  </LayoutContent>
                </ThemeProvider>
              </LayoutProvider>
            </LiveContextProvider>
          </SwapProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
