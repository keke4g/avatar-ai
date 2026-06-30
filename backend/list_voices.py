import requests
import json
from pathlib import Path
import os

# Import config to get ELEVENLABS_API_KEY
import sys
sys.path.append(str(Path(__file__).resolve().parent))
import config

def fetch_and_list_voices():
    print("=" * 70)
    print("  CONSULTANDO VOCES DISPONIBLES EN TU CUENTA DE ELEVENLABS  ")
    print("=" * 70)
    
    api_key = config.ELEVENLABS_API_KEY
    if not api_key:
        print("[ERROR] ELEVENLABS_API_KEY no configurada en config.py ni .env.local")
        return
        
    url = "https://api.elevenlabs.io/v1/voices"
    headers = {
        "xi-api-key": api_key,
        "Accept": "application/json"
    }
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code != 200:
            if response.status_code == 401 or "missing_permissions" in response.text:
                print(f"[WARN] Tu API Key carece de permisos de lectura ('voices_read') para consultar la lista dinámica.")
                print("[INFO] Esto es normal en API Keys con alcances restringidos. Aún así, tu cuenta puede generar TTS.")
                print("\n[INFO] Lista de voces pre-diseñadas estándar garantizadas en todas las cuentas de ElevenLabs:")
                print(f"{'Voice ID':<25} | {'Nombre':<15} | {'Descripción / Idioma'}")
                print("-" * 80)
                premade_voices = [
                    {"id": "EXAVITQu4vr4xnSDxMaL", "name": "Sarah/Bella", "desc": "Original Funcional (Español Multilingüe)"},
                    {"id": "21m00Tcm4TlvDq8ikWAM", "name": "Rachel", "desc": "Cálida y Profesional"},
                    {"id": "AZnzlk1XvdvUeBnXmlld", "name": "Domi", "desc": "Conversacional / Neutra"},
                    {"id": "jBpfuIE2acCO8zZjaGo1", "name": "Gigi", "desc": "Español Latino (Premade)"}
                ]
                for pv in premade_voices:
                    print(f"{pv['id']:<25} | {pv['name']:<15} | {pv['desc']}")
            else:
                print(f"[ERROR] ElevenLabs API retornó estado {response.status_code}: {response.text}")
            return
            
        data = response.json()
        voices = data.get("voices", [])
        
        if not voices:
            print("[WARN] No se encontraron voces asociadas a esta cuenta.")
            return
            
        print(f"[SUCCESS] Se encontraron {len(voices)} voces disponibles:\n")
        
        # Display voices in a clean structured format
        print(f"{'Voice ID':<25} | {'Nombre':<15} | {'Categoría':<12} | {'Etiquetas/Descripción'}")
        print("-" * 90)
        
        for voice in voices:
            voice_id = voice.get("voice_id", "N/A")
            name = voice.get("name", "N/A")
            category = voice.get("category", "N/A")
            
            # Extract some tags or description labels
            labels = voice.get("labels", {})
            description = ", ".join([f"{k}:{v}" for k, v in labels.items()]) if labels else "Sin etiquetas"
            if len(description) > 40:
                description = description[:37] + "..."
                
            print(f"{voice_id:<25} | {name:<15} | {category:<12} | {description}")
            
    except Exception as e:
        print(f"[ERROR] Ocurrió un error al contactar la API de ElevenLabs: {e}")
        
    print("=" * 70)

if __name__ == "__main__":
    fetch_and_list_voices()
