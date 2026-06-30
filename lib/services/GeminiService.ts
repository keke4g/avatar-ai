import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.warn(
    "[GeminiService] Warning: GOOGLE_API_KEY is not defined in the environment variables."
  );
}

// Inicializar la instancia del cliente Gemini
const genAI = new GoogleGenerativeAI(apiKey || "");

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export class GeminiService {
  /**
   * Genera una respuesta usando el modelo gemini-2.5-flash.
   * 
   * @param params Parámetros de entrada para la generación de contenido.
   *   - message: Mensaje actual del usuario.
   *   - userId: ID opcional del usuario (para personalización o auditoría futura).
   *   - conversationHistory: Historial de la conversación. En esta fase se acepta de forma estructurada pero actúa como placeholder.
   *   - systemPrompt: Instrucción de sistema personalizada.
   */
  static async generateAvatarResponse(params: {
    message: string;
    userId?: string;
    conversationHistory?: ConversationMessage[];
    systemPrompt?: string;
  }): Promise<string> {
    const systemInstruction =
      params.systemPrompt ||
      "Eres Aura, el asistente inteligente de AuraSwap. Ayudas a usuarios con intercambios de propiedades, rentas temporales, rentas mensuales, compra y venta de inmuebles. Responde de forma profesional, clara y amigable. Mantén respuestas concisas cuando sea posible.";

    // Instanciar el modelo con la instrucción de sistema
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction,
    });

    // Implementación de Timeout de 20 segundos
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Gemini API request timed out after 20 seconds"));
      }, 20000);
      
      // Asegurarse de que el timer de Node no mantenga el proceso colgado en scripts de backend
      if (timer.unref) {
        timer.unref();
      }
    });

    try {
      // Marcador para futura implementación de streaming:
      // const responseStream = await model.generateContentStream({ contents: ... });
      // for await (const chunk of responseStream.stream) { ... }

      // Marcador de historial de conversación:
      // En el futuro, conversationHistory (del tipo ConversationMessage[]) se puede transformar 
      // a la estructura de Gemini { role: 'user' | 'model', parts: [{ text: string }] } 
      // y concatenarse antes de params.message.
      
      const responsePromise = model.generateContent({
        contents: [
          { role: "user", parts: [{ text: params.message }] }
        ]
      });

      // Carrera entre la promesa de la API y el timeout
      const result = await Promise.race([responsePromise, timeoutPromise]);
      
      const responseText = result.response.text();
      return responseText;
    } catch (error) {
      console.error("[GeminiService] Error generating response:", error);
      throw error;
    }
  }
}
