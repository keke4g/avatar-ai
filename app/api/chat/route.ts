import Groq from "groq-sdk";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

let groqClient: Groq | null = null;

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY no está configurada.");
  }

  groqClient ??= new Groq({ apiKey });
  return groqClient;
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!value || typeof value !== "object") return false;

  const message = value as Record<string, unknown>;
  return (
    (message.role === "system" || message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.trim().length > 0 &&
    message.content.length <= 4_000
  );
}

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

    const rawMessages = (body as Record<string, unknown>).mensajes;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0 || rawMessages.length > 30) {
      return Response.json(
        { error: "'mensajes' debe contener entre 1 y 30 mensajes." },
        { status: 400 },
      );
    }

    if (!rawMessages.every(isChatMessage)) {
      return Response.json(
        { error: "El formato de los mensajes no es válido." },
        { status: 400 },
      );
    }

    const completion = await getGroqClient().chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: rawMessages.slice(-20),
      temperature: 0.7,
      stream: true,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const text = chunk.choices[0]?.delta?.content || "";
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (error) {
          console.error("[Chat API] Error transmitiendo respuesta:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[Chat API] Error generando respuesta:", error);
    return Response.json(
      { error: "No fue posible generar una respuesta." },
      { status: 500 },
    );
  }
}
