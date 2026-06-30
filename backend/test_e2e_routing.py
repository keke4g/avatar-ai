import asyncio
import aiohttp
import json
import sys
import os

# Christian's user id in the platform
USER_ID = "3d1e778b-d750-417c-b661-92b4aa113277"

async def test_groq_tool_routing(prompt: str):
    print(f"\n==========================================")
    print(f"PROMPT: '{prompt}'")
    print(f"==========================================")
    
    groq_api_key = os.getenv GROQ_API_KEY = os.getenv("GROQ_API_KEY")
    groq_url = "https://api.groq.com/openai/v1/chat/completions"
    
    headers = {
        "Authorization": f"Bearer {groq_api_key}",
        "Content-Type": "application/json"
    }
    
    # Import TOOLS_SCHEMA from backend/main.py
    sys.path.append("c:/Users/crist/Desktop/avatar-ai/backend")
    from main import TOOLS_SCHEMA
    
    system_prompt = (
        "Eres Eterna, la Concierge IA de Lujo y anfitriona virtual oficial de AuraSwap.\n"
        "Tu propósito es asistir con extrema elegancia, calidez y profesionalidad a el usuario en su viaje.\n"
        "REGLAS DE BÚSQUEDA Y HERRAMIENTAS:\n"
        "1. Tienes acceso a herramientas reales conectadas a Supabase.\n"
        "2. Si el usuario te pide buscar, ver o recomendar propiedades del catálogo general de AuraSwap (ej: 'Muéstrame casas en la playa', 'Recomiéndame una villa', '¿Qué propiedades hay en España?'), DEBES llamar a 'search_properties' o 'recommend_properties' con los parámetros correspondientes.\n"
        "3. Si el usuario te pide propiedades cerca del mar o en la playa, DEBES pasar el parámetro 'near_beach' como True en la llamada a la herramienta.\n"
        "4. Si el usuario te pregunta por SUS PROPIAS propiedades (ej: 'mis propiedades', 'las casas que tengo publicadas', '¿cuántas propiedades tengo?'), DEBES llamar a 'get_user_properties' con su 'user_id' correspondiente.\n"
        "5. Si el usuario te pregunta por SUS PROPIOS viajes o reservas (ej: 'mis viajes', '¿cuál es mi próximo viaje?'), DEBES llamar a 'get_user_trips' con su 'user_id'.\n"
        "6. Si el usuario te pregunta por SUS PROPIOS intercambios/swaps o propuestas de intercambio, DEBES llamar a 'get_user_swaps' con su 'user_id'.\n"
        "7. Si el usuario te pregunta por SUS PROPIOS mensajes o conversaciones, DEBES llamar a 'get_user_messages' con su 'user_id'.\n"
        "8. NUNCA alucines ni inventes propiedades.\n"
        "---\n"
        f"DATOS DE LA CUENTA DEL USUARIO: {{\"user\":\"Christian\",\"userId\":\"{USER_ID}\",\"propertiesCount\":3,\"activeTripsCount\":1}}"
    )
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": prompt}
    ]
    
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 300,
        "tools": TOOLS_SCHEMA,
        "tool_choice": "auto",
        "stream": False
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(groq_url, headers=headers, json=payload) as response:
            if response.status == 200:
                res = await response.json()
                message = res["choices"][0]["message"]
                tool_calls = message.get("tool_calls")
                
                if tool_calls:
                    print("HERRAMIENTA SELECCIONADA POR GROQ:")
                    for tc in tool_calls:
                        print(f"  - Nombre: {tc['function']['name']}")
                        print(f"  - Argumentos: {tc['function']['arguments']}")
                else:
                    print("No se seleccionó ninguna herramienta. Respuesta de texto directo:")
                    print(f"  - {message.get('content')}")
            else:
                text = await response.text()
                print(f"Error {response.status}: {text}")

async def main():
    # Load .env.local
    from config import load_env_local
    load_env_local()
    
    queries = [
        "¿Cuáles son mis propiedades?",
        "Muéstrame casas en la playa",
        "¿Cuál es mi próximo viaje?",
        "Recomiéndame algo similar a Mazatlán"
    ]
    
    for q in queries:
        await test_groq_tool_routing(q)
        await asyncio.sleep(1)

if __name__ == "__main__":
    asyncio.run(main())
