import { NextResponse } from 'next/server';
import {
  extractTerritorialPropertyContext,
  getTerritorialIntelligenceContext,
} from '@/lib/territory/TerritorialIntelligenceService';
import {
  guardRequest,
  inputErrorResponse,
  normalizePlainText,
  readJsonObject,
} from '@/lib/security/requestSecurity';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const blocked = guardRequest(request, { limit: 20, windowMs: 60_000, maxBodyBytes: 20_000 });
  if (blocked) return blocked;

  try {
    const body = await readJsonObject(request, 20_000);
    const query = typeof body.query === 'string' ? normalizePlainText(body.query, 1_000) : '';
    if (query.length < 3) {
      return NextResponse.json({ error: 'Escribe una consulta territorial válida.' }, { status: 400 });
    }

    const propertyContext = extractTerritorialPropertyContext(body.propertyContext);
    const context = await getTerritorialIntelligenceContext({ query, propertyContext });
    return NextResponse.json(context, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    const inputResponse = inputErrorResponse(error);
    if (inputResponse) return inputResponse;
    console.error('[TerritorialIntelligence] Insight request failed.', error);
    return NextResponse.json(
      { error: 'No fue posible preparar la inteligencia territorial en este momento.' },
      { status: 503 },
    );
  }
}
