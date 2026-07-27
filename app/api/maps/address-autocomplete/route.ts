import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

interface GoogleAutocompleteSuggestion {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
}

function getGoogleMapsKey() {
  return process.env.REACT_APP_GOOGLE_MAPS_API_KEY
    || process.env.GOOGLE_MAPS_SERVER_API_KEY
    || process.env.GOOGLE_API_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    || '';
}

export async function POST(request: Request) {
  const apiKey = getGoogleMapsKey();
  if (!apiKey) {
    return NextResponse.json({ error: 'Google Maps no está configurado.' }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { input?: unknown; sessionToken?: unknown } | null;
  const input = typeof body?.input === 'string' ? body.input.trim().slice(0, 180) : '';
  const sessionToken = typeof body?.sessionToken === 'string' ? body.sessionToken.slice(0, 100) : undefined;

  if (input.length < 3) return NextResponse.json({ suggestions: [] });

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify({
        input,
        languageCode: 'es',
        regionCode: 'MX',
        ...(sessionToken ? { sessionToken } : {}),
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const details = await response.text();
      console.error('[Google Address Autocomplete]', response.status, details.slice(0, 300));
      return NextResponse.json({
        error: response.status === 403
          ? 'Activa Places API (New) para buscar direcciones.'
          : 'Google no pudo completar la búsqueda en este momento.',
      }, { status: response.status === 403 ? 503 : 502 });
    }

    const payload = await response.json() as { suggestions?: GoogleAutocompleteSuggestion[] };
    const suggestions = (payload.suggestions || []).flatMap((suggestion) => {
      const prediction = suggestion.placePrediction;
      if (!prediction?.placeId || !prediction.text?.text) return [];
      return [{
        placeId: prediction.placeId,
        description: prediction.text.text,
        mainText: prediction.structuredFormat?.mainText?.text || prediction.text.text,
        secondaryText: prediction.structuredFormat?.secondaryText?.text || '',
      }];
    });

    return NextResponse.json({ suggestions }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('[Google Address Autocomplete]', error);
    return NextResponse.json({ error: 'No fue posible consultar Google Maps.' }, { status: 502 });
  }
}
