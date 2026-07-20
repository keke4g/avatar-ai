export type NearbyPlaceCategory = 'school' | 'supermarket' | 'hospital' | 'park';

export interface NearbyPlace {
  id: string;
  name: string;
  category: NearbyPlaceCategory;
  address?: string;
  latitude: number;
  longitude: number;
  distanceMeters: number;
  durationSeconds?: number | null;
  googleMapsUri?: string;
  routeSource: 'google_routes' | 'straight_line';
}

export interface NearbyPlacesResponse {
  places: NearbyPlace[];
  center: { latitude: number; longitude: number };
  routeStatus: 'google_routes' | 'distance_only';
  generatedAt: string;
}

export interface GoogleAddressResult {
  placeId: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  city: string;
  state: string;
  country: string;
  neighborhood: string;
  postalCode: string;
  streetName: string;
  streetNumber: string;
}

export const NEARBY_CATEGORY_LABELS: Record<NearbyPlaceCategory, { es: string; en: string }> = {
  school: { es: 'Escuelas', en: 'Schools' },
  supermarket: { es: 'Supermercados', en: 'Supermarkets' },
  hospital: { es: 'Hospitales', en: 'Hospitals' },
  park: { es: 'Parques', en: 'Parks' },
};

