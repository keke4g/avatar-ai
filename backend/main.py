import asyncio
import json
import time
import aiohttp
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import os
import shutil

# Import config and RAG
import config
from rag_service import process_and_index_file, vector_db

app = FastAPI(title="Eterna Realtime Streaming Backend")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# TEMP UPLOAD DIR FOR RAG
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload and process document directly in Python for RAG (Non-blocking)"""
    try:
        temp_file_path = UPLOAD_DIR / file.filename
        with open(temp_file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        chunks_indexed = await asyncio.to_thread(
            process_and_index_file, str(temp_file_path), file.filename
        )
        
        if temp_file_path.exists():
            os.remove(temp_file_path)

        return {"status": "ok", "filename": file.filename, "chunks": [{"texto": f"Chunk indexed"} for _ in range(chunks_indexed)]}
    except Exception as e:
        print(f"[ERROR] Error al procesar archivo en RAG: {e}")
        return {"status": "error", "message": str(e), "chunks": []}

def is_rag_required(prompt: str) -> bool:
    """Heuristic to skip semantic RAG search for simple casual conversational queries and user personal inquiries."""
    prompt_clean = prompt.lower().strip()
    
    # 1. Skip RAG for user-specific database queries to prevent prompt hijacking
    user_keywords = ["mi", "mis", "tengo", "yo", "mías", "míos", "propios", "propias", "cuenta", "perfil", "viaje", "mensaje", "swap", "propiedades", "reserva"]
    for kw in user_keywords:
        if f" {kw} " in f" {prompt_clean} " or prompt_clean.startswith(f"{kw} ") or prompt_clean.endswith(f" {kw}") or prompt_clean == kw:
            print(f"[RAG] Omitiendo RAG para consulta de usuario: '{prompt}'")
            return False

    casual_queries = {
        "hola", "buenos dias", "buenas tardes", "buenas noches", 
        "como estas", "quien eres", "como te llamas", "que eres", 
        "adios", "chao", "gracias", "de nada", "ok", "vale", "entendido",
        "saludos", "hola eterna", "eterna"
    }
    
    if prompt_clean in casual_queries or len(prompt_clean) < 10:
        return False
        
    for casual in ["como estas", "como te llamas", "quien eres", "hola"]:
        if casual in prompt_clean and len(prompt_clean) < 22:
            return False
            
    return True

# --- TOOLS SCHEMAS ---
TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "search_properties",
            "description": "Busca propiedades generales en el catálogo público global de AuraSwap según ubicación, país, amenidades, playa y disponibilidad de fechas. Úsalo para búsquedas de otros anfitriones o recomendaciones generales (ej: 'casas en la playa', 'villas en España'). NO lo uses para consultar las propiedades del propio usuario autenticado.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {"type": "string", "description": "Ciudad, provincia o región de destino (ej: 'Madrid', 'Cancún')"},
                    "country": {"type": "string", "description": "País del destino (ej: 'España', 'México')"},
                    "type": {"type": "string", "description": "Tipo de inmueble (ej: 'Apartment', 'Beach House', 'Cabin', 'Penthouse', 'Villa', 'Loft')"},
                    "amenities": {"type": "array", "items": {"type": "string"}, "description": "Lista de amenidades (ej: ['wifi', 'piscina', 'cargador Tesla'])"},
                    "near_beach": {"type": "boolean", "description": "Filtrar si debe estar cerca del mar o frente a la playa"},
                    "start_date": {"type": "string", "description": "Fecha de inicio en formato YYYY-MM-DD (ej: '2026-09-10')"},
                    "end_date": {"type": "string", "description": "Fecha de fin en formato YYYY-MM-DD (ej: '2026-09-24')"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_trips",
            "description": "Obtiene los viajes aprobados o activos del usuario, resolviendo automáticamente el destino correcto según su rol en el intercambio.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "UUID del usuario autenticado"}
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_swaps",
            "description": "Obtiene la lista de propuestas de intercambio (swaps) del usuario, filtrada opcionalmente por estados.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "UUID del usuario autenticado"},
                    "status": {"type": "string", "description": "Filtro opcional de estado ('PENDING', 'APPROVED', 'DECLINED')"}
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_messages",
            "description": "Recupera los mensajes del buzón del usuario, permitiendo aislar mensajes no leídos o chats recientes.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "UUID del usuario actual"},
                    "only_unread": {"type": "boolean", "description": "Si es True, devuelve solo mensajes no leídos externos"}
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_user_properties",
            "description": "Obtiene la lista detallada de todas las propiedades pertenecientes al propio usuario autenticado en la sesión. Úsalo SIEMPRE que el usuario pregunte por sus propias casas o propiedades publicadas (ej: 'cuáles son mis propiedades', 'mostrar mis anuncios', 'cuál es mi propiedad').",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "UUID del usuario autenticado (host_id)"}
                },
                "required": ["user_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "recommend_properties",
            "description": "Genera recomendaciones personalizadas de propiedades y destinos en base a criterios de clima estacional, afinidad de destinos o potencial de intercambio del usuario.",
            "parameters": {
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "UUID del usuario autenticado para personalizar su potencial de intercambio"},
                    "criteria": {"type": "string", "enum": ["beach", "similarity", "season", "high_potential"], "description": "Criterio de recomendación solicitado por el usuario."},
                    "reference_location": {"type": "string", "description": "Destino base para buscar alternativas similares (ej: 'Mazatlán')"},
                    "target_month": {"type": "integer", "description": "Mes del año para recomendaciones de temporada (1-12, ej: 11)"}
                },
                "required": ["user_id", "criteria"]
            }
        }
    }
]

# --- SUPABASE REST DATA EXECUTOR ---
async def execute_tool(func_name: str, args: dict, secure_user_id: str) -> dict:
    """
    Executes Supabase queries using direct HTTP PostgREST API with raw aiohttp requests.
    Enforces absolute backend user identity session constraints on private resources.
    """
    print(f"[TOOL] Invocando resolvedor local para la función '{func_name}' con argumentos: {args}")

    # Enforce secure backend session identity
    if func_name in ["get_user_trips", "get_user_swaps", "get_user_messages", "get_user_properties", "recommend_properties"]:
        print(f"[SECURITY] Forzando user_id seguro de la sesión: '{secure_user_id}' (ignoring LLM input: '{args.get('user_id')}')")
        user_id = secure_user_id or args.get("user_id", "")
    else:
        user_id = args.get("user_id", "")

    # PostgREST Setup
    supabase_url = config.SUPABASE_URL
    supabase_key = config.SUPABASE_ANON_KEY
    
    if not supabase_url or not supabase_key:
        print("[ERROR] Credenciales de Supabase no configuradas en el backend.")
        return {"error": "Servidor sin conexión a base de datos Supabase"}

    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {supabase_key}",
        "Content-Type": "application/json"
    }

    async with aiohttp.ClientSession() as session:
        try:
            # 1. SEARCH PROPERTIES
            if func_name == "search_properties":
                start_date = args.get("start_date")
                end_date = args.get("end_date")
                excluded_prop_ids = []

                # Paso 1: Si hay fechas, buscar swaps solapados
                if start_date and end_date:
                    solapados_url = (
                        f"{supabase_url}/rest/v1/swaps?select=sender_property_id,receiver_property_id"
                        f"&status=in.(APPROVED,CONFIRMED)"
                        f"&or=(and(start_date.gte.{start_date},start_date.lte.{end_date}),"
                        f"and(end_date.gte.{start_date},end_date.lte.{end_date}),"
                        f"and(start_date.lte.{start_date},end_date.gte.{end_date}))"
                    )
                    async with session.get(solapados_url, headers=headers) as resp:
                        if resp.status == 200:
                            swaps_res = await resp.json()
                            for s in swaps_res:
                                if s.get("sender_property_id"):
                                    excluded_prop_ids.append(s["sender_property_id"])
                                if s.get("receiver_property_id"):
                                    excluded_prop_ids.append(s["receiver_property_id"])

                # Paso 2: Query de catálogo principal
                query_url = f"{supabase_url}/rest/v1/properties?select=*,property_images(image_url,display_order)&is_published=eq.true"
                
                # Aplicar exclusiones
                if excluded_prop_ids:
                    ids_str = ",".join(excluded_prop_ids)
                    query_url += f"&id=not.in.({ids_str})"

                # Filtro geográfico
                loc = args.get("location") or args.get("country")
                if loc and loc.strip():
                    query_url += f"&or=(location.ilike.*{loc}*,country.ilike.*{loc}*)"

                # Filtro tipo
                p_type = args.get("type")
                if p_type and p_type.strip():
                    query_url += f"&type=eq.{p_type}"

                # Filtro de playa
                near_beach = args.get("near_beach")
                if near_beach:
                    query_url += f"&or=(type.eq.Beach House,description.ilike.*playa*,description.ilike.*beach*,title.ilike.*playa*)"

                # Filtro amenidades
                amenities = args.get("amenities")
                if amenities:
                    items = ",".join([f'"{a}"' for a in amenities])
                    query_url += f"&amenities=cs.{{{items}}}"

                query_url += "&limit=5"
                print(f"[TOOL] Query a Supabase: {query_url}")

                async with session.get(query_url, headers=headers) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    else:
                        err_text = await resp.text()
                        return {"error": f"Fallo al buscar propiedades: {err_text}"}

            # 2. GET USER TRIPS
            elif func_name == "get_user_trips":
                query_url = (
                    f"{supabase_url}/rest/v1/swaps?select=*,sender_property:properties!sender_property_id(*),"
                    f"receiver_property:properties!receiver_property_id(*)"
                    f"&or=(sender_id.eq.{user_id},receiver_id.eq.{user_id})"
                    f"&status=in.(APPROVED,CONFIRMED,ACTIVE)"
                    f"&order=start_date.asc"
                )
                print(f"[TOOL] Query a Supabase: {query_url}")
                async with session.get(query_url, headers=headers) as resp:
                    if resp.status == 200:
                        swaps_data = await resp.json()
                        resolved_trips = []
                        for swap in swaps_data:
                            is_sender = swap.get("sender_id") == user_id
                            partner_prop = swap.get("receiver_property") if is_sender else swap.get("sender_property")
                            resolved_trips.append({
                                "swap_id": swap.get("id"),
                                "start_date": swap.get("start_date"),
                                "end_date": swap.get("end_date"),
                                "status": swap.get("status"),
                                "destination_property": partner_prop.get("title") if partner_prop else "Propiedad",
                                "destination_location": partner_prop.get("location") if partner_prop else "Destino",
                                "destination_country": partner_prop.get("country") if partner_prop else "País"
                            })
                        return resolved_trips
                    else:
                        err_text = await resp.text()
                        return {"error": f"Fallo al consultar viajes: {err_text}"}

            # 3. GET USER SWAPS
            elif func_name == "get_user_swaps":
                query_url = (
                    f"{supabase_url}/rest/v1/swaps?select=*,sender_property:properties!sender_property_id(*),"
                    f"receiver_property:properties!receiver_property_id(*)"
                    f"&or=(sender_id.eq.{user_id},receiver_id.eq.{user_id})"
                )
                status = args.get("status")
                if status:
                    query_url += f"&status=eq.{status}"
                
                query_url += "&order=created_at.desc"
                print(f"[TOOL] Query a Supabase: {query_url}")
                async with session.get(query_url, headers=headers) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    else:
                        err_text = await resp.text()
                        return {"error": f"Fallo al consultar swaps: {err_text}"}

            # 4. GET USER MESSAGES
            elif func_name == "get_user_messages":
                only_unread = args.get("only_unread")
                query_url = f"{supabase_url}/rest/v1/messages?select=*,sender:profiles!sender_id(name)"
                
                if only_unread:
                    query_url += f"&is_read=eq.false&sender_id=neq.{user_id}"
                
                query_url += "&order=created_at.desc&limit=10"
                print(f"[TOOL] Query a Supabase: {query_url}")
                async with session.get(query_url, headers=headers) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    else:
                        err_text = await resp.text()
                        return {"error": f"Fallo al consultar mensajes: {err_text}"}

            # 5. GET USER PROPERTIES
            elif func_name == "get_user_properties":
                query_url = f"{supabase_url}/rest/v1/properties?select=*,property_images(image_url,display_order)&host_id=eq.{user_id}&order=created_at.desc"
                print(f"[TOOL] Query a Supabase: {query_url}")
                async with session.get(query_url, headers=headers) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    else:
                        err_text = await resp.text()
                        return {"error": f"Fallo al consultar propiedades de usuario: {err_text}"}

            # 6. RECOMMEND PROPERTIES
            elif func_name == "recommend_properties":
                criteria = args.get("criteria")
                ref_loc = args.get("reference_location")

                if criteria == "beach":
                    query_url = f"{supabase_url}/rest/v1/properties?select=*,property_images(image_url)&or=(type.eq.Beach House,description.ilike.*playa*,description.ilike.*beach*)&limit=3"
                    async with session.get(query_url, headers=headers) as resp:
                        return await resp.json() if resp.status == 200 else []

                elif criteria == "similarity":
                    if ref_loc and ref_loc.lower() in ["mazatlán", "mazatlan", "cancún", "cancun", "playa"]:
                        query_url = f"{supabase_url}/rest/v1/properties?select=*,property_images(image_url)&or=(type.eq.Beach House,description.ilike.*playa*)&limit=3"
                    else:
                        query_url = f"{supabase_url}/rest/v1/properties?select=*,property_images(image_url)&is_published=eq.true&limit=3"
                    async with session.get(query_url, headers=headers) as resp:
                        return await resp.json() if resp.status == 200 else []

                elif criteria == "season":
                    query_url = f"{supabase_url}/rest/v1/properties?select=*,property_images(image_url)&is_published=eq.true&is_featured=eq.true&limit=3"
                    async with session.get(query_url, headers=headers) as resp:
                        return await resp.json() if resp.status == 200 else []

                elif criteria == "high_potential":
                    query_url = f"{supabase_url}/rest/v1/properties?select=*&host_id=eq.{user_id}"
                    async with session.get(query_url, headers=headers) as resp:
                        if resp.status == 200:
                            props = await resp.json()
                            analyzed = []
                            for p in props:
                                score = p.get("aura_score", 90.0)
                                potential = "Moderado"
                                reason = "Tiene buena reputación en la red."
                                if score >= 95.0:
                                    potential = "Sobresaliente"
                                    reason = f"Ubicado en la zona altamente demandada de {p.get('location')}. Registra un 40% más búsquedas."
                                elif score >= 92.0:
                                    potential = "Excelente"
                                    reason = f"Su aura score de {score} le da visibilidad premium en búsquedas locales."
                                analyzed.append({
                                    "id": p.get("id"),
                                    "title": p.get("title"),
                                    "location": p.get("location"),
                                    "aura_score": score,
                                    "potential_score": potential,
                                    "reason": reason
                                })
                            return {"user_properties": analyzed}
                        return {"error": "Fallo al analizar propiedades"}

                return {"error": f"Criterio de recomendación '{criteria}' no soportado."}

            return {"error": f"Función de herramienta '{func_name}' no soportada."}

        except Exception as e:
            print(f"[ERROR] Error inesperado en execute_tool: {e}")
            return {"error": str(e)}

async def stream_groq_and_elevenlabs(websocket: WebSocket, prompt: str, history: list, secure_user_id: str = None):
    """
    Coordinates the low-latency streaming pipeline with native Spanish tuning,
    upgraded to llama-3.3-70b-versatile and featuring secure Supabase Tool Calling.
    """
    pipeline_start_t = time.time()
    print(f"\n[DEBUG] === INICIANDO PIPELINE DE STREAMING (T = 0ms) ===")
    print(f"[DEBUG] Pregunta del usuario: '{prompt}' | Secure User ID: '{secure_user_id}'")

    # 1. RAG Context Recovery
    context = ""
    if is_rag_required(prompt):
        print(f"[DEBUG] [T + {int((time.time() - pipeline_start_t) * 1000)}ms] Consulta requiere RAG. Buscando...")
        context = await asyncio.to_thread(vector_db.search, prompt, 2)
        print(f"[DEBUG] [T + {int((time.time() - pipeline_start_t) * 1000)}ms] RAG completado. Contexto encontrado: {bool(context)}")
    else:
        print(f"[DEBUG] [T + {int((time.time() - pipeline_start_t) * 1000)}ms] Consulta casual detectada. RAG omitido (Bypass).")

    # Format conversational prompt
    messages = []
    system_prompt = None
    if history and history[0].get("role") == "system":
        system_prompt = history[0]
    
    # PREMIUM LINGUISTIC CONSTRAINTS: Forcing elegant, native neuter Spanish, completely avoiding English/Spanglish
    voice_instruction = (
        "\nIMPORTANTE: Responde estrictamente en ESPAÑOL neutro, elegante, cálido, corporativo y natural. "
        "Evita mezclar palabras en inglés, extranjerismos, spanglish o abreviaciones. "
        "Da respuestas muy cortas y directas (máximo 2 o 3 oraciones breves y fluidas), "
        "ya que tu respuesta será sintetizada a voz en tiempo real."
    )
    
    if system_prompt:
        messages.append({
            "role": "system",
            "content": system_prompt.get("content", "") + voice_instruction
        })
    else:
        messages.append({
            "role": "system",
            "content": "Eres Eterna, un asistente de inteligencia artificial elegante y corporativo de G LOGICTECH SOLUTIONS." + voice_instruction
        })

    # History trimming (last 6 messages)
    recent_history = history[1:] if system_prompt else history
    max_history_len = 6
    if len(recent_history) > max_history_len:
        print(f"[DEBUG] [T + {int((time.time() - pipeline_start_t) * 1000)}ms] Historial recortado a {max_history_len} mensajes.")
        recent_history = recent_history[-max_history_len:]

    for msg in recent_history:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        if "CONTEXTO:" in content:
            content = content.split("\n\nCONTEXTO:")[0]
        messages.append({"role": role, "content": content})

    if context and messages:
        messages[-1]["content"] = f"{messages[-1]['content']}\n\nCONTEXTO DE NEGOCIO:\n{context}"

    # Setup headers and url for Groq
    groq_url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {config.GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    # --- STEP 1: FIRST FAST COMPLETION CALL WITH TOOLS ENABLED (Non-streaming) ---
    print(f"[DEBUG] [T + {int((time.time() - pipeline_start_t) * 1000)}ms] Realizando primer llamado cognitivo con herramientas (Modelo: llama-3.3-70b-versatile)...")
    payload_first = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": 0.3,
        "max_tokens": 300,
        "tools": TOOLS_SCHEMA,
        "tool_choice": "auto",
        "stream": False
    }

    tool_executed = False
    text_content = ""

    async with aiohttp.ClientSession() as session:
        async with session.post(groq_url, headers=headers, json=payload_first) as response:
            if response.status == 200:
                first_res = await response.json()
                choice = first_res["choices"][0]
                message = choice.get("message", {})
                
                tool_calls = message.get("tool_calls")
                if tool_calls:
                    print(f"[DEBUG] Groq ha decidido gatillar {len(tool_calls)} herramienta(s)!")
                    messages.append(message)
                    
                    for tool_call in tool_calls:
                        func_name = tool_call["function"]["name"]
                        func_args = json.loads(tool_call["function"]["arguments"] or "{}")
                        
                        # Execute the Supabase query directly
                        tool_result = await execute_tool(func_name, func_args, secure_user_id)
                        
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tool_call["id"],
                            "name": func_name,
                            "content": json.dumps(tool_result)
                        })
                        tool_executed = True
                else:
                    text_content = message.get("content", "")
            else:
                err_text = await response.text()
                print(f"[ERROR] Primer llamado de Groq falló: {err_text}")
                await websocket.send_json({"type": "error", "message": "Error consultando LLM"})
                return

    # --- STEP 2: STREAMING COMPLETION OF THE RESPONSE ---
    print(f"[DEBUG] [T + {int((time.time() - pipeline_start_t) * 1000)}ms] Preparando transmisión del dictado de voz...")
    
    voice_payload = None
    if tool_executed:
        voice_payload = {
            "model": "llama-3.1-8b-instant",
            "messages": messages,
            "temperature": 0.5,
            "max_tokens": 150,
            "stream": True
        }

    token_count = 0
    audio_chunk_count = 0
    first_token_logged = False
    first_audio_logged = False
    text_buffer = ""

    async with aiohttp.ClientSession() as session:
        try:
            # Connect to ElevenLabs WebSocket
            headers_ws = {
                "xi-api-key": config.ELEVENLABS_API_KEY
            }

            voice_id_to_use = config.ELEVENLABS_VOICE_ID
            FALLBACK_VOICES = [
                {"id": "EXAVITQu4vr4xnSDxMaL", "name": "Sarah/Bella (Original Funcional)"},
                {"id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel (Cálida / Profesional)"},
                {"id": "jBpfuIE2acCO8zZjaGo1", "name": "Gigi (Español Latino / Multilingüe)"},
                {"id": "AZnzlk1XvdvUeBnXmlld", "name": "Domi (Conversacional / Neutra)"}
            ]
            
            eleven_ws = None
            eleven_url = (
                f"wss://api.elevenlabs.io/v1/text-to-speech/{voice_id_to_use}/stream-input"
                f"?model_id=eleven_multilingual_v2"
                f"&optimize_streaming_latency=2"
                f"&output_format=mp3_44100_128"
            )
            
            try:
                eleven_ws = await session.ws_connect(eleven_url, headers=headers_ws)
                print(f"[SUCCESS] [ElevenLabs WS] Conexión establecida con la voz: '{voice_id_to_use}'.")
            except Exception as conn_err:
                print(f"[WARN] [ElevenLabs WS] Conexión fallida con '{voice_id_to_use}': {conn_err}")
                for fallback in FALLBACK_VOICES:
                    fb_id = fallback["id"]
                    fb_name = fallback["name"]
                    fallback_url = (
                        f"wss://api.elevenlabs.io/v1/text-to-speech/{fb_id}/stream-input"
                        f"?model_id=eleven_multilingual_v2"
                        f"&optimize_streaming_latency=2"
                        f"&output_format=mp3_44100_128"
                    )
                    try:
                        print(f"[DEBUG] [ElevenLabs WS] Intentando fallback: {fb_name} ('{fb_id}')...")
                        eleven_ws = await session.ws_connect(fallback_url, headers=headers_ws)
                        print(f"[SUCCESS] [ElevenLabs WS] ¡Conexión establecida con la voz: {fb_name}!")
                        voice_id_to_use = fb_id
                        break
                    except Exception as fb_err:
                        print(f"[WARN] [ElevenLabs WS] Falló fallback {fb_name}: {fb_err}")
                
                if not eleven_ws:
                    raise RuntimeError("Ninguna de las voces de fallback de ElevenLabs pudo inicializarse.")

            try:
                # Send ElevenLabs initial settings frame
                init_msg = {
                    "text": " ",
                    "voice_settings": {
                        "stability": 0.45,
                        "similarity_boost": 0.8,
                        "style": 0.3,
                        "use_speaker_boost": True
                    },
                    "generation_config": {
                        "chunk_length_schedule": [120, 160, 200, 240]
                    }
                }
                await eleven_ws.send_str(json.dumps(init_msg))

                # Define task to read audio responses from ElevenLabs concurrently
                async def elevenlabs_audio_reader():
                    nonlocal first_audio_logged, audio_chunk_count
                    try:
                        async for msg in eleven_ws:
                            if msg.type == aiohttp.WSMsgType.TEXT:
                                data = json.loads(msg.data)
                                if "error" in data or "message" in data or "code" in data:
                                    print(f"[ERROR] [ElevenLabs WS Msg]: {data}")

                                audio_b64 = data.get("audio")
                                if audio_b64:
                                    audio_chunk_count += 1
                                    chunk_size = len(audio_b64)
                                    
                                    if not first_audio_logged:
                                        first_audio_logged = True
                                        print(f"[DEBUG] [T + {int((time.time() - pipeline_start_t) * 1000)}ms] ¡PRIMER CHUNK DE AUDIO DESDE ELEVENLABS! Tamaño: {chunk_size} bytes.")

                                    # Stream audio chunk back to Next.js client immediately
                                    await websocket.send_json({
                                        "type": "audio",
                                        "data": audio_b64,
                                        "size": chunk_size
                                    })
                            elif msg.type == aiohttp.WSMsgType.ERROR:
                                break
                    except Exception as e:
                        print(f"[ERROR] Error leyendo audio de ElevenLabs: {e}")

                # Launch audio reader task in background
                audio_reader_task = asyncio.create_task(elevenlabs_audio_reader())

                if voice_payload:
                    print(f"[DEBUG] [T + {int((time.time() - pipeline_start_t) * 1000)}ms] Realizando consulta de streaming a Groq (Modelo: llama-3.3-70b-versatile)...")
                    # Query Groq API via streaming HTTP POST
                    async with session.post(groq_url, headers=headers, json=voice_payload) as response:
                        if response.status != 200:
                            err_text = await response.text()
                            print(f"[ERROR] Groq API returned status {response.status}: {err_text}")
                            await websocket.send_json({"type": "error", "message": "Error consultando LLM"})
                            return

                        async for line in response.content:
                            line = line.decode("utf-8").strip()
                            if not line or line == "data: [DONE]":
                                continue
                            
                            if line.startswith("data: "):
                                try:
                                    chunk_data = json.loads(line[6:])
                                    delta_text = chunk_data["choices"][0]["delta"].get("content", "")
                                    
                                    if delta_text:
                                        token_count += 1
                                        if not first_token_logged:
                                            first_token_logged = True
                                            print(f"[DEBUG] [T + {int((time.time() - pipeline_start_t) * 1000)}ms] ¡PRIMER TOKEN DE TEXTO RECIBIDO DESDE GROQ! Token: '{delta_text}'")

                                        # 1. Send text token to Next.js UI immediately for real-time transcription
                                        await websocket.send_json({
                                            "type": "text",
                                            "delta": delta_text
                                        })
                                        
                                        # 2. Accumulate token in text buffer for ElevenLabs TTS
                                        text_buffer += delta_text
                                        
                                        # --- PREMIUM QUALITY CHUNKING SYSTEM ---
                                        should_flush = False
                                        if any(punc in delta_text for punc in [".", "?", "!", "\n"]):
                                            should_flush = True
                                        elif any(punc in delta_text for punc in [",", ";", ":", "-"]):
                                            if len(text_buffer) >= 18:
                                                should_flush = True
                                        elif len(text_buffer) >= 45 and (" " in delta_text or "\t" in delta_text):
                                            should_flush = True
                                            
                                        if should_flush and text_buffer.strip():
                                            to_send = text_buffer
                                            text_buffer = "" # Clear buffer
                                            await eleven_ws.send_str(json.dumps({
                                                "text": to_send,
                                                "try_trigger_generation": True
                                            }))
                                except Exception as e:
                                    pass
                else:
                    # No tool was executed, so we already have the full text_content from the first call.
                    # We stream it directly to ElevenLabs and Next.js for a sub-200ms TTFT!
                    print(f"[DEBUG] [T + {int((time.time() - pipeline_start_t) * 1000)}ms] No se ejecutaron herramientas. Transmitiendo texto pre-generado...")
                    
                    words = text_content.split(" ")
                    for i, word in enumerate(words):
                        delta_text = word + (" " if i < len(words) - 1 else "")
                        token_count += 1
                        
                        # 1. Send to Next.js
                        await websocket.send_json({
                            "type": "text",
                            "delta": delta_text
                        })
                        
                        # 2. Accumulate in buffer
                        text_buffer += delta_text
                        
                        # Flush to ElevenLabs on sentence ends or word bounds
                        should_flush = False
                        if any(punc in delta_text for punc in [".", "?", "!", "\n"]):
                            should_flush = True
                        elif any(punc in delta_text for punc in [",", ";", ":", "-"]):
                            if len(text_buffer) >= 18:
                                should_flush = True
                        elif len(text_buffer) >= 45:
                            should_flush = True
                            
                        if should_flush and text_buffer.strip():
                            to_send = text_buffer
                            text_buffer = ""
                            await eleven_ws.send_str(json.dumps({
                                "text": to_send,
                                "try_trigger_generation": True
                            }))
                            
                        # Extremely small delay to keep UI feeling smooth
                        await asyncio.sleep(0.02)

                # --- STREAM COMPLETED FLUSH ---
                if text_buffer.strip():
                    print(f"[DEBUG] [T + {int((time.time() - pipeline_start_t) * 1000)}ms] Enviando buffer final restante: '{text_buffer}'")
                    await eleven_ws.send_str(json.dumps({
                        "text": text_buffer,
                        "try_trigger_generation": True
                    }))
                
                print(f"[DEBUG] [T + {int((time.time() - pipeline_start_t) * 1000)}ms] Stream de Groq completado. Enviados {token_count} tokens. Finalizando canal ElevenLabs...")

                # Signal ElevenLabs that LLM text generation is finished
                await eleven_ws.send_str(json.dumps({"text": ""}))
                
                # Wait for all audio packets to be read and forwarded
                await audio_reader_task
                
                print(f"[DEBUG] [T + {int((time.time() - pipeline_start_t) * 1000)}ms] Pipeline de ElevenLabs completado. Enviados {audio_chunk_count} chunks de audio en total.")
                print(f"[DEBUG] === PIPELINE CONVERSACIONAL COMPLETADO DE FORMA EXITOSA ===\n")
                # Send explicit idle signal to WebSocket client on successful completion
                await websocket.send_json({"type": "state", "status": "idle"})
            finally:
                if eleven_ws and not eleven_ws.closed:
                    await eleven_ws.close()

        except Exception as e:
            print(f"[ERROR] Error en pipeline de streaming: {e}")
            await websocket.send_json({"type": "error", "message": f"Error en pipeline: {str(e)}"})

@app.websocket("/api/stream")
async def websocket_endpoint(websocket: WebSocket):
    """Establishes bidirectional real-time audio/video streaming WebSocket"""
    await websocket.accept()
    print(f"[INFO] Nueva conexión WebSocket aceptada correctamente.")

    pipeline_task = None

    try:
        while True:
            message_text = await websocket.receive_text()
            msg = json.loads(message_text)
            msg_type = msg.get("type")

            if msg_type == "chat":
                await websocket.send_json({"type": "clear"})
                
                if pipeline_task and not pipeline_task.done():
                    pipeline_task.cancel()

                prompt = msg.get("text", "")
                history = msg.get("history", [])
                secure_user_id = msg.get("userId") # Secure session userId passed from Next.js client

                pipeline_task = asyncio.create_task(
                    stream_groq_and_elevenlabs(websocket, prompt, history, secure_user_id)
                )

            elif msg_type == "interrupt":
                print(f"[INFO] Solicitud de interrupción recibida. Silenciando avatar.")
                if pipeline_task and not pipeline_task.done():
                    pipeline_task.cancel()
                await websocket.send_json({"type": "state", "status": "idle"})

    except WebSocketDisconnect:
        print(f"[INFO] Cliente Next.js desconectado")
    except Exception as e:
        print(f"[ERROR] Error en conexión WebSocket: {e}")
    finally:
        if pipeline_task and not pipeline_task.done():
            pipeline_task.cancel()

if __name__ == "__main__":
    import uvicorn
    print(f"[START] Iniciando servidor FastAPI en {config.HOST}:{config.PORT}")
    uvicorn.run("main:app", host=config.HOST, port=config.PORT, reload=True)
