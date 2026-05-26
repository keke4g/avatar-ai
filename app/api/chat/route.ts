import Groq from "groq-sdk";

const groq =
  new Groq({

    apiKey:
      process.env.GROQ_API_KEY,

  });

export async function POST(
  req: Request
) {

  try {

    const body =
      await req.json();

    const mensajes =
      body.mensajes || [];

    const completion =
      await groq.chat.completions.create({

        model:
          "llama-3.3-70b-versatile",

        messages:
          mensajes,

        temperature: 0.7,

        stream: true,

      });

    const encoder =
      new TextEncoder();

    const stream =
      new ReadableStream({

        async start(
          controller
        ) {

          for await (
            const chunk
            of completion
          ) {

            const texto =

              chunk.choices[0]
                ?.delta?.content ||
              "";

            controller.enqueue(

              encoder.encode(
                texto
              )

            );

          }

          controller.close();

        },

      });

    return new Response(
      stream
    );

  } catch (error) {

    console.log(error);

    return new Response(
      "Error"
    );

  }

}