"use client";

import React, { useState, useEffect, useRef } from 'react';
import { ArrowRight, Search, Sparkles, Mic } from 'lucide-react';
import { formatHumanDate } from '@/lib/shared/dateFormat';
import { 
  OperationMode, 
  SEARCH_CONFIG 
} from '../../lib/search/searchConfig';

type AuraSearchBarProps = {
  value: string;
  onValueChange: (value: string) => void;
  selectedDates: { start: string; end: string } | null;
  hasFilteredGuests: boolean;
  guestsCount: number;
  language: 'es' | 'en';
  onSubmit: () => void;
  onDateClick: () => void;
  onGuestClick: () => void;
  desktopDateButtonRef: React.RefObject<HTMLButtonElement | null>;
  mobileDateButtonRef: React.RefObject<HTMLButtonElement | null>;
  desktopGuestButtonRef: React.RefObject<HTMLButtonElement | null>;
  mobileGuestButtonRef: React.RefObject<HTMLButtonElement | null>;
  className?: string;
  onMicClick?: () => void;
  
  // Operation-specific properties
  operation: OperationMode;
  onOperationChange: (op: OperationMode) => void;
  budget: string;
  onBudgetChange: (budget: string) => void;
};

export function AuraSearchBar({
  value,
  onValueChange,
  selectedDates,
  hasFilteredGuests,
  guestsCount,
  language,
  onSubmit,
  onDateClick,
  onGuestClick,
  desktopDateButtonRef,
  mobileDateButtonRef,
  desktopGuestButtonRef,
  mobileGuestButtonRef,
  className = '',
  onMicClick,
  
  operation = 'ALL',
  onOperationChange,
  budget = '',
  onBudgetChange,
}: AuraSearchBarProps) {
  const config = SEARCH_CONFIG[operation];
  const [activeDropdown, setActiveDropdown] = useState<'budget' | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const dateLabelDesktop = selectedDates
    ? `${formatHumanDate(selectedDates.start, language)} · ${formatHumanDate(selectedDates.end, language)}`
    : 'Fechas';
  const dateLabelMobile = selectedDates
    ? `${formatHumanDate(selectedDates.start, language)} al ${formatHumanDate(selectedDates.end, language)}`
    : 'Fechas de viaje';
  const guestsLabelDesktop = !hasFilteredGuests
    ? 'Huéspedes'
    : guestsCount === 1
      ? '1 hués.'
      : `${guestsCount} hués.`;
  const guestsLabelMobile = !hasFilteredGuests
    ? 'Huéspedes'
    : guestsCount === 1
      ? '1 huésped'
      : `${guestsCount} huéspedes`;

  const operations: { id: OperationMode; label: string }[] = [
    { id: 'ALL', label: language === 'es' ? 'Todo el mercado' : 'All listings' },
    { id: 'SALE', label: language === 'es' ? 'Venta' : 'Sale' },
    { id: 'RENT', label: language === 'es' ? 'Renta' : 'Rent' },
    { id: 'SWAP', label: language === 'es' ? 'Intercambio' : 'Swap' }
  ];

  return (
    <div ref={containerRef} className={`flex w-full flex-col ${className}`}>
      {/* 1. Operation Tabs Selector */}
      <div className="mb-3 grid w-full grid-cols-2 gap-2 rounded-2xl bg-slate-100/90 p-1.5 pointer-events-auto sm:flex sm:w-fit sm:items-center">
        {operations.map((op) => (
          <button
            key={op.id}
            type="button"
            onClick={() => {
              onOperationChange(op.id);
              setActiveDropdown(null);
            }}
            className={`relative min-h-10 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition-all duration-200 cursor-pointer ${
              operation === op.id
                ? 'bg-brand-black text-white shadow-[0_8px_24px_rgba(15,23,42,0.2)] ring-2 ring-[#7169df]/25'
                : 'bg-white/80 text-brand-gray-500 shadow-sm hover:bg-white hover:text-brand-black'
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              {operation === op.id && <span className="h-1.5 w-1.5 rounded-full bg-[#8f88ff]" aria-hidden="true" />}
              {op.label}
            </span>
          </button>
        ))}
      </div>

      <div className="hero-search-shell liquid-glass-search w-full">
        {/* DESKTOP SEARCH BAR */}
        <div className="hero-search-desktop hidden md:flex items-center w-full">
          <div className="flex items-center gap-3 px-4 py-3 flex-1 min-w-0">
            <Search className="w-4 h-4 shrink-0 text-[#7169df]" />
            <input
              type="text"
              placeholder={config.placeholder}
              value={value}
              onChange={e => onValueChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSubmit()}
              className="bg-transparent outline-none text-[13px] font-bold w-full min-w-0 placeholder:text-[#68708b]/55"
              style={{ color: '#17142f', caretColor: '#6C63FF' }}
            />
            {onMicClick && (
              <button
                type="button"
                onClick={onMicClick}
                className="p-1.5 -mr-1.5 text-[#7169df] hover:text-[#6C63FF] hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0"
                title="Preguntar con voz"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="hero-search-divider" />

          {operation === 'ALL' ? null : operation === 'SWAP' ? (
            <>
              <button
                ref={desktopDateButtonRef}
                type="button"
                onClick={onDateClick}
                className="flex items-center gap-2 px-5 py-3 cursor-pointer outline-none bg-transparent shrink-0"
              >
                <ArrowRight className="w-3.5 h-3.5 shrink-0 text-[#8179e7]" />
                <span
                  className="text-[12px] font-bold truncate max-w-[120px]"
                  style={{ color: selectedDates ? '#17142f' : 'rgba(23,20,47,0.45)' }}
                >
                  {dateLabelDesktop}
                </span>
              </button>

              <div className="hero-search-divider" />

              <button
                ref={desktopGuestButtonRef}
                type="button"
                onClick={onGuestClick}
                className="flex items-center gap-2 px-5 py-3 cursor-pointer outline-none bg-transparent shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#8179e7]" />
                <span
                  className="text-[12px] font-bold"
                  style={{ color: hasFilteredGuests ? '#17142f' : 'rgba(23,20,47,0.45)' }}
                >
                  {guestsLabelDesktop}
                </span>
              </button>
            </>
          ) : (
            <>
              {/* Budget Custom Dropdown */}
              <div className="flex items-center gap-1.5 px-5 py-3 bg-transparent shrink-0 relative min-w-[170px] max-w-[220px]">
                <button
                  type="button"
                  onClick={() => setActiveDropdown(activeDropdown === 'budget' ? null : 'budget')}
                  className="flex items-center gap-2 cursor-pointer outline-none bg-transparent w-full text-left"
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0 text-[#8179e7]" />
                  <span
                    className="text-[12px] font-bold truncate max-w-[160px]"
                    style={{ color: budget ? '#17142f' : 'rgba(23,20,47,0.45)' }}
                  >
                    {config.budgetOptions.find(opt => opt.value === budget)?.label || 'Presupuesto'}
                  </span>
                  <span className="text-brand-gray-400 text-[9px] ml-auto select-none">▼</span>
                </button>

                {activeDropdown === 'budget' && (
                  <div className="absolute top-[calc(100%+8px)] left-0 z-50 bg-white border border-brand-gray-200/80 rounded-[24px] shadow-2xl p-4 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 min-w-[230px]">
                    <h4 className="text-[10px] font-black text-brand-black mb-3 uppercase tracking-widest text-[#7169df]">Presupuesto</h4>
                    <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto pr-1 scrollbar-thin">
                      {config.budgetOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            onBudgetChange(opt.value);
                            setActiveDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            budget === opt.value
                              ? 'bg-brand-black text-white'
                              : 'text-brand-gray-600 hover:bg-brand-gray-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <button onClick={onSubmit} className="hero-search-cta shrink-0 cursor-pointer ml-1 animate-all duration-200 hover:scale-105 active:scale-95" aria-label="Buscar">
            <Search className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* MOBILE SEARCH BAR */}
        <div className="hero-search-mobile md:hidden flex flex-col gap-2">
          <div className="hero-search-mobile-row">
            <Search className="w-4 h-4 text-[#7169df] shrink-0" />
            <input
              type="text"
              placeholder={config.placeholder}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
              className="bg-transparent outline-none text-[12px] font-bold text-brand-black placeholder:text-[#68708b]/55 w-full pr-8"
            />
            {onMicClick && (
              <button
                type="button"
                onClick={onMicClick}
                className="absolute right-3 p-1.5 text-[#7169df] hover:text-[#6C63FF] transition-colors cursor-pointer shrink-0"
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>

          {operation === 'ALL' ? null : operation === 'SWAP' ? (
            <>
              <button
                ref={mobileDateButtonRef}
                type="button"
                onClick={onDateClick}
                className="hero-search-mobile-row text-left cursor-pointer"
              >
                <ArrowRight className="w-4 h-4 text-[#8179e7] shrink-0" />
                <span className="text-[12px] font-bold truncate">{dateLabelMobile}</span>
              </button>
              <button
                ref={mobileGuestButtonRef}
                type="button"
                onClick={onGuestClick}
                className="hero-search-mobile-row text-left cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#8179e7] shrink-0" />
                <span className="text-[12px] font-bold truncate">{guestsLabelMobile}</span>
              </button>
            </>
          ) : (
            <>
              {/* Budget Custom Dropdown Mobile */}
              <div className="relative w-full">
                <button
                  type="button"
                  onClick={() => setActiveDropdown(activeDropdown === 'budget' ? null : 'budget')}
                  className="hero-search-mobile-row text-left cursor-pointer w-full flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#8179e7] shrink-0" />
                    <span className="text-[12px] font-bold">
                      {config.budgetOptions.find(opt => opt.value === budget)?.label || 'Presupuesto'}
                    </span>
                  </div>
                  <span className="text-brand-gray-400 text-[9px] mr-1">▼</span>
                </button>
                {activeDropdown === 'budget' && (
                  <div className="absolute left-0 right-0 mt-1 z-50 bg-white border border-brand-gray-200/80 rounded-[24px] shadow-2xl p-4 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    <h4 className="text-[10px] font-black text-brand-black mb-3 uppercase tracking-widest text-[#7169df]">Presupuesto</h4>
                    <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto">
                      {config.budgetOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            onBudgetChange(opt.value);
                            setActiveDropdown(null);
                          }}
                          className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                            budget === opt.value
                              ? 'bg-brand-black text-white'
                              : 'text-brand-gray-600 hover:bg-brand-gray-50'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <button onClick={onSubmit} className="hero-search-mobile-cta cursor-pointer">
            <Search className="w-4 h-4" />
            <span>{config.submitLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
