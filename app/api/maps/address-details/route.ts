import { NextResponse } from 'next/server';
import type { GoogleAddressResult } from '../../../../lib/maps/types';

export const runtime = 'nodejs';

interface GoogleAddressComponent {
  longText?: string;
  shortText?: string;
  types?: string[];
}

interface GooglePlaceDetails {
  id?: string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: GoogleAddressComponent[];
}

function getGoogleMapsKey() {
  return process.env.REACT_APP_GOOGLE_MAPS_API_KEY
    || process.env.GOOGLE_MAPS_SERVER_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    || '';
}

function findComponent(components: GoogleAddressComponent[], ...types: string[]) {
  for (const type of types) {
    const match = components.find((component) => component.types?.includes(type));
    if (match?.longText) return match.longText;
  }
  return '';
}

export async function POST(request: Request) {
  const apiKey = getGoogleMapsKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps no está configurado.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { placeId?: unknown; sessionToken?: unknown } | null;
  const placeId = typeof body?.placeId === 'string' ? body.placeId.trim().slice(0, 300) : '';
  const sessionToken = typeof body?.sessionToken === 'string' ? body.sessionToken.slice(0, 100) : '';
  if (!placeId) return NextResponse.json({ error: 'Falta seleccionar una dirección.' }, { status: 400 });

  try {
    const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`);
    url.searchParams.set('languageCode', 'es');
    url.searchParams.set('regionCode', 'MX');
    if (sessionToken) url.searchParams.set('sessionToken', sessionToken);

    const response = await fetch(url, {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents',
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('[Google Address Details]', response.status, details.slice(0, 300));
      return NextResponse.json({ error: 'No se pudo leer la dirección seleccionada.' }, { status: 502 });
    }

    const place = await response.json() as GooglePlaceDetails;
    const components = place.addressComponents || [];
    const latitude = place.location?.latitude;
    const longitude = place.location?.longitude;

    if (!place.id || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: 'La ubicación seleccionada no tiene coordenadas válidas.' }, { status: 422 });
    }

    const result: GoogleAddressResult = {
      placeId: place.id,
      formattedAddress: place.formattedAddress || '',
      latitude: latitude as number,
      longitude: longitude as number,
      city: findComponent(components, 'locality', 'postal_town', 'administrative_area_level_2', 'sublocality'),
      state: findComponent(components, 'administrative_area_level_1'),
      country: findComponent(components, 'country'),
      neighborhood: findComponent(components, 'neighborhood', 'sublocality_level_1', 'sublocality'),
      postalCode: findComponent(components, 'postal_code'),
      streetName: findComponent(components, 'route'),
      streetNumber: findComponent(components, 'street_number'),
    };

    return NextResponse.json({ result }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('[Google Address Details]', error);
    return NextResponse.json({ error: 'No fue posible consultar el detalle de Google Maps.' }, { status: 502 });
  }
}
