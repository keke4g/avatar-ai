"use client";
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../lib/context/LanguageContext';
import { ServiceFactory } from '../lib/services/ServiceFactory';
import { Upload, X, Image as ImageIcon, Loader2, Sparkles, Film, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

export interface ImageMetadata {
  originalName: string;
  size: number;
  width: number;
  height: number;
  uploadedAt: string;
  thumbnailUrl: string;
  imageAnalysis?: {
    qualityScore?: number;
    brightness?: number;
    duplicate?: boolean;
    recommendations?: string[];
  };
}

interface ImageUploadDropzoneProps {
  images: string[];
  onChange: (newImages: string[]) => void;
  imagesMetadata?: Record<string, ImageMetadata>;
  onMetadataChange?: (newMetadata: Record<string, ImageMetadata>) => void;
}

interface GalleryItem {
  id: string; // URL pública si está completado, o id temporal para placeholders
  type: 'completed' | 'uploading' | 'processing' | 'error';
  url?: string; // URL de galería
  tempUrl?: string; // Vista previa local temporal (URL.createObjectURL)
  name?: string;
}

interface Toast {
  id: string;
  type: 'success' | 'error';
  message: string;
}

export default function ImageUploadDropzone({ 
  images, 
  onChange,
  imagesMetadata = {},
  onMetadataChange
}: ImageUploadDropzoneProps) {
  const { t, language } = useTranslation();
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Store all active Object URLs to guarantee clean up on unmount
  const activeObjectURLsRef = useRef<Set<string>>(new Set());

  // Unified items list (completed files + active uploads in stable positions)
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Sync completed images from parent with our local items
  useEffect(() => {
    setItems(prev => {
      const activeUploads = prev.filter(item => item.type === 'uploading' || item.type === 'processing');
      const completedItems = images.map(url => {
        const existing = prev.find(item => item.url === url);
        return existing || { id: url, type: 'completed' as const, url };
      });
      return [...completedItems, ...activeUploads];
    });
  }, [images]);

  // Clean up all active ObjectURLs on unmount
  useEffect(() => {
    return () => {
      activeObjectURLsRef.current.forEach(url => {
        URL.revokeObjectURL(url);
      });
      activeObjectURLsRef.current.clear();
    };
  }, []);

  // Toast notifier helper
  const showToast = (message: string, type: 'success' | 'error') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // States for desktop & touch drag-and-drop reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchStartIndexRef = useRef<number | null>(null);

  const storageService = ServiceFactory.getStorageService();

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  // Optimization helper utilizing HTML5 Canvas client-side
  const processAndOptimizeImage = (file: File): Promise<{ galleryFile: File; thumbFile: File; width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      activeObjectURLsRef.current.add(objectUrl);
      img.src = objectUrl;
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        activeObjectURLsRef.current.delete(objectUrl);
        const width = img.width;
        const height = img.height;

        // Protection against extreme resolutions (> 10000px)
        if (width > 10000 || height > 10000) {
          return reject(new Error('RESOLUTION_TOO_LARGE'));
        }

        const resizeToBlob = (maxDim: number, quality: number): Promise<Blob> => {
          return new Promise((resBlob, rejBlob) => {
            let w = width;
            let h = height;
            if (w > maxDim || h > maxDim) {
              if (w > h) {
                h = Math.round((h * maxDim) / w);
                w = maxDim;
              } else {
                w = Math.round((w * maxDim) / h);
                h = maxDim;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              return rejBlob(new Error('Canvas context failure'));
            }
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(
              (b) => {
                if (b) resBlob(b);
                else rejBlob(new Error('toBlob returned null'));
              },
              'image/webp',
              quality
            );
          });
        };

        // Exceptions: < 500 KB and already webp -> keep original file as gallery file
        const galleryPromise = (file.size < 500 * 1024 && file.type === 'image/webp')
          ? Promise.resolve(file)
          : resizeToBlob(1920, 0.80).then(blob => new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
              type: 'image/webp',
              lastModified: Date.now()
            }));

        const thumbPromise = resizeToBlob(400, 0.75).then(blob => new File([blob], file.name.replace(/\.[^/.]+$/, "") + "-thumb.webp", {
          type: 'image/webp',
          lastModified: Date.now()
        }));

        Promise.all([galleryPromise, thumbPromise])
          .then(([galleryFile, thumbFile]) => {
            resolve({ galleryFile, thumbFile, width, height });
          })
          .catch(reject);
      };
      img.onerror = (err) => {
        URL.revokeObjectURL(objectUrl);
        activeObjectURLsRef.current.delete(objectUrl);
        reject(err);
      };
    });
  };

  const uploadFiles = async (files: FileList) => {
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    let skippedCount = 0;
    const filesArray = Array.from(files);

    // Filter format and size
    let validFiles = filesArray.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isValidFormat = allowedTypes.includes(file.type) || allowedExtensions.includes(ext);
      const isTooLarge = file.size > 10 * 1024 * 1024; // 10MB limit

      if (!isValidFormat) {
        skippedCount++;
        return false;
      }

      if (isTooLarge) {
        skippedCount++;
        return false;
      }

      return true;
    });

    // Check gallery max capacity limit of 40 images
    const MAX_IMAGES = 40;
    const currentTotal = items.length; // include active uploads and completed images
    if (currentTotal + validFiles.length > MAX_IMAGES) {
      showToast(
        language === 'es'
          ? 'Has alcanzado el máximo de 40 imágenes.'
          : 'You have reached the maximum of 40 images.',
        'error'
      );
      const allowedCount = MAX_IMAGES - currentTotal;
      if (allowedCount <= 0) return;
      // Skip the rest
      skippedCount += (validFiles.length - allowedCount);
      validFiles = validFiles.slice(0, allowedCount);
    }

    if (skippedCount > 0) {
      showToast(
        language === 'es'
          ? 'Formato no permitido. Utiliza JPG, PNG o WEBP.'
          : 'Unsupported format. Please use JPG, PNG or WEBP.',
        'error'
      );
      showToast(
        language === 'es'
          ? `${skippedCount} archivos fueron omitidos por no cumplir los requisitos.`
          : `${skippedCount} files were skipped because they do not meet the requirements.`,
        'error'
      );
    }

    if (validFiles.length === 0) return;

    // Create job queues with local temporary previews
    const uploadJobs = validFiles.map((file, idx) => {
      const jobId = `job-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`;
      const tempUrl = URL.createObjectURL(file);
      activeObjectURLsRef.current.add(tempUrl);
      return {
        jobId,
        file,
        tempUrl
      };
    });

    // Insert placeholders into local items state
    setItems(prev => [
      ...prev,
      ...uploadJobs.map(job => ({
        id: job.jobId,
        type: 'uploading' as const,
        tempUrl: job.tempUrl,
        name: job.file.name
      }))
    ]);

    let newMetadataItems: Record<string, ImageMetadata> = {};

    const uploadPromises = uploadJobs.map(async (job) => {
      try {
        // Transition state to 'processing' (client optimization)
        setItems(prev => prev.map(item => item.id === job.jobId ? { ...item, type: 'processing' as const } : item));

        const { galleryFile, thumbFile, width, height } = await processAndOptimizeImage(job.file);

        // Upload optimized pair
        const { galleryUrl, thumbnailUrl } = await storageService.uploadImagePair(galleryFile, thumbFile);

        // Update local items state with final URL
        setItems(prev => prev.map(item => item.id === job.jobId ? { id: galleryUrl, type: 'completed' as const, url: galleryUrl } : item));

        // Revoke the preview Object URL now that upload has completed
        URL.revokeObjectURL(job.tempUrl);
        activeObjectURLsRef.current.delete(job.tempUrl);

        // Save metadata
        const metadataItem: ImageMetadata = {
          originalName: job.file.name,
          size: galleryFile.size,
          width,
          height,
          uploadedAt: new Date().toISOString(),
          thumbnailUrl,
          imageAnalysis: {
            qualityScore: undefined,
            brightness: undefined,
            duplicate: undefined,
            recommendations: []
          }
        };

        newMetadataItems[galleryUrl] = metadataItem;
        return galleryUrl;
      } catch (err: any) {
        console.error('[ImageUploadDropzone] Error in upload job:', job.file.name, err);
        
        // Remove failed upload slot
        setItems(prev => prev.filter(item => item.id !== job.jobId));
        URL.revokeObjectURL(job.tempUrl);
        activeObjectURLsRef.current.delete(job.tempUrl);

        if (err.message === 'RESOLUTION_TOO_LARGE') {
          showToast(
            language === 'es'
              ? 'La resolución de la imagen es demasiado grande.'
              : 'The image resolution is too large.',
            'error'
          );
        } else {
          showToast(
            language === 'es'
              ? 'No se pudo subir la imagen.'
              : 'Failed to upload image.',
            'error'
          );
        }
        return null;
      }
    });

    const results = await Promise.all(uploadPromises);
    const uploadedUrls = results.filter((url): url is string => url !== null);

    if (uploadedUrls.length > 0) {
      const isFirstImage = images.length === 0;
      const updatedImages = [...images, ...uploadedUrls];
      onChange(updatedImages);

      // Sync metadata with parent
      if (onMetadataChange) {
        onMetadataChange({
          ...imagesMetadata,
          ...newMetadataItems
        });
      }

      if (isFirstImage) {
        showToast(
          language === 'es'
            ? 'Esta imagen se ha establecido como portada.'
            : 'This image has been set as cover.',
          'success'
        );
      } else {
        showToast(
          language === 'es'
            ? 'Imagen subida correctamente.'
            : 'Image uploaded successfully.',
          'success'
        );
      }

      confetti({
        particleCount: 40,
        spread: 30,
        origin: { y: 0.8 }
      });
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await uploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(e.target.files);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteImage = async (urlToDelete: string) => {
    const success = await storageService.deleteImage(urlToDelete);
    if (!success) {
      console.warn('[ImageUploadDropzone] Physical image delete failed, removing metadata link.');
    }

    const filteredImages = images.filter(url => url !== urlToDelete);
    onChange(filteredImages);

    // Sync metadata cleanup
    if (onMetadataChange) {
      const copy = { ...imagesMetadata };
      delete copy[urlToDelete];
      onMetadataChange(copy);
    }
  };

  const handleSetCover = (index: number) => {
    if (index === 0) return;
    const reordered = [...images];
    const item = reordered[index];
    reordered.splice(index, 1);
    reordered.unshift(item);
    onChange(reordered);
    showToast(
      language === 'es' ? 'Imagen establecida como portada.' : 'Image set as cover.',
      'success'
    );
  };

  // Drag and Drop completed items reordering
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
  };

  const handleDragEnter = (index: number) => {
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDropImage = (index: number) => {
    if (draggedIndex === null || draggedIndex === index) {
      setDragOverIndex(null);
      return;
    }

    // Reordering applies to completed items only
    const reordered = [...images];
    const item = reordered[draggedIndex];
    reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, item);
    onChange(reordered);
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Touch Event reordering
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, index: number) => {
    touchStartIndexRef.current = index;
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (touchStartIndexRef.current === null) return;
    
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;
    
    const cardElement = element.closest('[data-index]');
    if (cardElement) {
      const targetIndex = parseInt(cardElement.getAttribute('data-index') || '');
      if (!isNaN(targetIndex) && targetIndex !== touchStartIndexRef.current) {
        setDragOverIndex(targetIndex);
      } else {
        setDragOverIndex(null);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStartIndexRef.current !== null && dragOverIndex !== null) {
      const reordered = [...images];
      const item = reordered[touchStartIndexRef.current];
      reordered.splice(touchStartIndexRef.current, 1);
      reordered.splice(dragOverIndex, 0, item);
      onChange(reordered);
    }
    
    touchStartIndexRef.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const activeUploadsCount = items.filter(i => i.type === 'uploading' || i.type === 'processing').length;

  return (
    <div className="flex flex-col gap-4">
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileInputChange}
        className="hidden"
      />

      {/* Dropzone Area */}
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
        {activeUploadsCount > 0 ? (
          <div className="flex flex-col items-center gap-2 animate-in fade-in duration-200">
            <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
            <p className="text-xs font-bold text-brand-black">
              {language === 'es'
                ? `Procesando y subiendo ${activeUploadsCount} fotografía(s)...`
                : `Processing and uploading ${activeUploadsCount} image(s)...`
              }
            </p>
            <p className="text-[10px] text-brand-gray-400 font-medium">
              {language === 'es' 
                ? 'Optimizando formato WEBP y subiendo al storage' 
                : 'Optimizing to WEBP format and uploading to cloud'
              }
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 bg-white rounded-2xl shadow-premium text-brand-gray-500 group-hover:scale-105 transition-transform duration-200">
              <Upload className="w-5 h-5 text-brand-black" />
            </div>
            <div className="text-center px-4">
              <p className="text-xs font-bold text-brand-black">
                {language === 'es' 
                  ? 'Arrastra y suelta imágenes reales aquí' 
                  : 'Drag & drop real listing images here'
                }
              </p>
              <p className="text-[10px] text-brand-gray-500 mt-0.5 font-semibold">
                {language === 'es' 
                  ? 'o haz clic para explorar tus archivos locales (JPG, PNG, WEBP)' 
                  : 'or click to browse your local files (JPG, PNG, WEBP)'
                }
              </p>
            </div>
          </div>
        )}

        {/* Glow overlay effect */}
        <div className="absolute -top-10 -right-10 w-24 h-24 rounded-full bg-brand-accent/5 filter blur-xl pointer-events-none" />
      </div>

      {/* Grid of uploaded images */}
      {items.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold text-brand-gray-500 uppercase tracking-wider">
              {language === 'es' ? 'Galería de Imágenes (Arrastra para reordenar)' : 'Image Gallery (Drag to reorder)'}
            </span>
            <span className="text-[10px] text-brand-gray-500 font-black bg-brand-gray-100 px-2.5 py-0.5 rounded-md animate-pulse">
              {images.length} {language === 'es' ? 'fotos cargadas' : 'uploaded photos'} / 40
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 p-2 bg-brand-gray-50/50 border border-brand-gray-100 rounded-2xl max-h-56 overflow-y-auto no-scrollbar">
            <AnimatePresence initial={false}>
              {items.map((item, index) => {
                // RENDER: Placeholder loading cards
                if (item.type === 'uploading' || item.type === 'processing') {
                  return (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="relative aspect-[4/3] rounded-xl overflow-hidden bg-brand-gray-100 border border-brand-gray-200/50 flex flex-col justify-between group shadow-sm select-none"
                    >
                      {item.tempUrl && (
                        <img
                          src={item.tempUrl}
                          alt="Preview"
                          className="absolute inset-0 w-full h-full object-cover opacity-45 blur-[0.5px]"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2 bg-brand-black/10">
                        <Loader2 className="w-4 h-4 text-brand-accent animate-spin" />
                        <span className="text-[8px] font-black text-brand-black uppercase bg-white/90 px-1.5 py-0.5 rounded-md shadow-xs">
                          {item.type === 'uploading'
                            ? (language === 'es' ? 'Subiendo...' : 'Uploading...')
                            : (language === 'es' ? 'Procesando...' : 'Processing...')
                          }
                        </span>
                      </div>
                      <div className="absolute bottom-1 left-1 right-1 text-[7px] font-bold text-white bg-brand-black/60 px-1 py-0.5 rounded truncate text-center z-10">
                        {item.name}
                      </div>
                    </motion.div>
                  );
                }

                // RENDER: Completed cards
                const isBeingDragged = draggedIndex === index;
                const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                
                // Retrieve 400px optimized thumbnail if available
                const displayUrl = (item.url && imagesMetadata[item.url]?.thumbnailUrl)
                  ? imagesMetadata[item.url].thumbnailUrl
                  : item.url!;

                return (
                  <div
                    key={item.id}
                    draggable="true"
                    data-index={index}
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDrop={() => handleDropImage(index)}
                    onTouchStart={(e) => handleTouchStart(e, index)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className="relative aspect-[4/3] touch-none select-none"
                  >
                    {/* Permanent Premium Cover Badge (visible siempre) */}
                    {index === 0 && (
                      <div className="absolute top-1.5 left-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-[7px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md shadow-premium z-10">
                        {language === 'es' ? 'PORTADA' : 'COVER'}
                      </div>
                    )}

                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ 
                        opacity: isBeingDragged ? 0.3 : 1, 
                        scale: isDragTarget ? 1.08 : 1,
                        zIndex: isDragTarget ? 10 : 1
                      }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      layout
                      className={`w-full h-full rounded-xl overflow-hidden group shadow-sm bg-brand-gray-200 cursor-grab active:cursor-grabbing transition-all duration-200 ${
                        isDragTarget ? 'ring-2 ring-brand-accent shadow-premium scale-105' : 'hover:scale-[1.01] border border-brand-gray-200/40'
                      }`}
                    >
                      <img
                        src={displayUrl}
                        alt={`Listing photo ${index + 1}`}
                        className="w-full h-full object-cover pointer-events-none"
                        loading="lazy"
                        decoding="async"
                      />

                      {/* Cover options & Delete button overlay actions */}
                      <div className="absolute inset-0 bg-brand-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 pointer-events-auto">
                        {/* Star Button for Cover Selection */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetCover(index);
                          }}
                          className={`p-1.5 rounded-full transition-transform hover:scale-110 shadow-md cursor-pointer ${
                            index === 0
                              ? 'bg-amber-500 text-white'
                              : 'bg-white/85 hover:bg-white text-brand-black'
                          }`}
                          title={language === 'es' ? 'Marcar como principal' : 'Set as cover'}
                        >
                          <Star className="w-3.5 h-3.5" fill={index === 0 ? "white" : "none"} />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteImage(item.url!);
                          }}
                          className="p-1.5 bg-brand-rose hover:bg-brand-rose/90 text-white rounded-full transition-transform hover:scale-110 shadow-md cursor-pointer"
                          title={language === 'es' ? 'Eliminar imagen' : 'Remove image'}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      
                      {/* Position overlay index badge */}
                      <div className={`absolute bottom-1.5 left-1.5 text-[8px] font-black text-white px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm transition-colors ${
                        index === 0 ? 'bg-gradient-to-r from-amber-500 to-yellow-500' : 'bg-brand-black/55'
                      }`}>
                        {index === 0 
                          ? (language === 'es' ? '★ Portada' : '★ Cover') 
                          : `#${index + 1}`
                        }
                      </div>
                    </motion.div>
                  </div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Premium Toast Notifications portal inside component */}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
              className={`pointer-events-auto px-4 py-3 rounded-2xl shadow-floating border flex items-center gap-2.5 min-w-[280px] backdrop-blur-md transition-all ${
                toast.type === 'success'
                  ? 'bg-white/95 border-emerald-500/30 text-brand-black'
                  : 'bg-white/95 border-rose-500/30 text-brand-black'
              }`}
            >
              {toast.type === 'success' ? (
                <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-black text-[10px] shrink-0">✓</div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center font-black text-[10px] shrink-0">✗</div>
              )}
              <span className="text-[11px] font-bold tracking-tight">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
