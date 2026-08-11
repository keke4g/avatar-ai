"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";

export type StreamStatus = "disconnected" | "connected" | "listening" | "thinking" | "talking" | "idle";

export function useWebSocketStream() {
  const [status, setStatus] = useState<StreamStatus>("disconnected");
  const [textResponse, setTextResponse] = useState("");
  const [isConnected, setIsConnected] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  
  // Latency & Debug Timestamps
  const pipelineStartRef = useRef<number>(0);
  const firstAudioReceivedRef = useRef<boolean>(false);


  // Audio Queue management using Web Audio API for gapless playback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([]);

  // Initialize Audio Context with robust state checks
  const initAudioContext = async () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        nextStartTimeRef.current = audioCtxRef.current.currentTime;
        console.log("[DEBUG] [AudioContext] Inicializado por primera vez. Estado actual:", audioCtxRef.current.state);
      }
      
      if (audioCtxRef.current.state === "suspended") {
        console.log("[DEBUG] [AudioContext] Estado suspendido detectado. Reanudando...");
        await audioCtxRef.current.resume();
        console.log("[DEBUG] [AudioContext] Estado tras reanudación:", audioCtxRef.current.state);
      }
    } catch (e) {
      console.error("[DEBUG] [AudioContext] Error al inicializar context:", e);
    }
  };

  // Play audio chunk gaplessly with precise debug logs
  const playAudioChunk = async (base64Data: string, chunkSize: number) => {
    try {
      await initAudioContext();
      
      if (!audioCtxRef.current) {
        console.warn("[DEBUG] [AudioContext] No se pudo reproducir: Context nulo.");
        return;
      }

      const elapsed = Date.now() - pipelineStartRef.current;
      console.log(`[DEBUG] [T + ${elapsed}ms] Decodificando chunk de audio (${chunkSize} bytes)...`);

      // Decode base64 to ArrayBuffer
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const arrayBuffer = bytes.buffer;

      // Asynchronous decoding in browser
      audioCtxRef.current.decodeAudioData(
        arrayBuffer,
        (buffer) => {
          if (!audioCtxRef.current) return;
          
          const source = audioCtxRef.current.createBufferSource();
          source.buffer = buffer;
          source.connect(audioCtxRef.current.destination);

          // Calculate start time to chain buffers gaplessly
          const currentTime = audioCtxRef.current.currentTime;
          let startTime = nextStartTimeRef.current;

          if (startTime < currentTime) {
            // New speech turn or queue starved: delay the start of the first chunk
            // by 200ms (safety look-ahead buffer) to absorb network/decoding jitter!
            startTime = currentTime + 0.20;
            console.log(`[DEBUG] [Audio Queue] Cola vacía. Aplicando look-ahead buffer de 200ms.`);
          }

          source.start(startTime);
          nextStartTimeRef.current = startTime + buffer.duration;

          const scheduledIn = (startTime - currentTime).toFixed(3);
          const decElapsed = Date.now() - pipelineStartRef.current;
          console.log(
            `[DEBUG] [T + ${decElapsed}ms] ¡Chunk de audio programado con éxito! ` +
            `Se reproducirá en ${scheduledIn}s. Duración del fragmento: ${buffer.duration.toFixed(3)}s. ` +
            `Próxima ranura en cola: ${nextStartTimeRef.current.toFixed(3)}s.`
          );

          // Track playing source so we can stop it on interrupt
          audioSourcesRef.current.push(source);
          source.onended = () => {
            audioSourcesRef.current = audioSourcesRef.current.filter((s) => s !== source);
            if (audioSourcesRef.current.length === 0 && status === "talking") {
              setStatus("idle");
              console.log("[DEBUG] [Audio Queue] Todos los chunks de audio han terminado de reproducirse. Estado a 'idle'.");
            }
          };
        },
        (error) => {
          console.error("[DEBUG] [AudioContext] Error decodificando audio data:", error);
        }
      );
    } catch (err) {
      console.error("[DEBUG] [AudioContext] Fallo de parsing en chunk de audio:", err);
    }
  };

  // Stop all playing audio instantly
  const stopAllAudio = () => {
    console.log("[DEBUG] [Audio Context] Deteniendo toda la reproducción de audio actual.");
    audioSourcesRef.current.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Source might have already stopped
      }
    });
    audioSourcesRef.current = [];
    if (audioCtxRef.current) {
      nextStartTimeRef.current = audioCtxRef.current.currentTime;
    }
  };

  // Connect to the WebSocket server
  const connect = async (url: string) => {
    if (
      socketRef.current &&
      socketRef.current.url === url &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      console.log("[DEBUG] [WebSocket] Ya se encuentra activo o conectando. Reutilizando.");
      setIsConnected(socketRef.current.readyState === WebSocket.OPEN);
      setStatus(socketRef.current.readyState === WebSocket.OPEN ? "idle" : "connected");
      return;
    }

    if (socketRef.current) {
      console.log("[DEBUG] [WebSocket] Cerrando conexión WebSocket obsoleta.");
      socketRef.current.close();
    }

    await initAudioContext();
    setStatus("connected");

    console.log("[DEBUG] [WebSocket] Creando conexión con:", url);
    const ws = new WebSocket(url);
    socketRef.current = ws;

    ws.onopen = () => {
      if (socketRef.current === ws) {
        setIsConnected(true);
        setStatus("idle");
        console.log("[DEBUG] [WebSocket] ¡Conexión con Eterna Backend abierta correctamente!");
      }
    };

    ws.onmessage = async (event) => {
      if (socketRef.current !== ws) return;

      try {
        const msg = JSON.parse(event.data);

        switch (msg.type) {
          case "state":
            console.log("[DEBUG] Cambio de estado recibido desde servidor:", msg.status);
            setStatus(msg.status);
            break;

          case "text":
            setTextResponse((prev) => prev + msg.delta);
            break;

          case "audio":
            const audioElapsed = Date.now() - pipelineStartRef.current;
            const size = msg.size || (msg.data ? msg.data.length : 0);
            
            if (!firstAudioReceivedRef.current) {
              firstAudioReceivedRef.current = true;
              console.log(
                `%c[DEBUG] [T + ${audioElapsed}ms] ¡¡PRIMER CHUNK DE AUDIO RECIBIDO EN CLIENTE!! Tamaño: ${size} bytes.`,
                "background: #10B981; color: #fff; padding: 4px; border-radius: 4px; font-weight: bold;"
              );
            }
            
            setStatus("talking");
            await playAudioChunk(msg.data, size);
            break;

          case "video":
            // Video frames are no longer used — VideoAvatar handles visuals via MP4 files
            break;

          case "clear":
            setTextResponse("");
            break;

          case "error":
            console.error("[DEBUG] Error de servidor recibido por WS:", msg.message);
            break;

          default:
            break;
        }
      } catch (err) {
        console.error("[DEBUG] Error procesando mensaje del WebSocket:", err);
      }
    };

    ws.onclose = () => {
      if (socketRef.current === ws) {
        setIsConnected(false);
        setStatus("disconnected");
        console.log("[DEBUG] [WebSocket] Conexión cerrada con Eterna Backend.");
      } else {
        console.log("[DEBUG] [WebSocket] WebSocket obsoleto cerrado silenciosamente.");
      }
    };

    ws.onerror = (error) => {
      console.error("[DEBUG] [WebSocket] Error de red detectado:", error);
      if (socketRef.current === ws) {
        setIsConnected(false);
        setStatus("disconnected");
      }
    };
  };

  // Disconnect from WebSocket
  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    stopAllAudio();
    setIsConnected(false);
    setStatus("disconnected");
  };
  const disconnectEvent = useEffectEvent(disconnect);

  // Send message to the backend
  const sendMessage = async (text: string, history: any[], userId?: string) => {
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.warn("[DEBUG] [WebSocket] Intento de envío denegado: socket no abierto.");
      return;
    }

    // Reset pipeline latency benchmarks
    pipelineStartRef.current = Date.now();
    firstAudioReceivedRef.current = false;
    
    console.log(`\n%c[DEBUG] === INICIANDO PIPELINE DE CHAT (T = 0ms) ===`, "background: #3B82F6; color: #fff; padding: 4px; border-radius: 4px; font-weight: bold;");
    console.log("[DEBUG] Enviando prompt:", text, "| Con User ID:", userId);

    await initAudioContext();
    stopAllAudio();
    setTextResponse("");
    setStatus("thinking");

    socketRef.current.send(
      JSON.stringify({
        type: "chat",
        text,
        history,
        userId,
      })
    );
  };

  // Interrupt/cancel talking
  const interrupt = () => {
    console.log("[DEBUG] [Interrupción] Enviando solicitud de silenciado al backend.");
    stopAllAudio();
    setStatus("idle");

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "interrupt",
        })
      );
    }
  };

  // Handle window tab close/unload cleanup
  useEffect(() => {
    const handleBeforeUnload = () => {
      disconnectEvent();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return {
    connect,
    disconnect,
    sendMessage,
    interrupt,
    status,
    textResponse,
    isConnected,
  };
}
