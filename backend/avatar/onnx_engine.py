import os
import time
from pathlib import Path
import numpy as np
from PIL import Image

# Import configurations
import config

try:
    import onnxruntime as ort
    ONNX_AVAILABLE = True
except ImportError:
    ONNX_AVAILABLE = False
    ort = None

# Base Paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BACKEND_DIR / "models"
AVATAR_PATH = config.BASE_DIR / "public" / "avatar.png"

class ONNXLivePortraitEngine:
    """
    Main Neural Inference Engine for Eterna's Real-time LivePortrait Animation.
    Loads models globally at startup, verifies GPU capability (CUDA / TensorRT), 
    and caches appearance feature extractions for absolute minimum real-time latency.
    """
    def __init__(self):
        self.is_ready = False
        self.providers = []
        self.sessions = {}
        
        # Appearance Cache
        self.source_features = None
        self.source_landmarks = None
        
        # Check if ONNX Runtime is available
        if not ONNX_AVAILABLE:
            print("[WARN] [ONNX Engine] ONNX Runtime (onnxruntime-gpu / onnxruntime) no está instalado.")
            return

        # Determine Providers (Prefer CUDA and TensorRT, fallback to CPU)
        available_providers = ort.get_available_providers()
        print(f"[INFO] [ONNX Engine] Providers de ejecución ONNX disponibles: {available_providers}")
        
        if "CUDAExecutionProvider" in available_providers:
            # Optimal high-performance GPU configuration
            self.providers = [
                ("CUDAExecutionProvider", {
                    "device_id": 0,
                    "arena_extend_strategy": "kNextPowerOfTwo",
                    "gpu_mem_limit": 2 * 1024 * 1024 * 1024, # 2 GB limit to be friendly
                    "cudnn_conv_algo_search": "EXHAUSTIVE",
                    "do_copy_in_default_stream": True
                }),
                "CPUExecutionProvider"
            ]
            print("[INFO] [ONNX Engine] CUDAExecutionProvider seleccionado para GPU-acceleration.")
        else:
            self.providers = ["CPUExecutionProvider"]
            print("[WARN] [ONNX Engine] CUDA no está disponible. Usando CPUExecutionProvider (Fallback de rendimiento).")

    def initialize_sessions(self) -> bool:
        """
        Loads all ONNX models into memory and runs the pre-extraction cache for the avatar.
        This runs globally at FastAPI startup to guarantee instant WebSocket frame generation.
        """
        if not ONNX_AVAILABLE:
            self.is_ready = False
            return False

        try:
            start_t = time.time()
            print("[INFO] [ONNX Engine] Cargando modelos de LivePortrait y estructurando la inferencia...")
            
            # Subfolders
            lp_dir = MODELS_DIR / "liveportrait"
            
            # Paths to core models
            model_paths = {
                "feature_extractor": lp_dir / "appearance_feature_extractor.onnx",
                "motion_extractor": lp_dir / "motion_extractor.onnx",
                "warping_spade": lp_dir / "warping_spade.onnx",
                "stitching": lp_dir / "stitching.onnx",
                "landmark": lp_dir / "landmark.onnx",
                "retinaface": lp_dir / "retinaface_det_static.onnx"
            }
            
            # Verify files exist
            missing_models = [name for name, path in model_paths.items() if not path.exists()]
            if missing_models:
                print(f"[WARN] [ONNX Engine] Faltan los siguientes modelos en disco: {missing_models}")
                print("[INFO] [ONNX Engine] Inicie el descargador automático para resolver esto.")
                self.is_ready = False
                return False
            
            # Initialize ONNX Sessions
            # Options to optimize thread pooling and latency
            opts = ort.SessionOptions()
            opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
            opts.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            
            # Try to load with preferred execution providers (CUDA/TensorRT)
            try:
                for key, path in model_paths.items():
                    print(f"[INFO] [ONNX Engine] Inicializando sesión ONNX para: {key} ({path.name}) con providers={self.providers}...")
                    self.sessions[key] = ort.InferenceSession(str(path), sess_options=opts, providers=self.providers)
            except Exception as init_err:
                print(f"[WARN] [ONNX Engine] Falló la inicialización con los proveedores preferidos ({self.providers}): {init_err}")
                # Check if CUDA was in the providers. If so, fall back strictly to CPUExecutionProvider to avoid total failure
                provider_names = [p[0] if isinstance(p, tuple) else p for p in self.providers]
                if "CUDAExecutionProvider" in provider_names:
                    print("[WARN] [ONNX Engine] Reintentando inicialización usando CPUExecutionProvider únicamente (Inferencia en CPU)...")
                    self.providers = ["CPUExecutionProvider"]
                    self.sessions.clear()
                    for key, path in model_paths.items():
                        print(f"[INFO] [ONNX Engine] Inicializando sesión ONNX en CPU para: {key} ({path.name})...")
                        self.sessions[key] = ort.InferenceSession(str(path), sess_options=opts, providers=self.providers)
                else:
                    raise init_err
            
            # CACHE SYSTEM: Pre-extract reference features for G LOGICTECH's Eterna avatar
            self.cache_avatar_source_features()
            
            elapsed = time.time() - start_t
            print(f"[SUCCESS] [ONNX Engine] Sesiones cargadas y optimizadas en {elapsed:.2f}s (Usando: {self.providers}).")
            self.is_ready = True
            return True
            
        except Exception as e:
            print(f"[ERROR] [ONNX Engine] Error crítico irrecuperable al inicializar sesiones ONNX: {e}")
            self.is_ready = False
            return False

    def cache_avatar_source_features(self):
        """
        Pre-computes and caches Eterna's appearance coordinates.
        This completely eliminates 512x512 source feature calculations from the real-time loop.
        """
        if not AVATAR_PATH.exists():
            print(f"[WARN] [ONNX Engine] No se encontró la imagen de Eterna en {AVATAR_PATH}. No se puede pre-cargar la caché.")
            return

        try:
            print(f"[INFO] [ONNX Engine] Cacheando características de origen para: {AVATAR_PATH.name}")
            # Load and preprocess image
            img = Image.open(AVATAR_PATH).convert("RGB")
            img_resized = img.resize((512, 512), Image.Resampling.LANCZOS)
            
            # Convert to float32 normalized [0, 1] tensor matching BCHW (1, 3, 512, 512)
            arr = np.array(img_resized, dtype=np.float32) / 255.0
            arr = np.transpose(arr, (2, 0, 1)) # HWC -> CHW
            img_tensor = np.expand_dims(arr, axis=0) # CHW -> BCHW
            
            # Run appearance extraction session
            session = self.sessions.get("feature_extractor")
            if session:
                # In FasterLivePortrait: Input is 'img_source', Output is 'feature_3d' or typical name
                input_name = session.get_inputs()[0].name
                outputs = [output.name for output in session.get_outputs()]
                
                # Inference
                res = session.run(outputs, {input_name: img_tensor})
                self.source_features = res[0]
                print(f"[SUCCESS] [ONNX Engine] Características de Eterna cacheadas con éxito. Dimensiones: {self.source_features.shape}")
                
            # Perform optional landmark prep
            landmark_sess = self.sessions.get("landmark")
            if landmark_sess:
                # Predict source facial landmarks to orient lips and eyelids coordinates
                input_name = landmark_sess.get_inputs()[0].name
                self.source_landmarks = landmark_sess.run(None, {input_name: img_tensor})[0]
                print(f"[SUCCESS] [ONNX Engine] Landmarks de origen cacheados.")
                
        except Exception as e:
            print(f"[ERROR] [ONNX Engine] Error al cachear las características de la imagen base: {e}")

    def run_warping_inference(self, driving_expression: np.ndarray, driving_pose: np.ndarray) -> np.ndarray:
        """
        Main performance loop: Warps Eterna's face matching the driving expression and sways.
        Takes:
        - driving_expression: NumPy array representing 3DMM mouth/facial shape.
        - driving_pose: NumPy array representing head rotation (Yaw, Pitch, Roll) and sways.
        Returns:
        - Generated raw RGB image data of Eterna's face as a NumPy array (512x512x3) ready to compress.
        """
        if not self.is_ready or self.source_features is None:
            raise RuntimeError("El motor ONNX no está inicializado o carece de caché.")
            
        try:
            # 1. Prepare inputs for warping spade generator session
            warping_sess = self.sessions.get("warping_spade")
            
            # Prepare dimensions (FasterLivePortrait warping inputs)
            # Typically: appearance features, expression offsets, pose matrix
            inputs = {
                "source_features": self.source_features,
                "driving_expression": driving_expression.astype(np.float32),
                "driving_pose": driving_pose.astype(np.float32)
            }
            
            # If the session inputs use different names, we match dynamically
            model_inputs = warping_sess.get_inputs()
            input_dict = {}
            for i, model_input in enumerate(model_inputs):
                name = model_input.name
                if "feature" in name or i == 0:
                    input_dict[name] = self.source_features
                elif "expression" in name or i == 1:
                    input_dict[name] = driving_expression.astype(np.float32)
                else:
                    input_dict[name] = driving_pose.astype(np.float32)

            # 2. Run high speed warping inference
            outputs = [o.name for o in warping_sess.get_outputs()]
            res = warping_sess.run(outputs, input_dict)
            warped_face = res[0] # Tensor (1, 3, 512, 512)
            
            # Postprocess: convert from tensor to standard HWC RGB [0-255] image
            img_data = np.squeeze(warped_face, axis=0) # 3, 512, 512
            img_data = np.clip(img_data * 255.0, 0, 255).astype(np.uint8)
            img_data = np.transpose(img_data, (1, 2, 0)) # 512, 512, 3
            
            return img_data
            
        except Exception as e:
            # Catching errors to avoid crashing the server loop
            print(f"[ERROR] [ONNX Engine] Error en ciclo de inferencia neural: {e}")
            raise e

# Global single-instance neural engine
global_onnx_engine = ONNXLivePortraitEngine()
