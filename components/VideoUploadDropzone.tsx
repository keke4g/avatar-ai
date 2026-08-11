"use client";

import React, { useRef, useState } from 'react';
import { Film, Loader2, Play, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from '../lib/context/LanguageContext';
import { ServiceFactory } from '../lib/services/ServiceFactory';

interface VideoUploadDropzoneProps {
  videoUrls: string[];
  onChange: (urls: string[]) => void;
  maxVideos?: number;
}

interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

const MAX_VIDEO_SIZE_BYTES = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['mp4', 'mov', 'webm']);
const ALLOWED_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);

export default function VideoUploadDropzone({
  videoUrls,
  onChange,
  maxVideos = 5,
}: VideoUploadDropzoneProps) {
  const { language } = useTranslation();
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const storageService = ServiceFactory.getStorageService();
  const remainingSlots = Math.max(0, maxVideos - videoUrls.length);

  const showToast = (message: string, type: Toast['type']) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message, type }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  };

  const validateVideo = (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_TYPES.has(file.type) && !ALLOWED_EXTENSIONS.has(extension)) {
      showToast(
        language === 'es'
          ? `“${file.name}” no es MP4, MOV o WEBM.`
          : `“${file.name}” is not MP4, MOV, or WEBM.`,
        'error',
      );
      return false;
    }
    if (file.size > MAX_VIDEO_SIZE_BYTES) {
      showToast(
        language === 'es'
          ? `“${file.name}” supera el límite de 50 MB.`
          : `“${file.name}” exceeds the 50 MB limit.`,
        'error',
      );
      return false;
    }
    return true;
  };

  const uploadVideoFiles = async (incomingFiles: File[]) => {
    if (isUploading || remainingSlots === 0 || incomingFiles.length === 0) return;

    if (incomingFiles.length > remainingSlots) {
      showToast(
        language === 'es'
          ? `Puedes agregar ${remainingSlots} video${remainingSlots === 1 ? '' : 's'} más.`
          : `You can add ${remainingSlots} more video${remainingSlots === 1 ? '' : 's'}.`,
        'error',
      );
    }

    const validFiles = incomingFiles.slice(0, remainingSlots).filter(validateVideo);
    if (validFiles.length === 0) return;

    setIsUploading(true);
    setUploadProgress(5);
    const uploadedUrls: string[] = [];
    let failedUploads = 0;

    for (let index = 0; index < validFiles.length; index += 1) {
      try {
        const publicUrl = await storageService.uploadImage(validFiles[index]);
        uploadedUrls.push(publicUrl);
      } catch (error) {
        failedUploads += 1;
        console.error('[VideoUploadDropzone] Upload error:', error);
      }
      setUploadProgress(Math.round(((index + 1) / validFiles.length) * 100));
    }

    if (uploadedUrls.length > 0) {
      onChange([...videoUrls, ...uploadedUrls].slice(0, maxVideos));
      showToast(
        language === 'es'
          ? `${uploadedUrls.length} video${uploadedUrls.length === 1 ? '' : 's'} subido${uploadedUrls.length === 1 ? '' : 's'} correctamente.`
          : `${uploadedUrls.length} video${uploadedUrls.length === 1 ? '' : 's'} uploaded successfully.`,
        'success',
      );
    }
    if (failedUploads > 0) {
      showToast(
        language === 'es'
          ? `${failedUploads} video${failedUploads === 1 ? '' : 's'} no se pudieron subir.`
          : `${failedUploads} video${failedUploads === 1 ? '' : 's'} could not be uploaded.`,
        'error',
      );
    }

    setIsUploading(false);
    setUploadProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrag = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(event.type === 'dragenter' || event.type === 'dragover');
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragActive(false);
    void uploadVideoFiles(Array.from(event.dataTransfer.files || []));
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    void uploadVideoFiles(Array.from(event.target.files || []));
  };

  const handleDeleteVideo = async (url: string) => {
    const success = await storageService.deleteImage(url);
    if (!success) {
      console.warn('[VideoUploadDropzone] Physical video delete failed, clearing reference.');
    }
    onChange(videoUrls.filter((videoUrl) => videoUrl !== url));
    showToast(language === 'es' ? 'Video eliminado.' : 'Video removed.', 'success');
  };

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-xs font-bold text-white shadow-premium ${
                toast.type === 'success' ? 'bg-brand-accent' : 'bg-brand-rose'
              }`}
            >
              <span>{toast.type === 'success' ? '✓' : '⚠'}</span>
              <span>{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-brand-gray-500">
          {language === 'es' ? 'Videos de la propiedad' : 'Property videos'}
        </p>
        <span className="rounded-full bg-brand-gray-100 px-2.5 py-1 text-[9px] font-black text-brand-gray-600">
          {videoUrls.length} / {maxVideos}
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/mp4,video/quicktime,video/webm,.mp4,.mov,.webm"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {videoUrls.length > 0 && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {videoUrls.map((videoUrl, index) => (
            <article key={videoUrl} className="group overflow-hidden rounded-2xl border border-brand-gray-200 bg-brand-black shadow-sm">
              <div className="relative aspect-video">
                <video src={videoUrl} className="h-full w-full object-cover" muted playsInline controls preload="metadata" />
                <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/65 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-white backdrop-blur">
                  Video {index + 1}
                </span>
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/25">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-brand-black shadow-md">
                    <Play className="h-3.5 w-3.5 translate-x-px fill-current" />
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDeleteVideo(videoUrl)}
                  className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-brand-rose text-white shadow-md transition hover:scale-105 hover:bg-brand-rose/90"
                  aria-label={language === 'es' ? `Eliminar video ${index + 1}` : `Remove video ${index + 1}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {remainingSlots > 0 && (
        <button
          type="button"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`relative flex min-h-[128px] w-full cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-3xl border-2 border-dashed p-5 text-center transition ${
            isDragActive
              ? 'scale-[1.01] border-brand-accent bg-brand-accent/5'
              : 'border-brand-gray-200 bg-brand-gray-50 hover:border-brand-accent hover:bg-white'
          }`}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-7 w-7 animate-spin text-brand-accent" />
              <p className="text-xs font-black text-brand-black">
                {language === 'es' ? 'Subiendo videos…' : 'Uploading videos…'}
              </p>
              <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-brand-gray-200">
                <div className="h-full bg-brand-accent transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
              <span className="text-[9px] font-black text-brand-accent">{uploadProgress}%</span>
            </>
          ) : (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-brand-black shadow-sm">
                {videoUrls.length === 0 ? <Film className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
              </span>
              <p className="text-xs font-black text-brand-black">
                {language === 'es'
                  ? `Arrastra o selecciona hasta ${remainingSlots} video${remainingSlots === 1 ? '' : 's'}`
                  : `Drop or select up to ${remainingSlots} video${remainingSlots === 1 ? '' : 's'}`}
              </p>
              <p className="text-[10px] font-semibold text-brand-gray-500">
                MP4, MOV o WEBM · 50 MB máximo por archivo
              </p>
            </>
          )}
        </button>
      )}
    </div>
  );
}
