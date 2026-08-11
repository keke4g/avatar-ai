"use client";
import React, { useState, useRef, useEffect } from 'react';
import NextImage from 'next/image';
import { createPortal } from 'react-dom';
import { useTranslation } from '../lib/context/LanguageContext';
import { ServiceFactory } from '../lib/services/ServiceFactory';
import { Upload, X, Loader2, Star, Maximize2, ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

export interface ImageMetadata {
  originalName: string;
  size: number;
  width: number;
  height: number;
  uploadedAt: string;
  thumbnailUrl: string;
  contentHash?: string;
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
  const { language } = useTranslation();
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Store all active Object URLs to guarantee clean up on unmount
  const activeObjectURLsRef = useRef<Set<string>>(new Set());

  // Unified items list (completed files + active uploads in stable positions)
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isOrganizerOpen, setIsOrganizerOpen] = useState(false);

  // Sync completed images from parent with our local items
  useEffect(() => {
    queueMicrotask(() => {
      setItems(prev => {
        const activeUploads = prev.filter(item => item.type === 'uploading' || item.type === 'processing');
        const completedItems = images.map(url => {
          const existing = prev.find(item => item.url === url);
          return existing || { id: url, type: 'completed' as const, url };
        });
        return [...completedItems, ...activeUploads];
      });
    });
  }, [images]);

  // Clean up all active ObjectURLs on unmount
  useEffect(() => {
    const activeObjectURLs = activeObjectURLsRef.current;
    return () => {
      activeObjectURLs.forEach(url => {
        URL.revokeObjectURL(url);
      });
      activeObjectURLs.clear();
    };
  }, []);

  useEffect(() => {
    if (!isOrganizerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOrganizerOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOrganizerOpen]);

  // Toast notifier helper
  const showToast = (message: string, type: 'success' | 'error') => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // States for desktop & touch drag-and-drop reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const touchStartIndexRef = useRef<number | null>(null);
  const organizerScrollRef = useRef<HTMLDivElement | null>(null);
  const organizerAutoScrollFrameRef = useRef<number | null>(null);
  const organizerAutoScrollSpeedRef = useRef(0);

  const stopOrganizerAutoScroll = () => {
    organizerAutoScrollSpeedRef.current = 0;
    if (organizerAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(organizerAutoScrollFrameRef.current);
      organizerAutoScrollFrameRef.current = null;
    }
  };

  const runOrganizerAutoScroll = () => {
    const scroller = organizerScrollRef.current;
    if (!scroller || organizerAutoScrollSpeedRef.current === 0) {
      organizerAutoScrollFrameRef.current = null;
      return;
    }
    scroller.scrollTop += organizerAutoScrollSpeedRef.current;
    organizerAutoScrollFrameRef.current = window.requestAnimationFrame(runOrganizerAutoScroll);
  };

  const updateOrganizerAutoScroll = (clientY: number) => {
    const scroller = organizerScrollRef.current;
    if (!scroller) return;
    const rect = scroller.getBoundingClientRect();
    const edgeZone = Math.min(96, Math.max(56, rect.height * 0.16));
    let nextSpeed = 0;

    if (clientY < rect.top + edgeZone) {
      const intensity = Math.min(1, Math.max(0, (rect.top + edgeZone - clientY) / edgeZone));
      nextSpeed = -(5 + intensity * 15);
    } else if (clientY > rect.bottom - edgeZone) {
      const intensity = Math.min(1, Math.max(0, (clientY - (rect.bottom - edgeZone)) / edgeZone));
      nextSpeed = 5 + intensity * 15;
    }

    organizerAutoScrollSpeedRef.current = nextSpeed;
    if (nextSpeed === 0) {
      stopOrganizerAutoScroll();
    } else if (organizerAutoScrollFrameRef.current === null) {
      organizerAutoScrollFrameRef.current = window.requestAnimationFrame(runOrganizerAutoScroll);
    }
  };

  useEffect(() => () => {
    if (organizerAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(organizerAutoScrollFrameRef.current);
    }
  }, []);

  const storageService = ServiceFactory.getStorageService();

  const hashFile = async (file: File): Promise<string> => {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest))
      .map((value) => value.toString(16).padStart(2, '0'))
      .join('');
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

  // Optimization helper utilizing HTML5 Canvas client-side
  const processAndOptimizeImage = (file: File): Promise<{
    galleryFile: File;
    thumbFile: File;
    width: number;
    height: number;
    brightness: number;
    qualityScore: number;
    recommendations: string[];
  }> => {
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

        const analysisCanvas = document.createElement('canvas');
        analysisCanvas.width = 64;
        analysisCanvas.height = 64;
        const analysisContext = analysisCanvas.getContext('2d', { willReadFrequently: true });
        let brightness = 50;
        let contrast = 0;
        if (analysisContext) {
          analysisContext.drawImage(img, 0, 0, 64, 64);
          const pixels = analysisContext.getImageData(0, 0, 64, 64).data;
          const luminance: number[] = [];
          for (let index = 0; index < pixels.length; index += 4) {
            luminance.push(
              (0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]) / 255,
            );
          }
          const mean = luminance.reduce((sum, value) => sum + value, 0) / luminance.length;
          const variance = luminance.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / luminance.length;
          brightness = Math.round(mean * 100);
          contrast = Math.min(100, Math.round(Math.sqrt(variance) * 250));
        }

        const recommendations: string[] = [];
        if (brightness < 25) recommendations.push('La fotografía está oscura; mejora la iluminación.');
        if (brightness > 88) recommendations.push('La fotografía parece sobreexpuesta.');
        if (contrast < 12) recommendations.push('La fotografía tiene poco contraste o detalle.');
        if (width < 1600 && height < 1600) recommendations.push('Usa una fotografía de mayor resolución.');

        const resolutionScore = Math.min(40, Math.round((Math.max(width, height) / 1920) * 40));
        const exposureScore = Math.max(0, 30 - Math.round(Math.abs(brightness - 58) * 0.75));
        const contrastScore = Math.min(30, Math.round(contrast * 1.5));
        const qualityScore = Math.max(0, Math.min(100, resolutionScore + exposureScore + contrastScore));

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
            resolve({
              galleryFile,
              thumbFile,
              width,
              height,
              brightness,
              qualityScore,
              recommendations,
            });
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

    // Accept every pixel dimension and file size. Images are normalized to a
    // gallery WEBP and thumbnail before upload, so only the source format
    // needs to be validated here.
    let validFiles = filesArray.filter(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const isValidFormat = allowedTypes.includes(file.type) || allowedExtensions.includes(ext);

      if (!isValidFormat) {
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

    setUploadProgress(15);
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.floor(Math.random() * 12) + 5;
      });
    }, 450);

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

    const newMetadataItems: Record<string, ImageMetadata> = {};
    const seenContentHashes = new Set(
      Object.values(imagesMetadata)
        .map((metadata) => metadata.contentHash)
        .filter((hash): hash is string => Boolean(hash)),
    );

    const uploadPromises = uploadJobs.map(async (job) => {
      let reservedContentHash: string | null = null;
      try {
        // Transition state to 'processing' (client optimization)
        setItems(prev => prev.map(item => item.id === job.jobId ? { ...item, type: 'processing' as const } : item));

        const [processed, contentHash] = await Promise.all([
          processAndOptimizeImage(job.file),
          hashFile(job.file),
        ]);
        const {
          galleryFile,
          thumbFile,
          width,
          height,
          brightness,
          qualityScore,
          recommendations,
        } = processed;

        if (seenContentHashes.has(contentHash)) {
          throw new Error('DUPLICATE_IMAGE');
        }
        seenContentHashes.add(contentHash);
        reservedContentHash = contentHash;

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
          contentHash,
          imageAnalysis: {
            qualityScore,
            brightness,
            duplicate: false,
            recommendations,
          }
        };

        newMetadataItems[galleryUrl] = metadataItem;
        return galleryUrl;
      } catch (err: any) {
        if (reservedContentHash) seenContentHashes.delete(reservedContentHash);
        console.error('[ImageUploadDropzone] Error in upload job:', job.file.name, err);
        
        // Remove failed upload slot
        setItems(prev => prev.filter(item => item.id !== job.jobId));
        URL.revokeObjectURL(job.tempUrl);
        activeObjectURLsRef.current.delete(job.tempUrl);

        if (err.message === 'DUPLICATE_IMAGE') {
          showToast(
            language === 'es'
              ? 'Esta fotografía ya forma parte de la galería.'
              : 'This photo is already in the gallery.',
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
    clearInterval(progressInterval);
    setUploadProgress(100);
    setTimeout(() => {
      setUploadProgress(0);
    }, 1000);
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

  const moveImage = (fromIndex: number, toIndex: number) => {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= images.length ||
      toIndex >= images.length
    ) return;

    const reordered = [...images];
    const [movedImage] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, movedImage);
    onChange(reordered);
  };

  // Drag and Drop completed items reordering
  const handleDragStart = (e: React.DragEvent<HTMLElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    updateOrganizerAutoScroll(e.clientY);
  };

  const handleDragEnter = (index: number) => {
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    stopOrganizerAutoScroll();
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDropImage = (index: number) => {
    stopOrganizerAutoScroll();
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
  const handleTouchStart = (e: React.TouchEvent<HTMLElement>, index: number) => {
    touchStartIndexRef.current = index;
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLElement>) => {
    if (touchStartIndexRef.current === null) return;
    
    const touch = e.touches[0];
    updateOrganizerAutoScroll(touch.clientY);
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
    stopOrganizerAutoScroll();
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
        accept="image/jpeg,image/png,image/webp"
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
                  ? 'Cualquier tamaño o resolución · JPG, PNG o WEBP'
                  : 'Any file size or resolution · JPG, PNG or WEBP'
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
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-brand-gray-500">
                {language === 'es' ? 'Galería de imágenes' : 'Image gallery'}
              </span>
              <span className="mt-0.5 block text-[10px] font-semibold text-brand-gray-400">
                {language === 'es' ? 'La primera foto será la portada.' : 'The first photo will be the cover.'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {images.length > 1 && (
                <button
                  type="button"
                  onClick={() => setIsOrganizerOpen(true)}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-brand-black bg-white px-3 text-[10px] font-black uppercase tracking-wide text-brand-black transition hover:bg-brand-black hover:text-white"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                  {language === 'es' ? 'Organizar fotos' : 'Organize photos'}
                </button>
              )}
              <span className="rounded-md bg-brand-gray-100 px-2.5 py-1 text-[10px] font-black text-brand-gray-500">
                {images.length} / 40
              </span>
            </div>
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
                        <NextImage
                          src={item.tempUrl}
                          alt="Preview"
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          unoptimized
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
                    onDragOver={handleDragOver}
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
                      className={`relative w-full h-full rounded-xl overflow-hidden group shadow-sm bg-brand-gray-200 cursor-grab active:cursor-grabbing transition-all duration-200 ${
                        isDragTarget ? 'ring-2 ring-brand-accent shadow-premium scale-105' : 'hover:scale-[1.01] border border-brand-gray-200/40'
                      }`}
                    >
                      <NextImage
                        src={displayUrl}
                        alt={`Listing photo ${index + 1}`}
                        fill
                        sizes="(max-width: 768px) 50vw, 25vw"
                        unoptimized
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

      {isOrganizerOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/65 backdrop-blur-sm sm:items-center sm:p-6">
          <button
            type="button"
            aria-label={language === 'es' ? 'Cerrar organizador' : 'Close organizer'}
            className="absolute inset-0 cursor-default"
            onClick={() => setIsOrganizerOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="gallery-organizer-title"
            className="relative z-10 flex h-[92dvh] w-full max-w-[1380px] flex-col overflow-hidden rounded-t-[30px] bg-[#f8f7f3] shadow-2xl sm:h-[84dvh] sm:rounded-[30px]"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-black/5 bg-white px-5 py-4 sm:px-7 sm:py-5">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-accent">
                  {language === 'es' ? 'Orden de publicación' : 'Listing order'}
                </span>
                <h3 id="gallery-organizer-title" className="mt-1 text-xl font-black tracking-tight text-brand-black sm:text-2xl">
                  {language === 'es' ? 'Organiza tus fotografías' : 'Organize your photos'}
                </h3>
                <p className="mt-1 max-w-2xl text-xs font-semibold text-brand-gray-500">
                  {language === 'es'
                    ? 'Arrastra las fotos o usa las flechas. La posición 1 será la portada del anuncio.'
                    : 'Drag photos or use the arrows. Position 1 will be the listing cover.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOrganizerOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-gray-200 bg-white text-brand-gray-500 transition hover:border-brand-black hover:text-brand-black"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div
              ref={organizerScrollRef}
              onDragOver={(event) => {
                event.preventDefault();
                updateOrganizerAutoScroll(event.clientY);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  stopOrganizerAutoScroll();
                }
              }}
              className="select-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4"
            >
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
                {images.map((url, index) => {
                  const displayUrl = imagesMetadata[url]?.thumbnailUrl || url;
                  const isBeingDragged = draggedIndex === index;
                  const isDragTarget = dragOverIndex === index && draggedIndex !== index;
                  return (
                    <article
                      key={url}
                      draggable
                      data-index={index}
                      onDragStart={(event) => handleDragStart(event, index)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDragEnter={() => handleDragEnter(index)}
                      onDrop={() => handleDropImage(index)}
                      onTouchStart={(event) => handleTouchStart(event, index)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      className={`overflow-hidden rounded-xl border bg-white shadow-sm transition ${
                        isBeingDragged ? 'opacity-40' : ''
                      } ${isDragTarget ? 'border-brand-accent ring-2 ring-brand-accent/30' : 'border-brand-gray-200'}`}
                    >
                      <div className="relative aspect-[4/3] cursor-grab touch-none overflow-hidden bg-brand-gray-100 active:cursor-grabbing">
                        <NextImage
                          src={displayUrl}
                          alt={`${language === 'es' ? 'Fotografía' : 'Photo'} ${index + 1}`}
                          fill
                          sizes="(max-width: 768px) 50vw, 25vw"
                          unoptimized
                          className="h-full w-full object-cover pointer-events-none"
                          loading="lazy"
                          decoding="async"
                        />
                        <div className="absolute left-1.5 top-1.5 flex items-center gap-1 rounded-full bg-black/72 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide text-white backdrop-blur">
                          <GripVertical className="h-3 w-3" />
                          {index === 0 ? (language === 'es' ? 'Portada' : 'Cover') : `#${index + 1}`}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-1 p-1.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveImage(index, index - 1)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand-gray-200 text-brand-black transition hover:border-brand-black disabled:cursor-not-allowed disabled:opacity-25"
                          aria-label={language === 'es' ? 'Mover una posición atrás' : 'Move one position back'}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSetCover(index)}
                          disabled={index === 0}
                          className={`flex min-h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg px-1 text-[8px] font-black uppercase tracking-wide transition ${
                            index === 0
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-brand-gray-100 text-brand-black hover:bg-brand-black hover:text-white'
                          }`}
                        >
                          <Star className={`h-3 w-3 shrink-0 ${index === 0 ? 'fill-current' : ''}`} />
                          {index === 0
                            ? (language === 'es' ? 'Portada' : 'Cover')
                            : (language === 'es' ? 'Elegir' : 'Choose')}
                        </button>
                        <button
                          type="button"
                          disabled={index === images.length - 1}
                          onClick={() => moveImage(index, index + 1)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-brand-gray-200 text-brand-black transition hover:border-brand-black disabled:cursor-not-allowed disabled:opacity-25"
                          aria-label={language === 'es' ? 'Mover una posición adelante' : 'Move one position forward'}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-black/5 bg-white px-5 py-4 sm:px-7">
              <span className="text-xs font-bold text-brand-gray-500">
                {images.length} {language === 'es' ? 'fotografías ordenadas' : 'photos organized'}
              </span>
              <button
                type="button"
                onClick={() => setIsOrganizerOpen(false)}
                className="min-h-11 rounded-full bg-brand-black px-6 text-[10px] font-black uppercase tracking-wider text-white shadow-lg transition hover:-translate-y-0.5"
              >
                {language === 'es' ? 'Guardar orden' : 'Save order'}
              </button>
            </footer>
          </section>
        </div>,
        document.body,
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
