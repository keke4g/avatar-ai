"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps web components do not ship local TypeScript declarations here. */

import { useEffect, useRef, useState } from 'react';
import { Check, Loader2, MapPin, Search } from 'lucide-react';
import { loadGoogleMaps } from '../../lib/maps/googleMapsLoader';
import type { GoogleAddressResult } from '../../lib/maps/types';

interface GoogleAddressAutocompleteProps {
  onSelect: (address: GoogleAddressResult) => void;
  selectedAddress?: string | null;
  compact?: boolean;
}

function findComponent(components: any[], ...types: string[]) {
  return components.find((component) => types.some((type) => component.types?.includes(type)))?.longText || '';
}

export default function GoogleAddressAutocomplete({ onSelect, selectedAddress, compact = false }: GoogleAddressAutocompleteProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onSelectRef = useRef(onSelect);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  useEffect(() => { onSelectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    let disposed = false;
    let autocomplete: any = null;

    loadGoogleMaps()
      .then(async (google) => {
        if (disposed || !hostRef.current) return;
        const placesLibrary = await google.maps.importLibrary('places');
        if (disposed || !hostRef.current) return;

        autocomplete = new placesLibrary.PlaceAutocompleteElement({
          placeholder: 'Busca calle, número, colonia o ciudad',
          requestedLanguage: 'es',
          requestedRegion: 'MX',
        });
        autocomplete.className = 'auraswap-place-autocomplete';
        autocomplete.style.width = '100%';
        autocomplete.style.colorScheme = 'light';
        hostRef.current.replaceChildren(autocomplete);

        autocomplete.addEventListener('gmp-select', async (event: any) => {
          try {
            const place = event.placePrediction.toPlace();
            await place.fetchFields({
              fields: ['id', 'formattedAddress', 'location', 'addressComponents'],
            });
            const components = place.addressComponents || [];
            const latitude = place.location?.lat();
            const longitude = place.location?.lng();
            if (!place.id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
              throw new Error('Selecciona una dirección válida de la lista.');
            }

            onSelectRef.current({
              placeId: place.id,
              formattedAddress: place.formattedAddress || '',
              latitude,
              longitude,
              city: findComponent(components, 'locality', 'postal_town', 'administrative_area_level_2', 'sublocality'),
              state: findComponent(components, 'administrative_area_level_1'),
              country: findComponent(components, 'country'),
              neighborhood: findComponent(components, 'neighborhood', 'sublocality_level_1', 'sublocality'),
              postalCode: findComponent(components, 'postal_code'),
              streetName: findComponent(components, 'route'),
              streetNumber: findComponent(components, 'street_number'),
            });
            setError('');
          } catch (selectionError) {
            setError(selectionError instanceof Error ? selectionError.message : 'No se pudo leer esta dirección.');
          }
        });
        setStatus('ready');
      })
      .catch((loadError) => {
        if (disposed) return;
        setStatus('error');
        setError(loadError instanceof Error ? loadError.message : 'Autocompletado no disponible.');
      });

    return () => {
      disposed = true;
      autocomplete?.remove?.();
    };
  }, []);

  return (
    <div className={`rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white ${compact ? 'p-3.5' : 'p-4'}`}>
      <div className="mb-3 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-md shadow-violet-200">
          <Search className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-black text-slate-950">Buscar dirección con Google</span>
          <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-500">Selecciona una sugerencia para completar dirección, ciudad y coordenadas automáticamente.</span>
        </span>
      </div>

      <div className="relative min-h-[48px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div ref={hostRef} className="min-h-[48px] w-full" />
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center gap-2 bg-white px-4 text-xs font-semibold text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin text-violet-600" /> Preparando Google Maps…
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

      <style jsx global>{`
        gmp-place-autocomplete.auraswap-place-autocomplete {
          width: 100%;
          min-height: 48px;
          border: 0;
          background: #fff;
          font-family: inherit;
          color: #0f172a;
        }
      `}</style>
    </div>
  );
}
