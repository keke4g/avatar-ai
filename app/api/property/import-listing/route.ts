import { NextResponse } from 'next/server';
import {
  parsePropertyListingLocally,
  type PropertyListingImportResult,
} from '../../../../lib/propertyImport/propertyListingImport';
import { GeminiService } from '../../../../lib/services/GeminiService';

export const runtime = 'nodejs';

const MIN_SOURCE_LENGTH = 20;
const MAX_SOURCE_LENGTH = 12_000;

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'El texto del anuncio no tiene un formato válido.' },
      { status: 400 },
    );
  }

  const sourceText =
    body && typeof body === 'object' && typeof (body as Record<string, unknown>).text === 'string'
      ? ((body as Record<string, unknown>).text as string).trim()
      : '';

  if (sourceText.length < MIN_SOURCE_LENGTH) {
    return NextResponse.json(
      { error: 'Pega un anuncio con al menos 20 caracteres para poder analizarlo.' },
      { status: 400 },
    );
  }

  if (sourceText.length > MAX_SOURCE_LENGTH) {
    return NextResponse.json(
      { error: `El anuncio no puede superar ${MAX_SOURCE_LENGTH.toLocaleString('es-MX')} caracteres.` },
      { status: 400 },
    );
  }

  try {
    const { result, model } = await GeminiService.extractPropertyListing({ sourceText });
    return NextResponse.json({
      result,
      provider: 'gemini',
      model,
    });
  } catch (error: unknown) {
    console.warn('[PropertyImport API] Gemini no estuvo disponible; se usará el analizador local.', {
      message: error instanceof Error ? error.message : String(error),
    });

    const result: PropertyListingImportResult = parsePropertyListingLocally(sourceText);
    return NextResponse.json({
      result,
      provider: 'local_fallback',
      model: 'auraswap-local-parser',
    });
  }
}
