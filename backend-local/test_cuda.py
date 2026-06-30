import sys

try:
    import onnxruntime as ort
    print("=" * 60)
    print("  DIAGNÓSTICO DE ONNX RUNTIME GPU & CUDA PROVIDERS  ")
    print("=" * 60)
    print(f"[INFO] Versión de ONNX Runtime instalada: {ort.__version__}")
    
    # Check all available providers
    available = ort.get_available_providers()
    print(f"[INFO] Providers disponibles en sistema: {available}")
    
    # Attempt to load CUDA provider session
    if "CUDAExecutionProvider" in available:
        print("[INFO] CUDAExecutionProvider está listado. Intentando inicialización de prueba...")
        try:
            # Create a minimal dummy session to force DLL loading check
            import numpy as np
            import os
            from pathlib import Path
            
            # Find an existing local model
            lp_dir = Path(__file__).resolve().parent / "models" / "liveportrait"
            model_path = lp_dir / "landmark.onnx"
            
            if model_path.exists():
                # Test session loading with local model
                sess = ort.InferenceSession(str(model_path), providers=["CUDAExecutionProvider"])
                print("[SUCCESS] ¡CUDAExecutionProvider cargó e inicializó CUDA de forma exitosa!")
                print(f"[INFO] Provider activo en la sesión: {sess.get_providers()}")
            else:
                print(f"[WARN] No se encontró el modelo local en {model_path} para la prueba.")
                print("[INFO] Reintentando autogeneración de sesión rápida...")
                # Fallback to simple API provider test
                sess_opts = ort.SessionOptions()
                # If we cannot load a session, we can print that we got providers
                print(f"[INFO] Providers listados por ORT: {ort.get_host_api()}")
        except Exception as e:
            print(f"[ERROR] Falló la carga real del provider CUDA: {e}")
            print("\n[EXPLICACIÓN]")
            if "cublasLt64" in str(e) or "cublas" in str(e):
                print("-> Esto confirma que el CUDA Toolkit 12.x no está instalado o sus DLLs no están en el PATH de Windows.")
            elif "cudnn" in str(e):
                print("-> Esto confirma que cuDNN (versión 8.x o 9.x compatible) no está instalado o sus DLLs no se copiaron a la carpeta bin del Toolkit.")
            else:
                print(f"-> Error detallado de carga de DLLs: {e}")
    else:
        print("[WARN] CUDAExecutionProvider NO está disponible en esta instalación de onnxruntime.")
        print("[INFO] Si tienes una GPU NVIDIA, instala la versión GPU ejecutando:")
        print("       pip uninstall onnxruntime")
        print("       pip install onnxruntime-gpu")
        
    print("=" * 60)
except ImportError:
    print("[ERROR] ONNX Runtime no está instalado en este entorno virtual de Python.")
    print("        Ejecuta: pip install onnxruntime")
