"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "site_theme";
export const LEGACY_THEME_STORAGE_KEY = "home_theme";
export const DEFAULT_THEME: Theme = "dark";

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark";
}

function getDocumentTheme(): Theme {
  if (typeof document === "undefined") return DEFAULT_THEME;

  const dataTheme = document.documentElement.dataset.theme;
  if (isTheme(dataTheme)) return dataTheme;

  return document.documentElement.classList.contains("dark") ? "dark" : DEFAULT_THEME;
}

/**
 * Reads the new preference first and migrates the old home-only preference when
 * it is the only value available. The legacy key is intentionally retained so
 * HomeExperience can continue to read it until that component is migrated.
 */
function readStoredTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(storedTheme)) return storedTheme;

    const legacyTheme = window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (isTheme(legacyTheme)) {
      window.localStorage.setItem(THEME_STORAGE_KEY, legacyTheme);
      return legacyTheme;
    }
  } catch {
    // Storage can be unavailable in private browsing or restricted webviews.
  }

  return getDocumentTheme();
}

function persistTheme(theme: Theme) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    // Keep the legacy home surface in sync until it consumes ThemeContext.
    window.localStorage.setItem(LEGACY_THEME_STORAGE_KEY, theme);
  } catch {
    // The DOM still updates when storage is unavailable.
  }
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme === "dark");
  root.classList.toggle("theme-dark", theme === "dark");
  root.classList.toggle("theme-light", theme === "light");
  root.style.colorScheme = theme;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Keep the server render deterministic. The inline bootstrap in app/layout
  // applies the persisted value before paint; the layout effect reconciles
  // React state with that value before the browser paints hydrated UI.
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);
  const isApplyingThemeRef = useRef(false);

  useLayoutEffect(() => {
    const storedTheme = readStoredTheme();
    persistTheme(storedTheme);
    applyTheme(storedTheme);
    setThemeState(storedTheme);

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY && event.key !== LEGACY_THEME_STORAGE_KEY) return;

      const nextTheme = isTheme(event.newValue) ? event.newValue : readStoredTheme();
      persistTheme(nextTheme);
      applyTheme(nextTheme);
      setThemeState(nextTheme);
    };

    // HomeExperience still emits this event. Listening here keeps its existing
    // toggle functional while making site_theme the global source of truth.
    const handleLegacyThemeChange = (event: Event) => {
      const nextTheme = (event as CustomEvent<Theme>).detail;
      if (!isTheme(nextTheme) || isApplyingThemeRef.current) return;

      persistTheme(nextTheme);
      applyTheme(nextTheme);
      setThemeState(nextTheme);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("home-theme-change", handleLegacyThemeChange);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("home-theme-change", handleLegacyThemeChange);
    };
  }, []);

  const setTheme = useCallback((nextTheme: Theme) => {
    if (!isTheme(nextTheme)) return;

    setThemeState(nextTheme);
    persistTheme(nextTheme);
    applyTheme(nextTheme);

    // Preserve the contract consumed by the legacy home experience. The ref
    // avoids the provider responding to its own compatibility event.
    if (typeof window !== "undefined") {
      isApplyingThemeRef.current = true;
      window.dispatchEvent(new CustomEvent("home-theme-change", { detail: nextTheme }));
      queueMicrotask(() => {
        isApplyingThemeRef.current = false;
      });
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [setTheme, theme]);

  const contextValue = useMemo(
    () => ({
      theme,
      isDark: theme === "dark",
      setTheme,
      toggleTheme,
    }),
    [setTheme, theme, toggleTheme],
  );

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
