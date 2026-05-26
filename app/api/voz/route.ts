export const runtime =
  "nodejs";

export async function POST(
  req: Request
) {

  try {

    const body =
      await req.json();

    const texto =
      body.texto;

    const response =
      await fetch(

        "https://api.elevenlabs.io/v1/text-to-speech/EXAVITQu4vr4xnSDxMaL",

        {

          method: "POST",

          headers: {

            Accept:
              "audio/mpeg",

            "Content-Type":
              "application/json",

            "xi-api-key":
              process.env
                .ELEVENLABS_API_KEY || "",

          },

          body: JSON.stringify({

            text: texto,

            model_id:
              "eleven_multilingual_v2",

            voice_settings: {

              stability:
                0.45,

              similarity_boost:
                0.75,

            },

          }),

        }

      );

    // DEBUG ERROR

    if (!response.ok) {

      const errorText =
        await response.text();

      console.log(
        "ELEVEN ERROR:",
        errorText
      );

      return new Response(

        errorText,

        {

          status: 500,

        }

      );

    }

    const audioBuffer =
      await response.arrayBuffer();

    return new Response(

      audioBuffer,

      {

        headers: {

          "Content-Type":
            "audio/mpeg",

        },

      }

    );

  } catch (error) {

    console.log(error);

    return new Response(

      "Error de voz",

      {

        status: 500,

      }

    );

  }

}