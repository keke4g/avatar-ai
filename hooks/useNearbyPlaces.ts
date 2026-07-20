"use client";

import { useEffect, useState } from 'react';
import type { NearbyPlacesResponse } from '../lib/maps/types';

export function useNearbyPlaces(latitude: number | null, longitude: number | null) {
  const [data, setData] = useState<NearbyPlacesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return;
    }

    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) {
        setLoading(true);
        setError(null);
      }
    });
    fetch(`/api/maps/nearby?lat=${latitude}&lng=${longitude}`, { signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'No fue posible consultar el entorno.');
        return payload as NearbyPlacesResponse;
      })
      .then(setData)
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setError(requestError instanceof Error ? requestError.message : 'No fue posible consultar el entorno.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [latitude, longitude]);

  return { data, loading, error };
}
