"use client";
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../lib/context/LanguageContext';
import { ServiceFactory } from '../lib/services/ServiceFactory';
import { Upload, X, Loader2, Play, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoUploadDropzoneProps {
  videoUrl: string;
  onChange: (url: string) => void;
}

interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

export default function VideoUploadDropzone({ 
  videoUrl, 
  onChange
}: VideoUploadDropzoneProps) {
  const { t, language } = useTranslation();
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const storageService = ServiceFactory.getStorageService();

  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const uploadVideoFile = async (file: File) => {
    const allowedExtensions = ['mp4', 'mov', 'webm'];
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/webm'];

    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const isValidFormat = allowedTypes.includes(file.type) || allowedExtensions.includes(ext);
    const isTooLarge = file.size > 50 * 1024 * 1024; // 50MB limit

    if (!isValidFormat) {
      showToast(
        language === 'es'
          ? 'Formato no permitido. Utiliza MP4, MOV o WEBM.'
          : 'Unsupported format. Please use MP4, MOV or WEBM.',
        'error'
      );
      return;
    }

    if (isTooLarge) {
      showToast(
        language === 'es'
          ? 'El video supera el límite de 50MB.'
          : 'The video exceeds the 50MB limit.',
        'error'
      );
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.floor(Math.random() * 8) + 2;
      });
    }, 400);

    try {
      // Direct file upload to Supabase storage preserving correct MIME type
      const publicUrl = await storageService.uploadImage(file);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);

      onChange(publicUrl);
      showToast(
        language === 'es' ? 'Video subido correctamente.' : 'Video uploaded successfully.',
        'success'
      );
    } catch (err) {
      console.error('[VideoUploadDropzone] Upload error:', err);
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
      showToast(
        language === 'es' ? 'Error al subir el video.' : 'Failed to upload video.',
        'error'
      );
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadVideoFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadVideoFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    if (isUploading || videoUrl) return;
    fileInputRef.current?.click();
  };

  const handleDeleteVideo = async () => {
    if (!videoUrl) return;
    const success = await storageService.deleteImage(videoUrl);
    if (!success) {
      console.warn('[VideoUploadDropzone] Physical video delete failed, clearing reference.');
    }
    onChange('');
    showToast(
      language === 'es' ? 'Video eliminado.' : 'Video removed.',
      'success'
    );
  };

  return (
    <div className="flex flex-col gap-2 w-full">
      {/* Toast notifications */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`px-4 py-3 rounded-2xl shadow-premium text-xs font-bold text-white flex items-center gap-2 ${
                toast.type === 'success' ? 'bg-brand-accent' : 'bg-brand-rose'
              }`}
            >
              <span>{toast.type === 'success' ? '✓' : '⚠'}</span>
              <span>{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept="video/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {!videoUrl ? (
        /* Dropzone area */
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={`border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-3 relative overflow-hidden bg-brand-gray-50 min-h-[160px] ${
            isDragActive 
              ? 'border-brand-accent bg-brand-accent/5 scale-[1.01]' 
              : 'border-brand-gray-200 hover:border-brand-black hover:bg-white hover:shadow-floating'
          }`}
        >
          {isUploading ? (
            <div className="flex flex-col items-center gap-2 animate-in fade-in duration-200">
              <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
              <p className="text-xs font-bold text-brand-black">
                {language === 'es' ? 'Subiendo video local...' : 'Uploading local video...'}
              </p>
              <p className="text-[10px] text-brand-gray-400 font-medium">
                {language === 'es' ? 'Almacenando archivo en Supabase Storage' : 'Storing file in Supabase Storage'}
              </p>
              {uploadProgress > 0 && (
                <div className="flex flex-col items-center gap-1.5 w-full max-w-[200px] mt-1.5">
                  <div className="w-full bg-brand-gray-200 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-brand-accent h-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="text-[9px] font-black text-brand-accent">{uploadProgress}%</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-white rounded-2xl shadow-premium text-brand-gray-500 hover:scale-105 transition-transform duration-200">
                <Film className="w-5 h-5 text-brand-black" />
              </div>
              <div className="text-center px-4">
                <p className="text-xs font-bold text-brand-black">
                  {language === 'es' 
                    ? 'Arrastra y suelta tu video local aquí' 
                    : 'Drag & drop your local video here'
                  }
                </p>
                <p className="text-[10px] text-brand-gray-500 mt-0.5 font-semibold">
                  {language === 'es' 
                    ? 'o haz clic para explorar tus archivos (MP4, MOV, WEBM hasta 50MB)' 
                    : 'or click to browse your files (MP4, MOV, WEBM up to 50MB)'
                  }
                </p>
              </div>
            </div>
          )}
          <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-brand-accent/5 filter blur-xl pointer-events-none" />
        </div>
      ) : (
        /* Video thumbnail preview card */
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
            {language === 'es' ? 'Video cargado' : 'Uploaded Video'}
          </span>
          <div className="relative rounded-2xl overflow-hidden bg-brand-black aspect-video max-w-sm border border-brand-gray-200 group">
            <video 
              src={videoUrl} 
              className="w-full h-full object-cover" 
              muted 
              playsInline 
              controls
            />
            {/* Play Button Overlay */}
            <div className="absolute inset-0 bg-brand-black/20 flex items-center justify-center pointer-events-none group-hover:bg-brand-black/40 transition-colors">
              <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center text-brand-black shadow-md">
                <Play className="w-4 h-4 text-brand-black fill-brand-black translate-x-[1px]" />
              </div>
            </div>
            {/* Close action */}
            <button
              type="button"
              onClick={handleDeleteVideo}
              className="absolute top-2 right-2 p-1.5 bg-brand-rose hover:bg-brand-rose/90 text-white rounded-full transition-transform hover:scale-110 shadow-md cursor-pointer z-10"
              title={language === 'es' ? 'Eliminar video' : 'Remove video'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
