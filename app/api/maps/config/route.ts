import { NextResponse } from 'next/server';

export const revalidate = 300;

export async function GET() {
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    || process.env.NEXT_PUBLIC_GOOGLE_API_KEY
    || '';

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Maps no está configurado.' },
      { status: 503, headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } },
    );
  }

  return NextResponse.json(
    { apiKey },
    { headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' } },
  );
}
