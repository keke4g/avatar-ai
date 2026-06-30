"use client";
import React, { createContext, useContext, useState } from 'react';

interface LayoutContextType {
  hideHeader: boolean;
  hideFooter: boolean;
  setHideHeader: (hide: boolean) => void;
  setHideFooter: (hide: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  const [hideHeader, setHideHeader] = useState(false);
  const [hideFooter, setHideFooter] = useState(false);

  return (
    <LayoutContext.Provider value={{ hideHeader, hideFooter, setHideHeader, setHideFooter }}>
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayoutContext() {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayoutContext must be used within a LayoutProvider');
  }
  return context;
}
