"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  buscarChunksRelevantes,
} from "../lib/rag";

declare global {

  interface Window {

    webkitSpeechRecognition:
      any;

    SpeechRecognition:
      any;

  }

}

type Mensaje = {

  role:
    | "system"
    | "user"
    | "assistant";

  content: string;

};

// =======================
// AUDIO GLOBAL
// =======================

let audioActual:
  HTMLAudioElement | null =
  null;

// =======================

export default function Home() {

  const [mensaje, setMensaje] =
    useState("");

  const [respuesta, setRespuesta] =
    useState("");

  const [hablando, setHablando] =
    useState(false);

  const [escuchando, setEscuchando] =
    useState(false);

  const [modoAuto, setModoAuto] =
    useState(false);

  const [audioLevel, setAudioLevel] =
    useState(0);

  const [
    archivoChunks,
    setArchivoChunks,
  ] = useState<any[]>([]);

  const [
    archivoNombre,
    setArchivoNombre,
  ] = useState("");

  const [historial, setHistorial] =
    useState<Mensaje[]>([]);

  const recognitionRef =
    useRef<any>(null);

  // =======================
  // MEMORIA
  // =======================

  useEffect(() => {

    const memoria =
      localStorage.getItem(
        "avatar_memoria"
      );

    if (memoria) {

      setHistorial(
        JSON.parse(memoria)
      );

    } else {

      setHistorial([
        {

          role: "system",

          content:
            "Eres una mujer ejecutiva elegante, inteligente y amable. Conversas de forma natural y humana.",

        },
      ]);

    }

  }, []);

  useEffect(() => {

    localStorage.setItem(

      "avatar_memoria",

      JSON.stringify(historial)

    );

  }, [historial]);

  // =======================
  // SPEECH RECOGNITION
  // =======================

  useEffect(() => {

    const SpeechRecognition =

      window.SpeechRecognition ||

      window.webkitSpeechRecognition;

    if (!SpeechRecognition)
      return;

    const recognition =
      new SpeechRecognition();

    recognition.lang = "es-MX";

    recognition.continuous =
      false;

    recognition.interimResults =
      false;

    recognition.onresult =
      async (event: any) => {

        const texto =
          event.results[0][0]
            .transcript;

        setMensaje(texto);

        setEscuchando(false);

        await enviarMensaje(
          texto
        );

      };

    recognition.onend = () => {

      setEscuchando(false);

    };

    recognitionRef.current =
      recognition;

  }, [historial]);

  // =======================
  // HABLAR
  // =======================

  async function hablarTexto(
    texto: string
  ) {

    try {

      const voz =
        await fetch(
          "/api/voz",
          {

            method: "POST",

            headers: {

              "Content-Type":
                "application/json",

            },

            body: JSON.stringify({

              texto,

            }),

          }
        );

      const audioBlob =
        await voz.blob();

      const audioUrl =
        URL.createObjectURL(
          audioBlob
        );

      const audio =
        new Audio(audioUrl);

      audioActual = audio;

      setHablando(true);

      audio.onplay = () => {

        const interval =
          setInterval(() => {

            setAudioLevel(
              Math.random() *
                80
            );

          }, 50);

        audio.onended =
          () => {

            clearInterval(
              interval
            );

            setAudioLevel(0);

            setHablando(false);

            if (modoAuto) {

              iniciarEscucha();

            }

          };

      };

      await audio.play();

    } catch (error) {

      console.log(error);

      setHablando(false);

    }

  }

  // =======================
  // CANCELAR IA
  // =======================

  function cancelarRespuesta() {

    setHablando(false);

    setAudioLevel(0);

    if (audioActual) {

      audioActual.pause();

      audioActual.currentTime =
        0;

    }

  }

  // =======================
  // ENVIAR MENSAJE
  // =======================

  async function enviarMensaje(
    textoManual?: string
  ) {

    cancelarRespuesta();

    const texto =
      textoManual || mensaje;

    if (!texto) return;

    setRespuesta("");

    const contextoDocumento =

      archivoChunks.length > 0

        ? buscarChunksRelevantes(
            texto,
            archivoChunks
          )

        : "";

    const nuevoHistorial = [

      ...historial,

      {

        role: "user",

        content:
          contextoDocumento.length > 0

            ? `${texto}

CONTEXTO:
${contextoDocumento}`

            : texto,

      },

    ];

    setHistorial(
      nuevoHistorial as Mensaje[]
    );

    const res = await fetch(
      "/api/chat",
      {

        method: "POST",

        headers: {

          "Content-Type":
            "application/json",

        },

        body: JSON.stringify({

          mensajes:
            nuevoHistorial,

        }),

      }
    );

    const reader =
      res.body?.getReader();

    const decoder =
      new TextDecoder();

    let textoCompleto = "";

    while (true) {

      const {
        done,
        value,
      } = await reader!.read();

      if (done) break;

      const chunk =
        decoder.decode(value);

      textoCompleto += chunk;

      setRespuesta(
        textoCompleto
      );

    }

    // =======================
    // HABLAR TODO AL FINAL
    // =======================

    await hablarTexto(
      textoCompleto
    );

    setHistorial((prev) => [

      ...prev,

      {

        role: "assistant",

        content:
          textoCompleto,

      },

    ]);

    setMensaje("");

  }

  // =======================
  // SUBIR ARCHIVO
  // =======================

  async function subirArchivo(
    e: any
  ) {

    const file =
      e.target.files[0];

    if (!file) return;

    setArchivoNombre(
      file.name
    );

    const formData =
      new FormData();

    formData.append(
      "file",
      file
    );

    const res = await fetch(
      "/api/upload",
      {

        method: "POST",

        body: formData,

      }
    );

    const data =
      await res.json();

    setArchivoChunks(
      data.chunks
    );

    alert(
      "Archivo cargado correctamente"
    );

  }

  // =======================
  // ESCUCHA
  // =======================

  function iniciarEscucha() {

    if (!recognitionRef.current)
      return;

    setEscuchando(true);

    recognitionRef.current.start();

  }

  function detenerEscucha() {

    if (!recognitionRef.current)
      return;

    recognitionRef.current.stop();

    setEscuchando(false);

  }

  function toggleAutoMode() {

    const nuevoModo =
      !modoAuto;

    setModoAuto(
      nuevoModo
    );

    if (nuevoModo) {

      iniciarEscucha();

    } else {

      detenerEscucha();

    }

  }

  return (

    <main className="min-h-screen bg-[#eef2f7] flex flex-col items-center justify-center p-8 overflow-hidden relative">

      {/* =======================
      AVATAR
      ======================= */}

      <div className="relative z-10 mb-10">

        {/* GLOW */}

        <div

          className={`

            absolute

            inset-[-60px]

            rounded-full

            pointer-events-none

            transition-all

            duration-300

            blur-3xl

            ${
              hablando

                ? "opacity-100"

                : "opacity-0"

            }

          `}

          style={{

            background: `
              radial-gradient(
                circle,
                rgba(34,197,94,0.95) 0%,
                rgba(34,197,94,0.55) 35%,
                rgba(34,197,94,0.18) 60%,
                rgba(34,197,94,0) 80%
              )
            `,

            transform: `
              scale(${
                1 + audioLevel / 300
              })
            `,

          }}

        />

        {/* CIRCULO */}

        <div

          className="relative w-[430px] h-[430px] rounded-full overflow-hidden border-[10px] border-white shadow-[0_20px_80px_rgba(0,0,0,0.12)]"

        >

          {/* IDLE */}

          <video

            src="/videos/idle.mp4"

            autoPlay

            loop

            muted

            playsInline

            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              hablando
                ? "opacity-0"
                : "opacity-100"
            }`}

          />

          {/* TALKING */}

          <video

            src="/videos/talking.mp4"

            autoPlay

            loop

            muted

            playsInline

            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
              hablando
                ? "opacity-100"
                : "opacity-0"
            }`}

          />

        </div>

      </div>

      {/* ARCHIVO */}

      {archivoNombre && (

        <div className="relative z-10 mb-5 bg-green-100 text-green-700 px-6 py-3 rounded-2xl shadow-lg">

          Archivo:
          {" "}
          {archivoNombre}

        </div>

      )}

      {/* =======================
      INPUT AURORA
      ======================= */}

      <div className="relative z-10 w-full max-w-5xl">

        {/* BORDE */}

        <div className="absolute inset-0 rounded-[42px] aurora-border overflow-hidden" />

        {/* CONTENEDOR */}

        <div className="relative bg-white/70 backdrop-blur-2xl rounded-[40px] overflow-hidden border border-white/40">

          {/* TEXTAREA */}

          <textarea

            value={mensaje}

            onChange={(e) =>
              setMensaje(
                e.target.value
              )
            }

            placeholder="Escribe o habla..."

            className="w-full h-44 bg-transparent p-8 text-2xl outline-none text-black resize-none"

          />

          {/* DIVISIÓN */}

          <div className="absolute right-24 top-6 bottom-6 w-[1px] bg-black/10" />

          {/* CANCELAR */}

          <button

            onClick={
              cancelarRespuesta
            }

            className="absolute right-6 top-1/2 -translate-y-1/2 w-14 h-14 rounded-2xl bg-red-500 hover:bg-red-600 active:scale-90 transition-all duration-200 flex items-center justify-center shadow-lg"

          >

            <span className="text-white text-3xl font-bold">

              ×

            </span>

          </button>

        </div>

      </div>

      {/* BOTONES */}

      <div className="relative z-10 flex gap-6 mt-8 flex-wrap justify-center">

        <button

          onClick={() =>
            enviarMensaje()
          }

          className="px-10 py-5 rounded-3xl text-2xl text-white bg-gradient-to-r from-blue-500 to-blue-600 shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"

        >

          Enviar

        </button>

        <button

          onClick={() => {

            if (escuchando) {

              detenerEscucha();

            } else {

              iniciarEscucha();

            }

          }}

          className="px-10 py-5 rounded-3xl text-2xl text-white bg-gradient-to-r from-green-400 to-emerald-500 shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"

        >

          {escuchando
            ? "Escuchando..."
            : "Hablar"}

        </button>

        <button

          onClick={
            toggleAutoMode
          }

          className="px-10 py-5 rounded-3xl text-2xl text-white bg-gradient-to-r from-cyan-400 to-sky-500 shadow-xl hover:scale-105 active:scale-95 transition-all duration-200"

        >

          {modoAuto
            ? "Modo Auto ON"
            : "Modo Auto OFF"}

        </button>

        <label className="px-10 py-5 rounded-3xl text-2xl text-white bg-gradient-to-r from-purple-400 to-fuchsia-500 shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer">

          Subir Archivo

          <input

            type="file"

            hidden

            onChange={
              subirArchivo
            }

          />

        </label>

      </div>

      {/* RESPUESTA */}

      <div className="relative z-10 mt-10 w-full max-w-5xl bg-white/50 backdrop-blur-2xl border border-white/60 rounded-[40px] p-10 shadow-[0_10px_40px_rgba(0,0,0,0.08)]">

        <h2 className="text-4xl font-bold mb-6 text-zinc-800">

          Respuesta

        </h2>

        <p className="text-2xl leading-relaxed text-zinc-700 whitespace-pre-wrap">

          {respuesta}

        </p>

      </div>

    </main>

  );

}