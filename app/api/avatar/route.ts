import { NextResponse } from "next/server";
import { GeminiService, ConversationMessage } from "../../../lib/services/GeminiService";

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "El cuerpo de la petición debe ser un JSON válido." },
        { status: 400 }
      );
    }

    const { message, userId, conversationHistory, systemPrompt } = body as Record<string, unknown>;

    // Validación del mensaje
    if (typeof message !== "string" || message.trim() === "" || message.length > 4_000) {
      return NextResponse.json(
        { error: "El campo 'message' debe contener entre 1 y 4,000 caracteres." },
        { status: 400 }
      );
    }

    // Validación opcional de conversationHistory si viene provisto
    if (conversationHistory !== undefined && (!Array.isArray(conversationHistory) || conversationHistory.length > 30)) {
      return NextResponse.json(
        { error: "El campo 'conversationHistory' debe ser un arreglo si está definido." },
        { status: 400 }
      );
    }

    // Castear el historial validando la estructura básica
    const typedHistory: ConversationMessage[] | undefined = Array.isArray(conversationHistory)
      ? conversationHistory.filter(
          (msg: unknown): msg is ConversationMessage => {
            if (!msg || typeof msg !== "object") return false;
            const candidate = msg as Record<string, unknown>;
            return (
              (candidate.role === "user" || candidate.role === "assistant") &&
              typeof candidate.content === "string" &&
              candidate.content.length <= 4_000
            );
          }
        )
        .slice(-20)
      : undefined;

    if (systemPrompt !== undefined && (typeof systemPrompt !== "string" || systemPrompt.length > 20_000)) {
      return NextResponse.json(
        { error: "El campo 'systemPrompt' no es válido o es demasiado largo." },
        { status: 400 },
      );
    }

    // Ejecutar llamada a GeminiService
    const reply = await GeminiService.generateAvatarResponse({
      message: message.trim(),
      userId: typeof userId === "string" ? userId.slice(0, 128) : undefined,
      conversationHistory: typedHistory,
      systemPrompt: typeof systemPrompt === "string" ? systemPrompt : undefined,
    });

    return NextResponse.json({
      reply,
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
  } catch (error: unknown) {
    console.error("[AvatarRoute] Error en el endpoint de Avatar:", error);
    
    return NextResponse.json(
      { 
        error: "Ocurrió un error interno en el servidor."
      },
      { status: 500 }
    );
  }
}
