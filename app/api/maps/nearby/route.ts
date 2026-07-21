import { NextRequest, NextResponse } from 'next/server';
import type { NearbyPlace, NearbyPlaceCategory, NearbyPlacesResponse } from '../../../../lib/maps/types';
import { formatGooglePlaceName } from '../../../../lib/maps/placeNames';

export const runtime = 'nodejs';

const CATEGORY_TYPES: Record<NearbyPlaceCategory, string[]> = {
  school: ['school'],
  supermarket: ['supermarket', 'grocery_store'],
  hospital: ['hospital'],
  park: ['park'],
};

interface GooglePlaceResult {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  googleMapsUri?: string;
}

function distanceInMeters(originLat: number, originLng: number, lat: number, lng: number) {
  const toRadians = (value: number) => value * Math.PI / 180;
  const earthRadius = 6_371_000;
  const deltaLat = toRadians(lat - originLat);
  const deltaLng = toRadians(lng - originLng);
  const a = Math.sin(deltaLat / 2) ** 2
    + Math.cos(toRadians(originLat)) * Math.cos(toRadians(lat)) * Math.sin(deltaLng / 2) ** 2;
  return Math.round(earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function parseDurationSeconds(duration?: string): number | null {
  if (!duration) return null;
  const match = duration.match(/^([\d.]+)s$/);
  return match ? Math.round(Number(match[1])) : null;
}

async function searchCategory(apiKey: string, category: NearbyPlaceCategory, latitude: number, longitude: number) {
  const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri',
    },
    body: JSON.stringify({
      includedTypes: CATEGORY_TYPES[category],
      maxResultCount: 3,
      rankPreference: 'DISTANCE',
      languageCode: 'es',
      regionCode: 'MX',
      locationRestriction: {
        circle: { center: { latitude, longitude }, radius: 5000 },
      },
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(`Places ${response.status}: ${body.slice(0, 300)}`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  const payload = await response.json() as { places?: GooglePlaceResult[] };
  return (payload.places || []).flatMap((place): NearbyPlace[] => {
    const lat = place.location?.latitude;
    const lng = place.location?.longitude;
    if (!place.id || !place.displayName?.text || !Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    return [{
      id: place.id,
      name: formatGooglePlaceName(place.displayName.text),
      category,
      address: place.formattedAddress,
      latitude: lat as number,
      longitude: lng as number,
      distanceMeters: distanceInMeters(latitude, longitude, lat as number, lng as number),
      durationSeconds: null,
      googleMapsUri: place.googleMapsUri,
      routeSource: 'straight_line',
    }];
  });
}

async function addDrivingRoutes(apiKey: string, origin: { latitude: number; longitude: number }, places: NearbyPlace[]) {
  if (places.length === 0) return { places, routeStatus: 'distance_only' as const };
  try {
    const response = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status,condition',
      },
      body: JSON.stringify({
        origins: [{ waypoint: { location: { latLng: origin } } }],
        destinations: places.map((place) => ({ waypoint: { placeId: place.id } })),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_AWARE',
        languageCode: 'es-MX',
        regionCode: 'MX',
      }),
      cache: 'no-store',
    });
    if (!response.ok) return { places, routeStatus: 'distance_only' as const };
    const matrix = await response.json() as Array<{ destinationIndex?: number; duration?: string; distanceMeters?: number; condition?: string }>;
    const enriched = places.map((place, index) => {
      const route = matrix.find((item) => item.destinationIndex === index && item.condition === 'ROUTE_EXISTS');
      if (!route || !Number.isFinite(route.distanceMeters)) return place;
      return {
        ...place,
        distanceMeters: route.distanceMeters as number,
        durationSeconds: parseDurationSeconds(route.duration),
        routeSource: 'google_routes' as const,
      };
    });
    return { places: enriched, routeStatus: enriched.some((place) => place.routeSource === 'google_routes') ? 'google_routes' as const : 'distance_only' as const };
  } catch {
    return { places, routeStatus: 'distance_only' as const };
  }
}

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get('lat'));
  const longitude = Number(request.nextUrl.searchParams.get('lng'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 });
  }

  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY
    || process.env.GOOGLE_MAPS_SERVER_API_KEY
    || process.env.GOOGLE_API_KEY
    || '';
  if (!apiKey) return NextResponse.json({ error: 'Google Maps no está configurado.' }, { status: 503 });

  try {
    const batches = await Promise.all(
      (Object.keys(CATEGORY_TYPES) as NearbyPlaceCategory[]).map((category) => searchCategory(apiKey, category, latitude, longitude)),
    );
    const unique = Array.from(new Map(batches.flat().map((place) => [place.id, place])).values());
    const routed = await addDrivingRoutes(apiKey, { latitude, longitude }, unique);
    const payload: NearbyPlacesResponse = {
      places: routed.places,
      center: { latitude, longitude },
      routeStatus: routed.routeStatus,
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' },
    });
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    console.error('[Google Nearby Places]', error instanceof Error ? error.message : error);
    return NextResponse.json({
      error: status === 403
        ? 'Activa Places API (New) para mostrar lugares cercanos.'
        : 'No fue posible consultar los lugares cercanos en este momento.',
      code: status === 403 ? 'PLACES_API_DISABLED' : 'PLACES_LOOKUP_FAILED',
    }, { status: status === 403 ? 503 : 502 });
  }
}
