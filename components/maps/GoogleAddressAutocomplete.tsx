"use client";
/* eslint-disable @next/next/no-img-element -- Google requires its official attribution asset. */

import { KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Check, Loader2, MapPin, Search, X } from 'lucide-react';
import type { GoogleAddressResult } from '../../lib/maps/types';

interface GoogleAddressAutocompleteProps {
  onSelect: (address: GoogleAddressResult) => void;
  selectedAddress?: string | null;
  compact?: boolean;
}

interface AddressSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export default function GoogleAddressAutocomplete({ onSelect, selectedAddress, compact = false }: GoogleAddressAutocompleteProps) {
  const requestRef = useRef<AbortController | null>(null);
  const sessionTokenRef = useRef(crypto.randomUUID());
  const [query, setQuery] = useState(selectedAddress || '');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [error, setError] = useState('');

  useEffect(() => {
    const cleanQuery = query.trim();
    requestRef.current?.abort();

    if (cleanQuery.length < 3 || cleanQuery === selectedAddress) {
      return;
    }

    const controller = new AbortController();
    requestRef.current = controller;
    const timeout = window.setTimeout(async () => {
      setIsSearching(true);
      setError('');
      try {
        const response = await fetch('/api/maps/address-autocomplete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input: cleanQuery, sessionToken: sessionTokenRef.current }),
          signal: controller.signal,
        });
        const payload = await response.json() as { suggestions?: AddressSuggestion[]; error?: string };
        if (!response.ok) throw new Error(payload.error || 'No se pudieron obtener sugerencias.');
        setSuggestions(payload.suggestions || []);
        setActiveIndex(-1);
        setIsOpen(true);
      } catch (searchError) {
        if ((searchError as Error).name === 'AbortError') return;
        setSuggestions([]);
        setError(searchError instanceof Error ? searchError.message : 'Autocompletado no disponible.');
        setIsOpen(false);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 280);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, selectedAddress]);

  const chooseSuggestion = async (suggestion: AddressSuggestion) => {
    setIsSelecting(true);
    setError('');
    setIsOpen(false);
    setQuery(suggestion.description);
    try {
      const response = await fetch('/api/maps/address-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          placeId: suggestion.placeId,
          sessionToken: sessionTokenRef.current,
        }),
      });
      const payload = await response.json() as { result?: GoogleAddressResult; error?: string };
      if (!response.ok || !payload.result) throw new Error(payload.error || 'No se pudo leer esta dirección.');
      onSelect(payload.result);
      setQuery(payload.result.formattedAddress || suggestion.description);
      setSuggestions([]);
      sessionTokenRef.current = crypto.randomUUID();
    } catch (selectionError) {
      setError(selectionError instanceof Error ? selectionError.message : 'No se pudo leer esta dirección.');
    } finally {
      setIsSelecting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault();
      void chooseSuggestion(suggestions[activeIndex]);
    } else if (event.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div className={`relative rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white ${compact ? 'p-3.5' : 'p-4'}`}>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-200">
          <Search className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-black text-slate-950">Buscar dirección con Google</span>
          <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">Selecciona una sugerencia para completar dirección, ciudad y coordenadas automáticamente.</span>
        </span>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          role="combobox"
          aria-label="Buscar dirección con Google Maps"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls="google-address-suggestions"
          aria-activedescendant={activeIndex >= 0 ? `google-address-option-${activeIndex}` : undefined}
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            setError('');
            if (nextQuery.trim().length < 3) {
              requestRef.current?.abort();
              setSuggestions([]);
              setIsSearching(false);
              setIsOpen(false);
            }
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 180)}
          onKeyDown={handleKeyDown}
          placeholder="Ej. Av. Santa Anita 2381, Guadalajara"
          autoComplete="off"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-11 pr-12 text-sm font-semibold text-slate-950 shadow-sm outline-none transition placeholder:font-medium placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
        />
        {(isSearching || isSelecting) && (
          <Loader2 className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-violet-600" />
        )}
        {!isSearching && !isSelecting && query && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              setIsOpen(false);
            }}
            className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {isOpen && (
          <div
            id="google-address-suggestions"
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-[80] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_22px_55px_rgba(15,23,42,0.18)]"
          >
            {suggestions.length > 0 ? (
              <>
                <div className="max-h-64 overflow-y-auto p-1.5">
                  {suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.placeId}
                      id={`google-address-option-${index}`}
                      type="button"
                      role="option"
                      aria-selected={activeIndex === index}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => void chooseSuggestion(suggestion)}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
                        activeIndex === index ? 'bg-violet-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-violet-600">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-slate-950">{suggestion.mainText}</span>
                        {suggestion.secondaryText && (
                          <span className="mt-1 block text-[10px] font-medium leading-relaxed text-slate-500">{suggestion.secondaryText}</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex justify-end border-t border-slate-100 bg-slate-50/70 px-3 py-2">
                  <img
                    src="https://maps.gstatic.com/mapfiles/api-3/images/powered-by-google-on-white3.png"
                    alt="Powered by Google"
                    width="120"
                    height="14"
                    className="h-[14px] w-[120px]"
                  />
                </div>
              </>
            ) : (
              <div className="px-4 py-4 text-xs font-semibold text-slate-500">
                No encontramos coincidencias. Prueba agregando ciudad, estado o código postal.
              </div>
            )}
          </div>
        )}
      </div>

      {selectedAddress && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[10px] font-bold leading-relaxed text-emerald-800">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>Dirección verificada: {selectedAddress}</span>
        </div>
      )}
      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[10px] font-semibold leading-relaxed text-amber-800">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error} Puedes completar los campos manualmente.</span>
        </div>
      )}
    </div>
  );
}
