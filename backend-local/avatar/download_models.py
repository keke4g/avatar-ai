import os
import sys
import urllib.request
from pathlib import Path

# Base Paths
BACKEND_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BACKEND_DIR / "models"

# HF Repository Model URLs (Speedy-LivePortrait ONNX + Wav2Vec2 ONNX)
MODEL_URLS = {
    "liveportrait/appearance_feature_extractor.onnx": "https://huggingface.co/warmshao/FasterLivePortrait/resolve/main/liveportrait_onnx/appearance_feature_extractor.onnx",
    "liveportrait/motion_extractor.onnx": "https://huggingface.co/warmshao/FasterLivePortrait/resolve/main/liveportrait_onnx/motion_extractor.onnx",
    "liveportrait/warping_spade.onnx": "https://huggingface.co/warmshao/FasterLivePortrait/resolve/main/liveportrait_onnx/warping_spade.onnx",
    "liveportrait/stitching.onnx": "https://huggingface.co/warmshao/FasterLivePortrait/resolve/main/liveportrait_onnx/stitching.onnx",
    "liveportrait/landmark.onnx": "https://huggingface.co/warmshao/FasterLivePortrait/resolve/main/liveportrait_onnx/landmark.onnx",
    "liveportrait/retinaface_det_static.onnx": "https://huggingface.co/warmshao/FasterLivePortrait/resolve/main/liveportrait_onnx/retinaface_det_static.onnx",
    "wav2vec2/model.onnx": "https://huggingface.co/optimum/wav2vec2-base-960h/resolve/main/model.onnx",
}

def report_progress(block_num, block_size, total_size):
    """Callback to print download progress in a clean visual way"""
    if total_size <= 0:
        return
    downloaded = block_num * block_size
    percent = min(100, int(downloaded * 100 / total_size))
    downloaded_mb = downloaded / (1024 * 1024)
    total_mb = total_size / (1024 * 1024)
    sys.stdout.write(
        f"\r[INFO] [Descarga] Progresando: {percent}% | {downloaded_mb:.1f}MB de {total_mb:.1f}MB"
    )
    sys.stdout.flush()

def download_file(url: str, dest_path: Path):
    """Downloads a single file from URL to dest_path safely"""
    dest_path.parent.mkdir(parents=True, exist_ok=True)
    temp_dest = dest_path.with_suffix(".tmp")
    
    print(f"\n[INFO] Iniciando descarga de: {url}")
    print(f"[INFO] Destino: {dest_path}")
    
    try:
        # User-agent header to avoid getting blocked by some CDN rules
        opener = urllib.request.build_opener()
        opener.addheaders = [('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)')]
        urllib.request.install_opener(opener)
        
        urllib.request.urlretrieve(url, str(temp_dest), report_progress)
        
        # Rename temp file to final destination once finished successfully
        if temp_dest.exists():
            temp_dest.rename(dest_path)
            print(f"\n[SUCCESS] Descargado e indexado con éxito: {dest_path.name}")
            return True
    except Exception as e:
        print(f"\n[ERROR] Falló la descarga de {url}: {e}")
        if temp_dest.exists():
            try:
                temp_dest.unlink()
            except Exception:
                pass
        return False

def check_and_download_all():
    """Main entrypoint to download all necessary ONNX weights globally"""
    print("=" * 70)
    print("  VERIFICADOR Y DESCARGADOR AUTOMATIZADO DE MODELOS NEURONALES ETERNA  ")
    print("=" * 70)
    print(f"[INFO] Carpeta de almacenamiento local: {MODELS_DIR.resolve()}")
    
    success_count = 0
    total_models = len(MODEL_URLS)
    
    for rel_path, url in MODEL_URLS.items():
        dest_path = MODELS_DIR / rel_path
        if dest_path.exists() and dest_path.stat().st_size > 1000000:
            # File exists and is not empty (at least 1MB to avoid corrupt templates)
            print(f"[OK] Modelo existente: {rel_path} ({dest_path.stat().st_size / (1024*1024):.2f} MB)")
            success_count += 1
        else:
            print(f"[MISSING] Modelo no encontrado o incompleto: {rel_path}")
            # Try downloading
            success = download_file(url, dest_path)
            if success:
                success_count += 1
            else:
                print(f"[WARN] No se pudo descargar el modelo {rel_path}. Se activará el simulador visual como fallback.")
                
    print("-" * 70)
    if success_count == total_models:
        print("[SUCCESS] ¡Todos los modelos ONNX están listos para la inferencia premium!")
        return True
    else:
        print(f"[INFO] Descargas listas: {success_count}/{total_models} modelos cargados.")
        print("[WARN] Ejecutando en modo mixto. El pipeline conversacional se mantendrá en SIMULADOR si faltan archivos.")
        return False

if __name__ == "__main__":
    check_and_download_all()
