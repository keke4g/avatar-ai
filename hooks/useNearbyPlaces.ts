"use client";

import { useEffect, useState } from 'react';
import type { NearbyPlacesResponse } from '../lib/maps/types';
import { formatGooglePlaceName } from '../lib/maps/placeNames';

const NEARBY_CACHE_TTL_MS = 5 * 60_000;
const NEARBY_CACHE_MAX_ENTRIES = 30;

const nearbyPlacesCache = new Map<string, { data: NearbyPlacesResponse; expiresAt: number }>();
const nearbyPlacesRequests = new Map<string, Promise<NearbyPlacesResponse>>();

function normalizeCoordinate(value: number): string {
  return value.toFixed(5);
}

function readNearbyCache(cacheKey: string): NearbyPlacesResponse | null {
  const cached = nearbyPlacesCache.get(cacheKey);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    nearbyPlacesCache.delete(cacheKey);
    return null;
  }
  nearbyPlacesCache.delete(cacheKey);
  nearbyPlacesCache.set(cacheKey, cached);
  return cached.data;
}

function writeNearbyCache(cacheKey: string, data: NearbyPlacesResponse) {
  nearbyPlacesCache.delete(cacheKey);
  nearbyPlacesCache.set(cacheKey, { data, expiresAt: Date.now() + NEARBY_CACHE_TTL_MS });
  while (nearbyPlacesCache.size > NEARBY_CACHE_MAX_ENTRIES) {
    const oldestKey = nearbyPlacesCache.keys().next().value as string | undefined;
    if (!oldestKey) break;
    nearbyPlacesCache.delete(oldestKey);
  }
}

async function loadNearbyPlaces(cacheKey: string, latitude: number, longitude: number): Promise<NearbyPlacesResponse> {
  const cached = readNearbyCache(cacheKey);
  if (cached) return cached;

  const pending = nearbyPlacesRequests.get(cacheKey);
  if (pending) return pending;

  const request = fetch(
    `/api/maps/nearby?lat=${encodeURIComponent(normalizeCoordinate(latitude))}&lng=${encodeURIComponent(normalizeCoordinate(longitude))}`,
  )
    .then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'No fue posible consultar el entorno.');
      const nearby = payload as NearbyPlacesResponse;
      const normalized = {
        ...nearby,
        places: nearby.places.map((place) => ({
          ...place,
          name: formatGooglePlaceName(place.name),
        })),
      };
      writeNearbyCache(cacheKey, normalized);
      return normalized;
    })
    .finally(() => {
      nearbyPlacesRequests.delete(cacheKey);
    });

  nearbyPlacesRequests.set(cacheKey, request);
  return request;
}

export function useNearbyPlaces(latitude: number | null, longitude: number | null) {
  const [data, setData] = useState<NearbyPlacesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const normalizedLatitude = Number(latitude);
    const normalizedLongitude = Number(longitude);
    const cacheKey = `${normalizeCoordinate(normalizedLatitude)},${normalizeCoordinate(normalizedLongitude)}`;
    let cancelled = false;
    const cached = readNearbyCache(cacheKey);

    queueMicrotask(() => {
      if (!cancelled) {
        if (cached) setData(cached);
        setLoading(!cached);
        setError(null);
      }
    });

    loadNearbyPlaces(cacheKey, normalizedLatitude, normalizedLongitude)
      .then((nearby) => {
        if (!cancelled) setData(nearby);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : 'No fue posible consultar el entorno.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  return { data, loading, error };
}
