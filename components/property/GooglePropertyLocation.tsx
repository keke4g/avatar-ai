"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps is loaded dynamically at runtime. */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Compass, ExternalLink, GraduationCap, Hospital, MapPin, ShoppingCart, Trees } from 'lucide-react';
import type { Property } from '../../lib/types';
import type { NearbyPlace, NearbyPlaceCategory } from '../../lib/maps/types';
import { NEARBY_CATEGORY_LABELS } from '../../lib/maps/types';
import { loadGoogleMaps } from '../../lib/maps/googleMapsLoader';
import { PropertySubIcon } from './PropertySectionCard';

interface GooglePropertyLocationProps {
  property: Property;
  places: NearbyPlace[];
  loading: boolean;
  error: string | null;
  language: 'es' | 'en';
}

const CATEGORY_META: Record<NearbyPlaceCategory, { color: string; bg: string; icon: typeof MapPin }> = {
  school: { color: '#5b5cf0', bg: 'bg-violet-50 text-violet-700', icon: GraduationCap },
  supermarket: { color: '#0f9f75', bg: 'bg-emerald-50 text-emerald-700', icon: ShoppingCart },
  hospital: { color: '#e11d48', bg: 'bg-rose-50 text-rose-700', icon: Hospital },
  park: { color: '#16a34a', bg: 'bg-green-50 text-green-700', icon: Trees },
};

const MAP_STYLE = [
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f5f5f6' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dce8f3' }] },
];

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.max(1, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

function formatDuration(seconds?: number | null, language: 'es' | 'en' = 'es') {
  if (!seconds) return null;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return language === 'es' ? `${minutes} min en auto` : `${minutes} min drive`;
}

export default function GooglePropertyLocation({ property, places, loading, error, language }: GooglePropertyLocationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapsApi, setMapsApi] = useState<any>(null);
  const [mapError, setMapError] = useState('');
  const latitude = Number(property.latitude);
  const longitude = Number(property.longitude);

  const featuredPlaces = useMemo(() => {
    const grouped = new Map<NearbyPlaceCategory, NearbyPlace[]>();
    places.forEach((place) => grouped.set(place.category, [...(grouped.get(place.category) || []), place]));
    return (Object.keys(CATEGORY_META) as NearbyPlaceCategory[]).flatMap((category) =>
      (grouped.get(category) || []).sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 1),
    );
  }, [places]);

  useEffect(() => {
    loadGoogleMaps()
      .then(async (namespace) => {
        const maps = await namespace.maps.importLibrary('maps');
        setMapsApi({ namespace, maps });
      })
      .catch((loadError) => {
        console.error('[Property Google Map]', loadError);
        setMapError(loadError instanceof Error ? loadError.message : 'No se pudo cargar el mapa.');
      });
  }, []);

  useEffect(() => {
    if (!mapsApi || !containerRef.current || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    const google = mapsApi.namespace;
    if (!mapRef.current) {
      mapRef.current = new mapsApi.maps.Map(containerRef.current, {
        center: { lat: latitude, lng: longitude },
        zoom: 14,
        gestureHandling: 'cooperative',
        clickableIcons: false,
        fullscreenControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        styles: MAP_STYLE,
      });
    }

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
    const bounds = new google.maps.LatLngBounds();
    const propertyPosition = { lat: latitude, lng: longitude };
    const propertyMarker = new google.maps.Marker({
      map: mapRef.current,
      position: propertyPosition,
      title: property.title,
      zIndex: 100,
      icon: {
        path: 'M 0 -17 L 17 -3 L 13 -3 L 13 15 L 4 15 L 4 5 L -4 5 L -4 15 L -13 15 L -13 -3 L -17 -3 Z',
        fillColor: '#09090b',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2.5,
        strokeOpacity: 1,
        scale: 1.05,
        anchor: new google.maps.Point(0, 15),
      },
    });
    markersRef.current.push(propertyMarker);
    bounds.extend(propertyPosition);

    featuredPlaces.forEach((place) => {
      const meta = CATEGORY_META[place.category];
      const position = { lat: place.latitude, lng: place.longitude };
      const marker = new google.maps.Marker({
        map: mapRef.current,
        position,
        title: place.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: meta.color,
          fillOpacity: 0.95,
          strokeColor: '#ffffff',
          strokeWeight: 3,
          scale: 7,
        },
      });
      markersRef.current.push(marker);
      bounds.extend(position);
    });

    if (featuredPlaces.length > 0) {
      mapRef.current.fitBounds(bounds, 52);
      google.maps.event.addListenerOnce(mapRef.current, 'idle', () => {
        if ((mapRef.current.getZoom() || 0) > 15) mapRef.current.setZoom(15);
      });
    } else {
      mapRef.current.setCenter(propertyPosition);
      mapRef.current.setZoom(14);
    }
  }, [mapsApi, latitude, longitude, property.title, featuredPlaces]);

  useEffect(() => () => {
    if (!mapsApi) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    if (mapRef.current) mapsApi.namespace.maps.event.clearInstanceListeners(mapRef.current);
    markersRef.current = [];
    mapRef.current = null;
  }, [mapsApi]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-72 w-full overflow-hidden rounded-3xl border border-brand-gray-200/60 bg-[#e4e4e7] shadow-sm sm:h-80">
        <div ref={containerRef} className="absolute inset-0" />
        {!mapsApi && !mapError && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <div className="h-7 w-7 animate-spin rounded-full border-4 border-brand-gray-200 border-t-brand-accent" />
          </div>
        )}
        {mapError && <div className="absolute inset-0 flex items-center justify-center bg-white/90 px-8 text-center text-xs font-semibold text-brand-gray-500">{mapError}</div>}
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center sm:hidden">
          <span className="rounded-full border border-white/60 bg-black/75 px-3 py-1.5 text-[10px] font-bold text-white shadow-md backdrop-blur-md">
            {language === 'es' ? 'Usa dos dedos para mover el mapa' : 'Use two fingers to move the map'}
          </span>
        </div>
        <div className="absolute bottom-3 left-3 rounded-full border border-white/70 bg-white/90 px-3 py-1.5 text-[10px] font-black text-slate-800 shadow-sm backdrop-blur-md">
          Google Maps
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl bg-neutral-950 px-4 py-2 text-xs font-bold text-white shadow-xs transition hover:bg-neutral-800">
          <Compass className="h-3.5 w-3.5" /> {language === 'es' ? 'Cómo llegar' : 'Directions'}
        </a>
        <a href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-900 shadow-xs transition hover:bg-neutral-50">
          <ExternalLink className="h-3.5 w-3.5" /> {language === 'es' ? 'Abrir en Google Maps' : 'Open in Google Maps'}
        </a>
      </div>

      <div className="rounded-[22px] border border-neutral-200/80 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-950 text-white">
              <Compass className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[9px] font-black uppercase tracking-[0.17em] text-neutral-400">{language === 'es' ? 'Entorno verificado' : 'Verified surroundings'}</p>
              <h4 className="mt-0.5 text-sm font-black tracking-tight text-neutral-950">{language === 'es' ? 'Lo que tienes cerca' : 'What is nearby'}</h4>
            </div>
          </div>
          <span className="shrink-0 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-neutral-400">Google Places</span>
        </div>

        {loading && (
          <div className="grid gap-3 sm:grid-cols-2">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-2xl bg-slate-100" />)}
          </div>
        )}
        {!loading && featuredPlaces.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {featuredPlaces.map((place) => {
              const meta = CATEGORY_META[place.category];
              const Icon = meta.icon;
              const duration = formatDuration(place.durationSeconds, language);
              return (
                <a key={place.id} href={place.googleMapsUri || `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 items-center gap-3 rounded-2xl border border-neutral-200/80 bg-neutral-50/55 p-3.5 transition hover:-translate-y-0.5 hover:border-neutral-300 hover:bg-white hover:shadow-md">
                  <PropertySubIcon
                    icon={Icon}
                    iconClassName="h-4.5 w-4.5"
                    className="group-hover:border-neutral-300"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">{NEARBY_CATEGORY_LABELS[place.category][language]}</span>
                    <span className="mt-0.5 block truncate text-xs font-extrabold text-slate-900">{place.name}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-[10px] font-bold text-slate-500">
                      {duration && <><Clock3 className="h-3 w-3" />{duration}<span>·</span></>}{formatDistance(place.distanceMeters)}
                    </span>
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-neutral-950" />
                </a>
              );
            })}
          </div>
        )}
        {!loading && !error && featuredPlaces.length === 0 && <p className="rounded-2xl bg-slate-50 px-4 py-4 text-xs font-semibold text-slate-500">{language === 'es' ? 'No encontramos puntos de interés dentro del radio consultado.' : 'No nearby places were found in the search radius.'}</p>}
        {!loading && error && <p className="rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-[11px] font-semibold leading-relaxed text-amber-800">{language === 'es' ? 'El mapa está disponible. El análisis automático del entorno se está preparando y volverá a intentarse más adelante.' : 'The map is available. The nearby-area analysis is being prepared and will retry later.'}</p>}
      </div>
    </div>
  );
}
