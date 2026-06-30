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

    const { message, userId, conversationHistory, systemPrompt } = body;

    // Validación del mensaje
    if (!message || typeof message !== "string" || message.trim() === "") {
      return NextResponse.json(
        { error: "El campo 'message' es requerido y debe ser un texto no vacío." },
        { status: 400 }
      );
    }

    // Validación opcional de conversationHistory si viene provisto
    if (conversationHistory !== undefined && !Array.isArray(conversationHistory)) {
      return NextResponse.json(
        { error: "El campo 'conversationHistory' debe ser un arreglo si está definido." },
        { status: 400 }
      );
    }

    // Castear el historial validando la estructura básica
    const typedHistory: ConversationMessage[] | undefined = conversationHistory
      ? conversationHistory.filter(
          (msg: any) =>
            msg &&
            typeof msg === "object" &&
            (msg.role === "user" || msg.role === "assistant") &&
            typeof msg.content === "string"
        )
      : undefined;

    // Ejecutar llamada a GeminiService
    const reply = await GeminiService.generateAvatarResponse({
      message,
      userId: typeof userId === "string" ? userId : undefined,
      conversationHistory: typedHistory,
      systemPrompt: typeof systemPrompt === "string" ? systemPrompt : undefined,
    });

    return NextResponse.json({
      reply,
      provider: "gemini",
      model: "gemini-2.5-flash",
    });
  } catch (error: any) {
    console.error("[AvatarRoute] Error en el endpoint de Avatar:", error);
    
    return NextResponse.json(
      { 
        error: error?.message || "Ocurrió un error interno en el servidor." 
      },
      { status: 500 }
    );
  }
}
