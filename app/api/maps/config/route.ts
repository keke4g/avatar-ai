import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    || '';

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Maps no está configurado.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json(
    { apiKey },
    { headers: { 'Cache-Control': 'private, max-age=300' } },
  );
}

