import { ElevenLabsClient } from "elevenlabs";

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
});

export async function POST(req: Request) {

  try {

    const body = await req.json();

    const texto = body.texto;

    const audio =
      await elevenlabs.textToSpeech.convert(

        "EXAVITQu4vr4xnSDxMaL",

        {
          text: texto,
          model_id: "eleven_multilingual_v2",
        }

      );

    const chunks = [];

    for await (const chunk of audio) {
      chunks.push(chunk);
    }

    const audioBuffer = Buffer.concat(chunks);

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });

  } catch (error) {

    console.log(error);

    return Response.json({
      error: "Error con ElevenLabs",
    });

  }

}