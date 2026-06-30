import time
import math
import io
import base64
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import numpy as np

# Import config
import config

# Root Workspace path
BASE_DIR = Path(__file__).resolve().parent.parent
AVATAR_PATH = BASE_DIR / "public" / "avatar.png"

# Import Neural Engine components safely
try:
    from avatar.onnx_engine import global_onnx_engine
    from avatar.audio2exp import Audio2ExpAdapter
    from avatar.procedural import ProceduralAnimator
    NEURAL_MODULES_AVAILABLE = True
except ImportError as e:
    print(f"[WARN] [Avatar Facade] Error importando módulos neuronales: {e}. Desactivando inferencia IA.")
    NEURAL_MODULES_AVAILABLE = False


class AvatarEngine:
    """
    Unified architectural facade for Eterna's real-time animation.
    Dynamically orchestrates:
    - Mode 'IA': Speedy-LivePortrait + Wav2Vec2 + Audio2Exp ONNX pipeline on GPU.
    - Mode 'SIMULATOR': High-fidelity organic Pillow renderer (graceful fallback).
    """
    def __init__(self):
        # Fallback Simulator state
        self.avatar_image = None
        self.load_source_image()
        self.current_openness = 0.0   # Lip EMA filtering
        self.blink_phase = 0          # Eyes blink state
        self.last_blink_time = time.time()
        self.blink_interval = 4.0
        
        # Audio Buffer Cache
        self.current_audio_chunk = b""
        self.last_audio_chunk_time = 0.0
        
        # Neural Engine State
        self.use_neural = False
        self.audio_adapter = None
        self.pose_animator = None
        
        if config.AVATAR_ENGINE_MODE == "IA":
            if NEURAL_MODULES_AVAILABLE:
                print("[INFO] [Avatar Facade] Modo 'IA' activado en configuración. Cargando modelos en GPU...")
                # Initialize models globally during startup
                success = global_onnx_engine.initialize_sessions()
                if success:
                    self.audio_adapter = Audio2ExpAdapter()
                    # Setup audio adapter ONNX backend using the engine providers
                    self.audio_adapter.initialize_wav2vec2(global_onnx_engine.providers)
                    self.pose_animator = ProceduralAnimator()
                    self.use_neural = True
                    print("[SUCCESS] [Avatar Facade] Motor Neural de Inferencia IA cargado con éxito.")
                else:
                    print("[WARN] [Avatar Facade] Falló inicialización del motor ONNX. Activando fallback: SIMULADOR.")
            else:
                print("[WARN] [Avatar Facade] Módulos neuronales no instalados. Activando fallback: SIMULADOR.")
        else:
            print("[INFO] [Avatar Facade] Modo 'SIMULATOR' seleccionado por defecto.")

    def load_source_image(self):
        """Loads Eterna's high-quality reference portrait from public folder"""
        try:
            if AVATAR_PATH.exists():
                self.avatar_image = Image.open(AVATAR_PATH).convert("RGBA")
                print(f"[INFO] Inferencia optimizada: Imagen Eterna cargada ({self.avatar_image.size})")
            else:
                print(f"[WARN] No se encontró {AVATAR_PATH}. Creando avatar digital de respaldo...")
                img = Image.new("RGBA", (512, 512), (15, 23, 42, 255))
                draw = ImageDraw.Draw(img)
                draw.ellipse([128, 128, 384, 384], fill=(30, 41, 59, 255), outline=(99, 102, 241, 255), width=4)
                draw.ellipse([200, 200, 312, 312], fill=(71, 85, 105, 255))
                self.avatar_image = img
        except Exception as e:
            print(f"[ERROR] Error al inicializar imagen de origen del avatar: {e}")
            self.avatar_image = Image.new("RGBA", (512, 512), (15, 23, 42, 255))

    def set_audio_chunk(self, audio_bytes: bytes):
        """
        Receives real-time ElevenLabs audio stream packets to feed the viseme solver.
        Stored in a rapid temporary cache to synchronize frames with sound.
        """
        self.current_audio_chunk = audio_bytes
        self.last_audio_chunk_time = time.time()

    def generate_realtime_frame(self, status: str = "idle", audio_amplitude: float = 0.0) -> str:
        """
        Main interface entrypoint. Decides whether to invoke ONNX-GPU neural inference
        or direct Pillow canvas warping dynamically, handling any errors seamlessly.
        """
        # If we have a stored audio chunk that is stale (>300ms), clear it
        if time.time() - self.last_audio_chunk_time > 0.30:
            self.current_audio_chunk = b""

        # ---------------------------------------------
        # PATH A: SPEEDY-LIVEPORTRAIT ONNX IA RUNTIME
        # ---------------------------------------------
        if self.use_neural:
            try:
                # 1. Drive head rotations and eye blinks procedurally
                driving_pose, eyelid_openness = self.pose_animator.generate_driving_pose(status)
                
                # 2. Drive lips and jaw shapes from audio chunk
                driving_expression = self.audio_adapter.compute_expression_coefficients(
                    self.current_audio_chunk, status
                )
                
                # Apply eye blink modifications onto expressions (3DMM indexes 1 & 2 control eyelids)
                # If eyes are closed, blend closing coefficients
                if eyelid_openness < 0.95:
                    blink_factor = (1.0 - eyelid_openness) * 1.5
                    driving_expression[1] = blink_factor # Left eyelid close
                    driving_expression[2] = blink_factor # Right eyelid close

                # 3. Run neural warping session on GPU/CPU
                warped_rgb = global_onnx_engine.run_warping_inference(driving_expression, driving_pose)
                
                # 4. Convert NumPy RGB to PIL RGBA frame
                frame = Image.fromarray(warped_rgb).convert("RGBA")
                
                # 5. Compress to premium WebP format
                buffer = io.BytesIO()
                frame.save(buffer, format="WebP", quality=75)
                webp_bytes = buffer.getvalue()
                
                return base64.b64encode(webp_bytes).decode("utf-8")
                
            except Exception as e:
                print(f"[ERROR] Error inesperado en el ciclo neural. Desconectando motor IA y cayendo a SIMULADOR: {e}")
                self.use_neural = False # Dynamic runtime fallback to prevent future blockages

        # ---------------------------------------------
        # PATH B: PILLOW HIGH-FIDELITY SIMULATOR FALLBACK
        # ---------------------------------------------
        if not self.avatar_image:
            return ""

        frame = self.avatar_image.copy()
        w, h = frame.size
        curr_time = time.time()

        # 1. HEAD MOTION / SUBTLE BREATHING
        sway_angle = math.sin(curr_time * 1.0) * 0.35
        float_y = math.cos(curr_time * 1.3) * 1.2
        float_x = math.sin(curr_time * 0.7) * 0.6
        frame = frame.rotate(sway_angle, resample=Image.BICUBIC, center=(w // 2, h // 2), translate=(float_x, float_y))

        # 2. SMOOTH EYE BLINKING
        if self.blink_phase == 0:
            if curr_time - self.last_blink_time > self.blink_interval:
                self.blink_phase = 1
                self.blink_start_time = curr_time
                self.blink_interval = random.uniform(3.5, 6.0)
        elif self.blink_phase == 1:
            self.render_eyelids(frame, w, h, opacity_factor=0.6)
            if curr_time - self.blink_start_time > 0.05:
                self.blink_phase = 2
                self.blink_start_time = curr_time
        elif self.blink_phase == 2:
            self.render_eyelids(frame, w, h, opacity_factor=1.0)
            if curr_time - self.blink_start_time > 0.08:
                self.blink_phase = 3
                self.blink_start_time = curr_time
        elif self.blink_phase == 3:
            self.render_eyelids(frame, w, h, opacity_factor=0.5)
            if curr_time - self.blink_start_time > 0.05:
                self.blink_phase = 0
                self.last_blink_time = curr_time

        # 3. SMOOTH LIPS-SYNC FROM AUDIO AMPLITUDE OR CACHED AUDIO
        target_openness = audio_amplitude if status == "talking" else 0.0
        
        # If we have an active audio chunk, use its precise solver energy instead
        if status == "talking" and self.current_audio_chunk:
            if hasattr(self, "audio_adapter") and self.audio_adapter is not None:
                target_openness = self.audio_adapter.extract_rms_openness(self.current_audio_chunk)
            else:
                # Local RMS calculation if adapter is not loaded
                try:
                    signal = np.frombuffer(self.current_audio_chunk, dtype=np.int16).astype(np.float32) / 32768.0
                    rms = np.sqrt(np.mean(signal**2)) if len(signal) > 0 else 0.0
                    target_openness = min(1.0, max(0.0, rms * 4.5))
                except Exception:
                    pass

        self.current_openness = (0.22 * target_openness) + (0.78 * self.current_openness)
        if self.current_openness < 0.01:
            self.current_openness = 0.0

        if self.current_openness > 0.01:
            mouth_center_x = int(w * 0.50)
            mouth_center_y = int(h * 0.56)
            mouth_width = int(w * 0.09)
            mouth_height = int(h * 0.05)
            
            mouth_box = (
                mouth_center_x - mouth_width // 2,
                mouth_center_y - mouth_height // 2,
                mouth_center_x + mouth_width // 2,
                mouth_center_y + mouth_height // 2
            )
            
            try:
                mouth_region = frame.crop(mouth_box)
                scale_y = 1.0 + (self.current_openness * 1.5)
                scale_y = min(scale_y, 2.1)
                new_h = int(mouth_height * scale_y)
                
                mouth_scaled = mouth_region.resize((mouth_width, new_h), Image.Resampling.LANCZOS)
                
                draw = ImageDraw.Draw(frame)
                cavity_box = [
                    mouth_center_x - mouth_width // 2 + 5,
                    mouth_center_y - new_h // 2,
                    mouth_center_x + mouth_width // 2 - 5,
                    mouth_center_y + new_h // 2
                ]
                draw.ellipse(cavity_box, fill=(35, 12, 12, 255))
                
                mouth_mask = Image.new("L", (mouth_width, new_h), 0)
                mask_draw = ImageDraw.Draw(mouth_mask)
                mask_draw.ellipse([2, 0, mouth_width - 2, new_h], fill=255)
                mouth_mask_blurred = mouth_mask.filter(ImageFilter.GaussianBlur(radius=3))
                
                frame.paste(
                    mouth_scaled, 
                    (mouth_center_x - mouth_width // 2, mouth_center_y - new_h // 2), 
                    mouth_mask_blurred
                )
            except Exception:
                pass

        buffer = io.BytesIO()
        frame.save(buffer, format="WebP", quality=75)
        webp_bytes = buffer.getvalue()
        
        return base64.b64encode(webp_bytes).decode("utf-8")

    def render_eyelids(self, frame: Image.Image, w: int, h: int, opacity_factor: float):
        """Draws eyelids smoothly over eyes"""
        draw = ImageDraw.Draw(frame)
        left_eye_box = [w * 0.44, h * 0.44, w * 0.48, h * 0.46]
        right_eye_box = [w * 0.52, h * 0.44, w * 0.56, h * 0.46]
        color = (235, 204, 189, int(255 * opacity_factor))
        draw.ellipse(left_eye_box, fill=color)
        draw.ellipse(right_eye_box, fill=color)
        
        if opacity_factor > 0.8:
            draw.line([w * 0.43, h * 0.45, w * 0.49, h * 0.45], fill=(50, 30, 20, 255), width=2)
            draw.line([w * 0.51, h * 0.45, w * 0.57, h * 0.45], fill=(50, 30, 20, 255), width=2)

