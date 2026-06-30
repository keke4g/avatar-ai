"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Property } from '../lib/types';
import { Star, ShieldCheck, Compass, Info } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '../lib/context/LanguageContext';
import { hasValidCoordinates } from '../lib/searchFilters';

interface InteractiveMapProps {
  properties: Property[];
  hoveredPropertyId?: string | null;
  onHoverProperty?: (id: string | null) => void;
  mobileShowMap?: boolean;
}

export default function InteractiveMap({
  properties,
  hoveredPropertyId,
  onHoverProperty,
  mobileShowMap,
}: InteractiveMapProps) {
  const { t, language } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Record<string, any>>({});
  const mapContainerId = "auraswap-leaflet-map";
  const mappableProperties = useMemo(
    () => properties.filter(hasValidCoordinates),
    [properties]
  );
  const invalidCoordinateProperties = useMemo(
    () => properties.filter(property => !hasValidCoordinates(property)),
    [properties]
  );

  useEffect(() => {
    if (invalidCoordinateProperties.length === 0) return;

    console.warn(
      '[InteractiveMap] Skipping properties without valid latitude/longitude:',
      invalidCoordinateProperties.map(property => ({
        id: property.id,
        title: property.title,
        latitude: property.latitude,
        longitude: property.longitude,
      }))
    );
  }, [invalidCoordinateProperties]);

  // Sync selectedId with parent hoveredPropertyId and highlight / pan reactively
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current || !hoveredPropertyId) return;

    setSelectedId(hoveredPropertyId);
    
    const activeMarker = markersRef.current[hoveredPropertyId];
    if (activeMarker && mapRef.current) {
      const latLng = activeMarker.getLatLng();
      mapRef.current.panTo(latLng, { animate: true, duration: 0.6 });
      
      const customIcon = (window as any).L.divIcon({
        className: 'custom-leaflet-marker-selected',
        html: `<div class="bg-brand-black text-white px-2.5 py-1 rounded-full border border-brand-black font-black text-[9px] shadow-premium scale-110 ring-2 ring-indigo-500/30 transition-transform">${activeMarker.options.score || 95}%</div>`
      });
      activeMarker.setIcon(customIcon);
      activeMarker.setZIndexOffset(1000);
    }
  }, [hoveredPropertyId, leafletLoaded]);

  // Load Leaflet dynamically strictly on client to bypass Next.js pre-rendering crashes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const loadLeafletAssets = async (): Promise<any> => {
      // CRITICAL BUG FIX: Always ensure Leaflet CSS stylesheet is present in head, even if JS (window.L) is already loaded.
      if (!document.getElementById('leaflet-css-cdn')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.id = 'leaflet-css-cdn';
        document.head.appendChild(link);
      }

      if ((window as any).L) {
        return (window as any).L;
      }

      return new Promise((resolve, reject) => {
        // Inject Leaflet JS script in DOM
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.id = 'leaflet-js-cdn';
        script.onload = () => {
          resolve((window as any).L);
        };
        script.onerror = () => {
          reject(new Error("Failed to load Leaflet script."));
        };
        document.head.appendChild(script);
      });
    };

    loadLeafletAssets()
      .then(() => {
        setLeafletLoaded(true);
      })
      .catch((err) => {
        console.error("[Leaflet Load Error]:", err);
      });

    // Cleanup: Do NOT remove scripts/stylesheets from the head on unmount.
    // In SPAs like Next.js, keeping Leaflet in memory guarantees seamless navigation without style drops.
  }, []);

  // Initialize Map Instance ONCE when Leaflet script is loaded
  useEffect(() => {
    if (!leafletLoaded || typeof window === 'undefined') return;

    const L = (window as any).L;
    if (!L) return;

    const container = document.getElementById(mapContainerId);
    if (!container) return;

    // Initialize Map Centered
    const map = L.map(mapContainerId, {
      zoomControl: false,
      scrollWheelZoom: true,
      attributionControl: false
    }).setView([20, 0], 2);

    mapRef.current = map;

    // Apply CartoDB Positron tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
    }).addTo(map);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current = {};
      }
    };
  }, [leafletLoaded]);

  // Synchronize markers in-place reactively when properties list or highlights change
  useEffect(() => {
    if (!leafletLoaded || !mapRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    const map = mapRef.current;

    // 1. Remove markers for properties that are no longer in active properties list
    const activeIds = new Set(mappableProperties.map(p => p.id));
    Object.keys(markersRef.current).forEach(id => {
      if (!activeIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // 2. Add or update markers in-place
    const bounds: any[] = [];
    mappableProperties.forEach((property) => {
      const isSelected = selectedId === property.id;
      const isHovered = hoveredPropertyId === property.id;
      const activeHighlight = isSelected || isHovered;

      const customIcon = L.divIcon({
        className: activeHighlight ? 'custom-leaflet-marker-selected' : 'custom-leaflet-marker',
        iconSize: null,
        html: `<div class="${
          activeHighlight
            ? 'bg-brand-black text-white border-brand-black font-black ring-2 ring-indigo-500/20 scale-105 shadow-md'
            : 'bg-white text-brand-accent border-brand-gray-200 font-extrabold hover:bg-brand-black hover:text-white hover:border-brand-black'
        } px-2 py-0.5 rounded-full border text-[9px] shadow-sm font-sans transition-all duration-200 flex items-center justify-center pointer-events-auto">${property.auraScore}%</div>`
      });

      if (markersRef.current[property.id]) {
        // Marker exists, update position & styling
        const marker = markersRef.current[property.id];
        marker.setLatLng([property.latitude, property.longitude]);
        marker.setIcon(customIcon);
        marker.setZIndexOffset(activeHighlight ? 1000 : 0);
      } else {
        // Create new marker
        const marker = L.marker([property.latitude, property.longitude], { 
          icon: customIcon,
          score: property.auraScore
        }).addTo(map);

        marker.on('mouseover', () => {
          setSelectedId(property.id);
          if (onHoverProperty) onHoverProperty(property.id);
        });

        marker.on('mouseout', () => {
          if (onHoverProperty) onHoverProperty(null);
        });

        marker.on('click', () => {
          setSelectedId(property.id);
          map.setView([property.latitude, property.longitude], Math.max(map.getZoom(), 8), { animate: true });
        });

        markersRef.current[property.id] = marker;
      }

      bounds.push([property.latitude, property.longitude]);
    });

    // 3. Zoom-fit dynamically only when the list of coordinates actually changes
    const boundsString = JSON.stringify(bounds);
    if (!mapRef.current.prevBounds || mapRef.current.prevBounds !== boundsString) {
      mapRef.current.prevBounds = boundsString;
      if (bounds.length > 0) {
        map.fitBounds(bounds, { 
          padding: [40, 40],
          maxZoom: 10,
          animate: true,
          duration: 0.8
        });
      }
    }
  }, [leafletLoaded, mappableProperties, selectedId, hoveredPropertyId, onHoverProperty]);
  // Trigger invalidateSize whenever mobileShowMap or leafletLoaded changes (Fixes Leaflet 0x0 size bugs on visibility toggle)
  useEffect(() => {
    if (leafletLoaded && mapRef.current) {
      const timer = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize({ animate: true });
          
          // Fit bounds dynamically if coordinates are present
          if (mappableProperties.length > 0) {
            const bounds = mappableProperties.map(p => [p.latitude, p.longitude]);
            mapRef.current.fitBounds(bounds, { 
              padding: [40, 40],
              maxZoom: 10,
              animate: true
            });
          }
        }
      }, 250); // Small timeout to ensure DOM container transitions have completed
      return () => clearTimeout(timer);
    }
  }, [mobileShowMap, leafletLoaded, mappableProperties]);
  const selectedProperty = mappableProperties.find((p) => p.id === selectedId);

  return (
    <div className="w-full h-full min-h-[400px] md:min-h-0 bg-[#f4f4f5] rounded-3xl border border-brand-gray-200/60 overflow-hidden relative flex flex-col justify-between shadow-premium select-none">
      
      {/* 1. Leaflet Real Map Container */}
      <div 
        id={mapContainerId} 
        className="absolute inset-0 w-full h-full z-0 bg-[#e4e4e7]"
      />

      {/* 2. Map Control Overlay Badge */}
      <div className="absolute top-4 left-4 glass px-3.5 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-brand-black flex items-center gap-1.5 shadow-sm bg-white/95 z-10 border border-brand-gray-200/30">
        <Compass className="w-3.5 h-3.5 text-brand-accent animate-spin" style={{ animationDuration: '8s' }} />
        <span>{language === 'es' ? 'Intercambios Activos' : 'Verified Swaps Active'}</span>
      </div>

      {/* 3. Loading Leaflet HUD Overlay */}
      {!leafletLoaded && (
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex flex-col items-center justify-center z-10 font-semibold">
          <div className="w-8 h-8 rounded-full border-4 border-brand-gray-200 border-t-brand-accent animate-spin mb-3" />
          <span className="text-[10px] uppercase font-bold tracking-widest text-brand-gray-500">{language === 'es' ? 'Inicializando Mapa...' : 'Initializing Leaflet...'}</span>
        </div>
      )}

      {/* 4. Dynamic Floating Property Preview Card (Synchronized with Map Clicks & List Hovers) */}
      <div className="w-full p-4 relative z-10 mt-auto">
        {selectedProperty ? (
          <div className="w-full bg-white rounded-2xl p-3 shadow-floating border border-brand-gray-200/50 flex gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-auto">
            <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-brand-gray-100">
              <img
                src={selectedProperty.images[0]}
                alt={selectedProperty.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            <div className="flex flex-col justify-between py-0.5 overflow-hidden flex-1">
              <div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-[9px] font-black text-brand-accent bg-brand-accent/5 px-2 py-0.5 rounded-md uppercase tracking-wider">
                    {language === 'es' ? `Compatibilidad ${selectedProperty.auraScore}%` : `${selectedProperty.auraScore}% Match`}
                  </span>
                  {selectedProperty.hostVerified && (
                    <ShieldCheck className="w-3.5 h-3.5 text-brand-accent fill-brand-accent/5" />
                  )}
                </div>
                
                <h4 className="text-xs font-bold text-brand-black truncate">
                  {selectedProperty.location}
                </h4>
                <p className="text-[10px] text-brand-gray-500 truncate max-w-[200px] sm:max-w-xs font-semibold">
                  {t(`properties.${selectedProperty.id}.title`).startsWith('properties.') ? selectedProperty.title : t(`properties.${selectedProperty.id}.title`)}
                </p>
              </div>

              <div className="flex items-center justify-between gap-4">
                <span className="text-[10px] text-brand-gray-500 font-bold uppercase tracking-wider">
                  {t('details.bedroomCount', { count: selectedProperty.bedrooms })} • {
                    language === 'es' 
                      ? `Swap ${t(`valueRatings.${selectedProperty.valueRating}`).startsWith('valueRatings.') ? selectedProperty.valueRating : t(`valueRatings.${selectedProperty.valueRating}`)}` 
                      : `${selectedProperty.valueRating} Swap`
                  }
                </span>
                
                <Link
                  href={`/property/${selectedProperty.id}`}
                  className="text-[10px] font-black text-brand-accent hover:underline flex items-center gap-0.5 uppercase tracking-wider"
                >
                  {language === 'es' ? 'Ver Detalles →' : 'View Details →'}
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full bg-white/95 rounded-2xl py-4 px-4 text-center text-[10px] text-brand-gray-500 font-extrabold uppercase tracking-widest border border-brand-gray-200/50 shadow-sm font-semibold">
            <Info className="w-3.5 h-3.5 inline mr-1.5 text-brand-accent" />
            <span>{language === 'es' ? 'Desliza sobre propiedades o marcadores para explorar' : 'Hover listings or markers to explore'}</span>
          </div>
        )}
      </div>

      {/* 5. Custom Styled Markers styling */}
      <style jsx global>{`
        .custom-leaflet-marker, .custom-leaflet-marker-selected, .custom-leaflet-marker-active {
          background: none !important;
          border: none !important;
          box-shadow: none !important;
          margin: 0 !important;
          width: auto !important;
          height: auto !important;
          pointer-events: auto !important;
        }
        .leaflet-marker-pane {
          z-index: 600 !important;
        }
        .leaflet-overlay-pane {
          z-index: 400 !important;
        }
      `}</style>
    </div>
  );
}
