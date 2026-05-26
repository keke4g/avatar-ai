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

        "https://api.cartesia.ai/tts/bytes",

        {

          method: "POST",

          headers: {

            "Content-Type":
              "application/json",

            "X-API-Key":
              process.env
                .CARTESIA_API_KEY || "",

            "Cartesia-Version":
              "2024-06-10",

          },

          body: JSON.stringify({

            model_id:
              "sonic-multilingual",

            transcript:
              texto,

            voice: {

              mode: "id",

              id:
                "156fb8d2-335b-4950-9cb3-a2d33befec77",

            },

            language:
              "es",

            output_format: {

              container:
                "mp3",

              encoding:
                "mp3",

              sample_rate:
                44100,

            },

          }),

        }

      );

    if (!response.ok) {

      const error =
        await response.text();

      console.log(
        "CARTESIA ERROR:",
        error
      );

      return new Response(

        error,

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