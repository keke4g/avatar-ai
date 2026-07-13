import type { EternaVoiceEngine } from '../../../lib/eterna/voiceConfig';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Voz creada con Voice Design a partir de una hablante nativa mexicana.
// Se mantiene configurable por entorno para poder sustituirla sin desplegar código.
const ELEVENLABS_DEFAULT_VOICE_ID = 'kgQd0MAjT5cJrslRkNYB'; // Eterna México Ejecutiva
const MAX_TEXT_LENGTH = 1_200;

function escapeXml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function audioResponse(buffer: ArrayBuffer, contentType: string) {
  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function synthesizeWithElevenLabs(text: string) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ElevenLabs no está configurado.' }, { status: 503 });
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || ELEVENLABS_DEFAULT_VOICE_ID;
  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_64`,
    {
      method: 'POST',
      headers: {
        Accept: 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2_5',
        language_code: 'es',
        voice_settings: {
          stability: 0.48,
          similarity_boost: 0.84,
          // Style y speaker boost agregan procesamiento y latencia. La voz ya
          // fue diseñada con el tono profesional que necesita Eterna.
          style: 0,
          speed: 1.03,
          use_speaker_boost: false,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok || !response.body) {
    console.error('[Voice API] ElevenLabs respondió con estado', response.status);
    return Response.json({ error: 'ElevenLabs no pudo generar la voz.' }, { status: 502 });
  }

  // Reenvía cada fragmento apenas llega. La calidad no cambia, pero se evita
  // esperar y copiar el MP3 completo dentro de la función de Vercel.
  return new Response(response.body, {
    headers: {
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Voice-Engine': 'elevenlabs',
    },
  });
}

async function synthesizeWithAzure(text: string) {
  const apiKey = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!apiKey || !region) {
    return Response.json({ error: 'Azure Speech no está configurado.' }, { status: 503 });
  }

  const ssml = [
    '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"',
    ' xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="es-MX">',
    '<voice name="es-MX-DaliaNeural">',
    '<prosody rate="0%" pitch="+1st">',
    escapeXml(text),
    '</prosody></voice></speak>',
  ].join('');

  const response = await fetch(
    `https://${encodeURIComponent(region)}.tts.speech.microsoft.com/cognitiveservices/v1`,
    {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
        'User-Agent': 'AuraSwap-Eterna',
      },
      body: ssml,
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok) {
    console.error('[Voice API] Azure Speech respondió con estado', response.status);
    return Response.json({ error: 'Azure Speech no pudo generar la voz.' }, { status: 502 });
  }

  return audioResponse(await response.arrayBuffer(), 'audio/mpeg');
}

async function synthesizeWithDeepgram(text: string, voiceProfile: 'executive' | 'mexico') {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Deepgram no está configurado.' }, { status: 503 });
  }

  const voiceModel = process.env.DEEPGRAM_VOICE_MODEL || (
    voiceProfile === 'mexico' ? 'aura-2-estrella-es' : 'aura-2-diana-es'
  );
  const response = await fetch(
    `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(voiceModel)}&encoding=linear16&sample_rate=24000`,
    {
      method: 'POST',
      headers: {
        Accept: 'audio/l16',
        Authorization: `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(15_000),
    },
  );

  if (!response.ok || !response.body) {
    console.error('[Voice API] Deepgram respondió con estado', response.status);
    return Response.json({ error: 'Deepgram no pudo generar la voz.' }, { status: 502 });
  }

  // PCM lineal permite que el cliente programe cada fragmento inmediatamente,
  // sin depender de un contenedor MP3 incompleto.
  return new Response(response.body, {
    headers: {
      'Content-Type': 'audio/L16;rate=24000;channels=1',
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'X-Voice-Engine': 'deepgram',
      'X-Voice-Format': 'pcm_s16le_24000',
    },
  });
}

export async function GET() {
  return Response.json(
    {
      engines: {
        elevenlabs: { configured: Boolean(process.env.ELEVENLABS_API_KEY) },
        deepgram: { configured: Boolean(process.env.DEEPGRAM_API_KEY) },
        azure: { configured: Boolean(process.env.AZURE_SPEECH_KEY && process.env.AZURE_SPEECH_REGION) },
        browser: { configured: true },
      },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: Request) {
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
    const deepgramVoiceProfile = payload.deepgramVoiceProfile === 'mexico' ? 'mexico' : 'executive';

    if (typeof rawText !== 'string' || rawText.trim().length === 0 || rawText.length > MAX_TEXT_LENGTH) {
      return Response.json(
        { error: `'texto' debe contener entre 1 y ${MAX_TEXT_LENGTH.toLocaleString('es-MX')} caracteres.` },
        { status: 400 },
      );
    }

    if (engine !== 'elevenlabs' && engine !== 'azure' && engine !== 'deepgram') {
      return Response.json({ error: 'Motor de voz no compatible con esta ruta.' }, { status: 400 });
    }

    const text = rawText.trim();
    if (engine === 'azure') return await synthesizeWithAzure(text);
    if (engine === 'deepgram') return await synthesizeWithDeepgram(text, deepgramVoiceProfile);
    return await synthesizeWithElevenLabs(text);
  } catch (error) {
    const isTimeout = error instanceof Error && error.name === 'TimeoutError';
    console.error('[Voice API] Error generando audio:', isTimeout ? 'timeout' : error);
    return Response.json(
      { error: isTimeout ? 'El motor de voz tardó demasiado en responder.' : 'Error de voz.' },
      { status: isTimeout ? 504 : 500 },
    );
  }
}
