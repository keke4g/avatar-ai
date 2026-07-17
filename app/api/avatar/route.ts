import { NextResponse } from "next/server";
import {
  ConversationMessage,
  GeminiService,
  getGeminiErrorStatus,
  isRetryableGeminiError,
} from "../../../lib/services/GeminiService";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get('x-vercel-id') || crypto.randomUUID();
  let resolvedMode = 'standard';
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

    const {
      message,
      userId,
      conversationHistory,
      systemPrompt,
      responseMode,
      currentSearchState,
      pageContext,
    } = body as Record<string, unknown>;
    resolvedMode = typeof responseMode === 'string' ? responseMode : 'standard';

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

    if (
      responseMode !== undefined
      && responseMode !== "standard"
      && responseMode !== "property_sales"
      && responseMode !== "search_concierge"
      && responseMode !== "page_agent"
    ) {
      return NextResponse.json(
        { error: "El campo 'responseMode' no es válido." },
        { status: 400 },
      );
    }

    if (responseMode === "page_agent") {
      if (
        pageContext !== undefined
        && (!pageContext || typeof pageContext !== "object" || JSON.stringify(pageContext).length > 60_000)
      ) {
        return NextResponse.json(
          { error: "El contexto actual de la página no es válido." },
          { status: 400 },
        );
      }

      const { result: pageResponse, model } = await GeminiService.generatePageAgentResponse({
        message: message.trim(),
        conversationHistory: typedHistory,
        systemPrompt: typeof systemPrompt === "string" ? systemPrompt : undefined,
        pageContext,
      });

      console.info(JSON.stringify({
        level: 'info',
        message: 'Eterna response completed',
        route: '/api/avatar',
        requestId,
        mode: resolvedMode,
        model,
        durationMs: Date.now() - startedAt,
      }));

      return NextResponse.json({
        ...pageResponse,
        provider: "gemini",
        model,
        durationMs: Date.now() - startedAt,
      });
    }

    if (responseMode === "property_sales") {
      const { result: salesResponse, model } = await GeminiService.generatePropertySalesResponse({
        message: message.trim(),
        conversationHistory: typedHistory,
        systemPrompt: typeof systemPrompt === "string" ? systemPrompt : undefined,
      });

      return NextResponse.json({
        ...salesResponse,
        provider: "gemini",
        model,
      });
    }

    if (responseMode === "search_concierge") {
      if (
        currentSearchState !== undefined
        && (!currentSearchState || typeof currentSearchState !== "object" || JSON.stringify(currentSearchState).length > 10_000)
      ) {
        return NextResponse.json(
          { error: "El estado actual de búsqueda no es válido." },
          { status: 400 },
        );
      }

      const { result: searchResponse, model } = await GeminiService.analyzeSearchConversation({
        message: message.trim(),
        conversationHistory: typedHistory,
        systemPrompt: typeof systemPrompt === "string" ? systemPrompt : undefined,
        currentSearchState,
      });

      return NextResponse.json({
        ...searchResponse,
        provider: "gemini",
        model,
      });
    }

    // Ejecutar llamada a GeminiService
    const { result: reply, model } = await GeminiService.generateAvatarResponse({
      message: message.trim(),
      userId: typeof userId === "string" ? userId.slice(0, 128) : undefined,
      conversationHistory: typedHistory,
      systemPrompt: typeof systemPrompt === "string" ? systemPrompt : undefined,
    });

    return NextResponse.json({
      reply,
      provider: "gemini",
      model,
    });
  } catch (error: unknown) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Eterna response failed',
      route: '/api/avatar',
      requestId,
      mode: resolvedMode,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    }));

    const retryable = isRetryableGeminiError(error);
    const upstreamStatus = getGeminiErrorStatus(error);

    return NextResponse.json(
      {
        error: retryable
          ? "Eterna está recibiendo una alta demanda temporal. Intenta nuevamente en unos segundos."
          : "Eterna no pudo procesar la solicitud en este momento.",
        code: retryable ? "AI_TEMPORARILY_UNAVAILABLE" : "AI_REQUEST_FAILED",
        retryable,
        upstreamStatus,
      },
      { status: retryable ? 503 : 500 }
    );
  }
}
