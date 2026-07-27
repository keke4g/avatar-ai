"use client";
/* eslint-disable @typescript-eslint/no-explicit-any -- Google Maps is loaded dynamically at runtime. */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Compass, Info, ShieldCheck } from 'lucide-react';
import { Property } from '../lib/types';
import { useTranslation } from '../lib/context/LanguageContext';
import { hasValidCoordinates } from '../lib/searchFilters';
import { formatCount } from '../lib/textHelpers';
import { loadGoogleMaps } from '../lib/maps/googleMapsLoader';

interface InteractiveMapProps {
  properties: Property[];
  hoveredPropertyId?: string | null;
  onHoverProperty?: (id: string | null) => void;
  mobileShowMap?: boolean;
}

const MAP_STYLE = [
  { featureType: 'poi', elementType: 'labels.icon', stylers: [{ saturation: -70 }, { lightness: 15 }] },
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f4f4f5' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dce7f4' }] },
];

function operationLabel(property: Property, language: string) {
  const activeModes = new Set((property.offerings || []).filter((offering) => offering.status === 'ACTIVE').map((offering) => offering.mode));
  if (property.primaryOperation === 'SALE' || activeModes.has('SALE')) return language === 'es' ? 'Venta' : 'Sale';
  if (property.primaryOperation === 'RENT' || activeModes.has('MONTHLY_RENT') || activeModes.has('SHORT_RENT')) return language === 'es' ? 'Renta' : 'Rent';
  return language === 'es' ? 'Intercambio' : 'Swap';
}

function propertyMarkerPrice(property: Property): string {
  const activeOfferings = (property.offerings || []).filter((offering) => offering.status === 'ACTIVE');
  const preferredOffering = activeOfferings.find((offering) => (
    property.primaryOperation === 'SALE'
      ? offering.mode === 'SALE'
      : property.primaryOperation === 'RENT'
        ? offering.mode === 'MONTHLY_RENT' || offering.mode === 'SHORT_RENT'
        : offering.mode === 'SWAP'
  )) || activeOfferings.find((offering) => offering.mode === 'SALE')
    || activeOfferings.find((offering) => offering.mode === 'MONTHLY_RENT')
    || activeOfferings.find((offering) => offering.mode === 'SHORT_RENT')
    || activeOfferings.find((offering) => offering.mode === 'SWAP');

  const amount = Number(preferredOffering?.priceAmount || preferredOffering?.swapEstimatedValue || 0);
  if (!Number.isFinite(amount) || amount <= 0) return 'Consultar';
  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `${new Intl.NumberFormat('es-MX', {
      minimumFractionDigits: 0,
      maximumFractionDigits: millions < 10 && !Number.isInteger(millions) ? 1 : 0,
    }).format(millions)}M`;
  }
  if (amount >= 1_000) return `${Math.round(amount / 1_000)}K`;
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(amount);
}

function markerIcon(google: any, highlighted: boolean, label: string) {
  const halfWidth = Math.max(26, Math.min(40, 13 + (label.length * 5)));
  return {
    path: `M ${-halfWidth} -15 H ${halfWidth} Q ${halfWidth + 6} -15 ${halfWidth + 6} -9 V 7 Q ${halfWidth + 6} 13 ${halfWidth} 13 H 6 L 0 20 L -6 13 H ${-halfWidth} Q ${-halfWidth - 6} 13 ${-halfWidth - 6} 7 V -9 Q ${-halfWidth - 6} -15 ${-halfWidth} -15 Z`,
    fillColor: highlighted ? '#09090b' : '#ffffff',
    fillOpacity: 1,
    strokeColor: highlighted ? '#09090b' : '#d4d4d8',
    strokeWeight: highlighted ? 1.5 : 1,
    scale: highlighted ? 1.04 : 1,
    labelOrigin: new google.maps.Point(0, -1),
    anchor: new google.maps.Point(0, 20),
  };
}

export default function InteractiveMap({ properties, hoveredPropertyId, onHoverProperty, mobileShowMap }: InteractiveMapProps) {
  const { t, language } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const hoverHandlerRef = useRef(onHoverProperty);
  const [mapsApi, setMapsApi] = useState<any>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const mappableProperties = useMemo(() => properties.filter(hasValidCoordinates), [properties]);

  useEffect(() => {
    hoverHandlerRef.current = onHoverProperty;
  }, [onHoverProperty]);

  useEffect(() => {
    loadGoogleMaps()
      .then(async (namespace) => {
        const maps = await namespace.maps.importLibrary('maps');
        setMapsApi({ namespace, maps });
      })
      .catch((error) => {
        console.error('[Google Maps Load Error]', error);
        setLoadError(error instanceof Error ? error.message : 'No se pudo cargar Google Maps.');
      });
  }, []);

  useEffect(() => {
    if (!mapsApi || !containerRef.current || mapRef.current) return;
    mapRef.current = new mapsApi.maps.Map(containerRef.current, {
      center: { lat: 23.6345, lng: -102.5528 },
      zoom: 5,
      minZoom: 3,
      gestureHandling: 'cooperative',
      clickableIcons: false,
      fullscreenControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      styles: MAP_STYLE,
    });
  }, [mapsApi]);

  useEffect(() => {
    if (!mapsApi || !mapRef.current) return;
    const google = mapsApi.namespace;
    Object.values(markersRef.current).forEach((marker: any) => marker.setMap(null));
    markersRef.current = {};
    const bounds = new google.maps.LatLngBounds();

    mappableProperties.forEach((property) => {
      const position = { lat: Number(property.latitude), lng: Number(property.longitude) };
      const priceLabel = propertyMarkerPrice(property);
      const marker = new google.maps.Marker({
        map: mapRef.current,
        position,
        title: property.title,
        zIndex: 1,
        label: {
          text: priceLabel,
          color: '#18181b',
          fontSize: '11px',
          fontWeight: '900',
        },
        icon: markerIcon(google, false, priceLabel),
      });
      marker.addListener('mouseover', () => {
        setSelectedId(property.id);
        hoverHandlerRef.current?.(property.id);
      });
      marker.addListener('mouseout', () => hoverHandlerRef.current?.(null));
      marker.addListener('click', () => {
        setSelectedId(property.id);
        mapRef.current.panTo(position);
        mapRef.current.setZoom(Math.max(mapRef.current.getZoom() || 12, 13));
      });
      markersRef.current[property.id] = marker;
      bounds.extend(position);
    });

    if (!bounds.isEmpty()) {
      mapRef.current.fitBounds(bounds, 48);
      google.maps.event.addListenerOnce(mapRef.current, 'idle', () => {
        if ((mapRef.current.getZoom() || 0) > 14) mapRef.current.setZoom(14);
      });
    }
  }, [mapsApi, mappableProperties]);

  useEffect(() => {
    if (!mapsApi) return;
    const google = mapsApi.namespace;
    Object.entries(markersRef.current).forEach(([propertyId, marker]) => {
      const property = mappableProperties.find((item) => item.id === propertyId);
      if (!property) return;
      const highlighted = propertyId === selectedId || propertyId === hoveredPropertyId;
      const priceLabel = propertyMarkerPrice(property);
      marker.setZIndex(highlighted ? 20 : 1);
      marker.setLabel({
        text: priceLabel,
        color: highlighted ? '#ffffff' : '#18181b',
        fontSize: highlighted ? '12px' : '11px',
        fontWeight: '900',
      });
      marker.setIcon(markerIcon(google, highlighted, priceLabel));
    });
  }, [hoveredPropertyId, mapsApi, mappableProperties, selectedId]);

  useEffect(() => {
    if (!mapRef.current || !hoveredPropertyId) return;
    const property = mappableProperties.find((item) => item.id === hoveredPropertyId);
    if (property) mapRef.current.panTo({ lat: Number(property.latitude), lng: Number(property.longitude) });
  }, [hoveredPropertyId, mappableProperties]);

  useEffect(() => {
    if (!mapsApi || !mapRef.current) return;
    const timer = window.setTimeout(() => mapsApi.namespace.maps.event.trigger(mapRef.current, 'resize'), 250);
    return () => window.clearTimeout(timer);
  }, [mapsApi, mobileShowMap]);

  useEffect(() => () => {
    if (!mapsApi) return;
    Object.values(markersRef.current).forEach((marker: any) => marker.setMap(null));
    if (mapRef.current) mapsApi.namespace.maps.event.clearInstanceListeners(mapRef.current);
    markersRef.current = {};
    mapRef.current = null;
  }, [mapsApi]);

  const selectedProperty = mappableProperties.find((property) => property.id === selectedId);

  return (
    <div className="relative flex h-full min-h-[400px] w-full select-none flex-col justify-between overflow-hidden rounded-3xl border border-brand-gray-200/60 bg-[#f4f4f5] shadow-premium md:min-h-0">
      <div ref={containerRef} className="absolute inset-0 z-0 h-full w-full bg-[#e4e4e7]" />

      <div className="glass absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full border border-brand-gray-200/30 bg-white/95 px-3.5 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-brand-black shadow-sm">
        <Compass className="h-3.5 w-3.5 text-brand-accent" />
        <span>{language === 'es' ? 'Propiedades en Google Maps' : 'Properties on Google Maps'}</span>
      </div>

      {!mapsApi && !loadError && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/70 font-semibold backdrop-blur-[1px]">
          <div className="mb-3 h-8 w-8 animate-spin rounded-full border-4 border-brand-gray-200 border-t-brand-accent" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-brand-gray-500">{language === 'es' ? 'Cargando Google Maps…' : 'Loading Google Maps…'}</span>
        </div>
      )}
      {loadError && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90 p-8 text-center">
          <p className="max-w-sm text-xs font-semibold leading-relaxed text-brand-gray-500">{loadError}</p>
        </div>
      )}

      <div className="relative z-10 mt-auto w-full p-4">
        {selectedProperty ? (
          <div className="pointer-events-auto flex w-full gap-3 rounded-[22px] border border-white/70 bg-white/95 p-3 shadow-[0_22px_55px_-26px_rgba(15,23,42,0.55)] backdrop-blur-xl">
            <div className="h-[86px] w-[86px] shrink-0 overflow-hidden rounded-2xl bg-brand-gray-100">
              <img src={selectedProperty.images[0]} alt={selectedProperty.title} className="h-full w-full object-cover" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
              <div>
                <div className="mb-0.5 flex items-center gap-1.5">
                  <span className="rounded-md bg-brand-accent/5 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-brand-accent">{operationLabel(selectedProperty, language)}</span>
                  {selectedProperty.hostVerified && <ShieldCheck className="h-3.5 w-3.5 text-brand-accent" />}
                </div>
                <h4 className="truncate text-sm font-black tracking-tight text-brand-black">{selectedProperty.location}</h4>
                <p className="truncate text-[10px] font-semibold text-brand-gray-500">{t(`properties.${selectedProperty.id}.title`).startsWith('properties.') ? selectedProperty.title : t(`properties.${selectedProperty.id}.title`)}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-[10px] font-bold uppercase tracking-wider text-brand-gray-500">{language === 'es' ? formatCount(selectedProperty.bedrooms || 0, 'habitación', 'habitaciones', 'feminine') : `${selectedProperty.bedrooms || 0} bedrooms`}</span>
                <Link
                  href={`/property/${selectedProperty.id}`}
                  className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-neutral-950 px-3.5 text-[9px] font-black uppercase tracking-[0.08em] text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-neutral-800"
                >
                  {language === 'es' ? 'Ver propiedad' : 'View property'}
                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full rounded-2xl border border-brand-gray-200/50 bg-white/95 px-4 py-4 text-center text-[10px] font-extrabold uppercase tracking-widest text-brand-gray-500 shadow-sm">
            <Info className="mr-1.5 inline h-3.5 w-3.5 text-brand-accent" />
            {language === 'es' ? 'Selecciona una propiedad o marcador para explorar' : 'Select a listing or marker to explore'}
          </div>
        )}
      </div>
    </div>
  );
}
