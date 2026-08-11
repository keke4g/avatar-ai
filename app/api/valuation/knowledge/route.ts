import { NextResponse } from 'next/server';
import { searchOfficialValuationKnowledge } from '../../../../lib/valuation/OfficialValuationKnowledgeService';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const body = await request.json() as { query?: unknown; limit?: unknown };
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    if (query.length < 3 || query.length > 500) {
      return NextResponse.json({ error: 'Consulta inválida.' }, { status: 400 });
    }

    const requestedLimit = Number(body.limit);
    const matches = await searchOfficialValuationKnowledge(
      query,
      Number.isFinite(requestedLimit) ? requestedLimit : 4,
    );
    return NextResponse.json({
      matches,
      sources: [...new Map(matches.map((match) => [match.sourceCode, {
        code: match.sourceCode,
        name: match.sourceName,
        url: match.sourceUrl,
      }])).values()],
    });
  } catch (error) {
    console.error('[ValuationKnowledge] Search failed.', error);
    return NextResponse.json({ matches: [], sources: [] }, { status: 200 });
  }
}
