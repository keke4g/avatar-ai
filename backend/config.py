import os
from pathlib import Path

# Base Directory path
BASE_DIR = Path(__file__).resolve().parent.parent

# Load .env.local and override variables to be 100% certain
def load_env_local():
    env_local_path = BASE_DIR / ".env.local"
    print(f"[DEBUG] [Config] Intentando cargar archivo de variables desde: {env_local_path.resolve()}")
    if env_local_path.exists():
        try:
            with open(env_local_path, "r", encoding="utf-8") as f:
                count = 0
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue
                    if "=" in line:
                        key, val = line.split("=", 1)
                        key = key.strip()
                        val = val.strip()
                        # Override to ensure it takes precedence over empty system environment values
                        os.environ[key] = val
                        count += 1
            print(f"[DEBUG] [Config] Se cargaron con éxito {count} variables de entorno desde .env.local")
        except Exception as e:
            print(f"[ERROR] [Config] Error leyendo el archivo .env.local: {e}")
    else:
        print("[WARN] [Config] No se encontró el archivo .env.local en la raíz del proyecto.")

# Load environment keys
load_env_local()

# API Credentials
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "").strip()
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").strip()
SUPABASE_ANON_KEY = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "").strip()

# Voice Config: Default to 'EXAVITQu4vr4xnSDxMaL' (Sarah/Bella - Original functional voice)
# Allows complete customizability via .env.local!
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL").strip()

# App Settings
PORT = int(os.getenv("PORT", 8000))
HOST = os.getenv("HOST", "0.0.0.0")

# Avatar Engine Mode: 'IA' (ONNX / TensorRT CUDA) or 'SIMULATOR' (Pillow dynamic fallback)
AVATAR_ENGINE_MODE = os.getenv("AVATAR_ENGINE_MODE", "SIMULATOR").strip().upper()

# --- DEBUG EXPLICITO DE LLAVES EN STARTUP ---
print("\n[DEBUG] === DIAGNÓSTICO DE CREDENCIALES AL INICIAR BACKEND ===")

# Validate Groq API Key
if GROQ_API_KEY:
    masked_groq = GROQ_API_KEY[:6] + "..." + GROQ_API_KEY[-4:] if len(GROQ_API_KEY) > 10 else "Muy corta"
    print(f"[DEBUG] GROQ_API_KEY encontrada: longitud = {len(GROQ_API_KEY)} caracteres | Máscara: {masked_groq}")
else:
    print("[ERROR] GROQ_API_KEY vacía o no definida.")

# Validate ElevenLabs API Key
if ELEVENLABS_API_KEY:
    masked_eleven = ELEVENLABS_API_KEY[:6] + "..." + ELEVENLABS_API_KEY[-4:] if len(ELEVENLABS_API_KEY) > 10 else "Muy corta"
    starts_sk = ELEVENLABS_API_KEY.startswith("sk_")
    print(f"[DEBUG] ELEVENLABS_API_KEY encontrada: longitud = {len(ELEVENLABS_API_KEY)} caracteres | Máscara: {masked_eleven} | Comienza con 'sk_': {starts_sk}")
else:
    print("[ERROR] ELEVENLABS_API_KEY vacía o no definida.")

# Validate ElevenLabs Voice ID
print(f"[DEBUG] ELEVENLABS_VOICE_ID configurada: '{ELEVENLABS_VOICE_ID}' (Por defecto: Sarah/Bella - Original Funcional)")

# Validate Supabase Config
if SUPABASE_URL:
    print(f"[DEBUG] SUPABASE_URL encontrada: '{SUPABASE_URL}'")
else:
    print("[ERROR] SUPABASE_URL vacía o no definida.")
if SUPABASE_ANON_KEY:
    masked_sb = SUPABASE_ANON_KEY[:6] + "..." + SUPABASE_ANON_KEY[-4:] if len(SUPABASE_ANON_KEY) > 10 else "Muy corta"
    print(f"[DEBUG] SUPABASE_ANON_KEY encontrada: longitud = {len(SUPABASE_ANON_KEY)} | Máscara: {masked_sb}")
else:
    print("[ERROR] SUPABASE_ANON_KEY vacía o no definida.")
print("==============================================================\n")
