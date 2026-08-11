import type { EternaVoiceEngine } from '../../../lib/eterna/voiceConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Voz pública “Mujer”: español latinoamericano, profesional y cercana.
// Puede sustituirse por una voz propia/licenciada mediante el entorno.
const FISH_AUDIO_DEFAULT_VOICE_ID = '5e816f5a0658460b960881a24733c418';
const FISH_AUDIO_DEFAULT_MODEL = 's2.1-pro-free';
const FISH_AUDIO_SAMPLE_RATE = 24_000;
const MAX_TEXT_LENGTH = 1_200;

type FishLatency = 'low' | 'balanced' | 'normal';

function getFishLatency(): FishLatency {
  const configured = process.env.FISH_AUDIO_LATENCY?.trim().toLowerCase();
  return configured === 'balanced' || configured === 'normal' ? configured : 'low';
}

async function synthesizeWithFishAudio(text: string) {
  const apiKey = process.env.FISH_AUDIO_API_KEY || process.env.FISH_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Fish Audio no está configurado.' }, { status: 503 });
  }

  const voiceId = process.env.FISH_AUDIO_VOICE_ID || FISH_AUDIO_DEFAULT_VOICE_ID;
  const model = process.env.FISH_AUDIO_MODEL?.trim() || FISH_AUDIO_DEFAULT_MODEL;
  const latency = getFishLatency();
  const upstreamStartedAt = Date.now();
  const response = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      Accept: 'audio/pcm',
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      model,
    },
    body: JSON.stringify({
      text,
      reference_id: voiceId,
      // PCM elimina el contenedor MP3 y permite reproducir cada fragmento
      // apenas llega, sin esperar a descargar la respuesta completa.
      format: 'pcm',
      sample_rate: FISH_AUDIO_SAMPLE_RATE,
      latency,
      normalize: true,
      chunk_length: 100,
      min_chunk_length: 40,
      temperature: 0.65,
      top_p: 0.7,
      repetition_penalty: 1.2,
      condition_on_previous_chunks: true,
      prosody: {
        speed: 0.96,
        volume: 0,
        normalize_loudness: true,
      },
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok || !response.body) {
    console.error('[Voice API] Fish Audio respondió con estado', response.status);
    return Response.json({ error: 'Fish Audio no pudo generar la voz.' }, { status: 502 });
  }

  return new Response(response.body, {
    headers: {
      'Content-Type': `audio/L16;rate=${FISH_AUDIO_SAMPLE_RATE};channels=1`,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Voice-Engine': 'fishaudio',
      'X-Voice-Format': `pcm_s16le_${FISH_AUDIO_SAMPLE_RATE}`,
      'X-Voice-Model': model,
      'Server-Timing': `fish;dur=${Date.now() - upstreamStartedAt}`,
    },
  });
}

export async function GET() {
  return Response.json(
    {
      engines: {
        fishaudio: { configured: Boolean(process.env.FISH_AUDIO_API_KEY || process.env.FISH_API_KEY) },
        browser: { configured: true },
      },
      primary: 'fishaudio',
      fallback: 'browser',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: Request) {
  const startedAt = Date.now();
  const requestId = req.headers.get('x-vercel-id');
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'El cuerpo debe ser JSON válido.' }, { status: 400 });
    }

    if (!body || typeof body !== 'object') {
      return Response.json({ error: 'Petición inválida.' }, { status: 400 });
    }

    const payload = body as Record<string, unknown>;
    const rawText = payload.texto;
    const engine = payload.engine as EternaVoiceEngine;

    if (typeof rawText !== 'string' || rawText.trim().length === 0 || rawText.length > MAX_TEXT_LENGTH) {
      return Response.json(
        { error: `'texto' debe contener entre 1 y ${MAX_TEXT_LENGTH.toLocaleString('es-MX')} caracteres.` },
        { status: 400 },
      );
    }

    if (engine !== 'fishaudio') {
      return Response.json({ error: 'Esta ruta solo sintetiza con Fish Audio.' }, { status: 400 });
    }

    const text = rawText.trim();
    console.log(JSON.stringify({
      level: 'info',
      message: 'Voice synthesis started',
      route: '/api/voz',
      requestId,
      engine,
    }));

    const response = await synthesizeWithFishAudio(text);
    console.log(JSON.stringify({
      level: 'info',
      message: 'Voice synthesis headers ready',
      route: '/api/voz',
      requestId,
      engine,
      status: response.status,
      durationMs: Date.now() - startedAt,
    }));
    return response;
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    console.error(JSON.stringify({
      level: 'error',
      message: 'Voice synthesis failed',
      route: '/api/voz',
      requestId,
      error: isTimeout ? 'timeout' : error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startedAt,
    }));
    return Response.json(
      { error: isTimeout ? 'Fish Audio tardó demasiado en responder.' : 'Error de voz.' },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
