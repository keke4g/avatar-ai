export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "El cuerpo debe ser JSON válido." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
      return Response.json({ error: "Petición inválida." }, { status: 400 });
    }

    const rawText = (body as Record<string, unknown>).texto;
    if (typeof rawText !== "string" || rawText.trim().length === 0 || rawText.length > 2_000) {
      return Response.json(
        { error: "'texto' debe contener entre 1 y 2,000 caracteres." },
        { status: 400 },
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Servicio de voz no configurado." }, { status: 503 });
    }

    const text = rawText.trim().split(".").slice(0, 3).join(".");
    const response = await fetch(
      "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL",
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_multilingual_v2",
          voice_settings: {
            stability: 0.45,
            similarity_boost: 0.8,
            style: 0.3,
            use_speaker_boost: true,
          },
        }),
      },
    );

    if (!response.ok) {
      console.error("[Voice API] ElevenLabs respondió con estado", response.status);
      return Response.json(
        { error: "El proveedor de voz no pudo procesar la solicitud." },
        { status: 502 },
      );
    }

    return new Response(await response.arrayBuffer(), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Voice API] Error generando audio:", error);
    return Response.json({ error: "Error de voz." }, { status: 500 });
  }
}
