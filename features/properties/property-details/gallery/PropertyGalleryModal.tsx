import { memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Download, Maximize, Play, Share } from 'lucide-react';
import Image from 'next/image';
import type { LanguageType } from '@/lib/context/LanguageContext';
import type { Property } from '@/lib/types';
import { PropertyMediaItem } from '../PropertyMediaItem';
import type { PropertyGalleryController } from './usePropertyGallery';

interface PropertyGalleryModalProps {
  controller: PropertyGalleryController;
  language: LanguageType;
  property: Property;
}

function toggleFullScreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch((error) => {
      console.error(`Error enabling fullscreen: ${error.message}`);
    });
  } else if (document.exitFullscreen) {
    document.exitFullscreen();
  }
}

export const PropertyGalleryModal = memo(function PropertyGalleryModal({
  controller,
  language,
  property,
}: PropertyGalleryModalProps) {
  const {
    galleryIndex,
    handleDoubleClick,
    handleNextImage,
    handlePrevImage,
    isGalleryOpen,
    isZoomed,
    mediaItems,
    panOffset,
    selectGalleryItem,
    setIsGalleryOpen,
    setPanOffset,
    zoomScale,
  } = controller;
  const currentItem = mediaItems[galleryIndex];

  return (
    <AnimatePresence>
      {isGalleryOpen && mediaItems.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-[#09090b]/98 backdrop-blur-xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between p-4 md:p-6 bg-gradient-to-b from-black/60 to-transparent z-10 text-white">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsGalleryOpen(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                title={language === 'es' ? 'Cerrar' : 'Close'}
              >
                <ChevronLeft className="w-6 h-6 rotate-180" />
              </button>
              <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase text-brand-accent tracking-widest">
                  {language === 'es' ? 'Galería Premium' : 'Premium Gallery'}
                </span>
                <span className="text-xs font-bold text-brand-gray-300">
                  {galleryIndex + 1} / {mediaItems.length}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleFullScreen}
                className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-brand-gray-300 hover:text-white"
                title="Fullscreen"
              >
                <Maximize className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!currentItem) return;
                  const link = document.createElement('a');
                  link.href = currentItem.url;
                  link.download = `propiedad-${property.id}-media-${galleryIndex + 1}`;
                  link.target = '_blank';
                  link.click();
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-brand-gray-300 hover:text-white"
                title="Descargar"
              >
                <Download className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!currentItem) return;
                  navigator.clipboard.writeText(currentItem.url);
                  alert(language === 'es' ? 'Enlace copiado al portapapeles.' : 'URL copied to clipboard.');
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer text-brand-gray-300 hover:text-white"
                title="Compartir enlace"
              >
                <Share className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="flex-1 w-full flex items-center justify-center relative overflow-hidden px-4 md:px-16">
            <button
              type="button"
              onClick={handlePrevImage}
              className="absolute left-4 md:left-8 p-3 bg-white/5 hover:bg-white/15 border border-white/10 rounded-full text-white transition-colors cursor-pointer z-10 hidden sm:block"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div className="w-full h-full flex items-center justify-center relative">
              {currentItem?.type === 'image' ? (
                <motion.img
                  key={galleryIndex}
                  src={currentItem.url}
                  alt={`${property.title} - ${galleryIndex + 1}`}
                  animate={{ scale: zoomScale, x: panOffset.x, y: panOffset.y }}
                  drag={isZoomed}
                  dragConstraints={{ left: -300 * zoomScale, right: 300 * zoomScale, top: -200 * zoomScale, bottom: 200 * zoomScale }}
                  dragElastic={0.1}
                  onDragEnd={(_, info) => setPanOffset({ x: info.offset.x, y: info.offset.y })}
                  onDoubleClick={handleDoubleClick}
                  className={`max-w-full max-h-[75vh] object-contain rounded-xl select-none shadow-2xl transition-shadow ${isZoomed ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`}
                />
              ) : (
                <div className="w-full max-w-4xl aspect-video rounded-xl overflow-hidden shadow-2xl bg-black flex items-center justify-center">
                  <PropertyMediaItem
                    item={currentItem}
                    title={property.title}
                    className="w-full h-full object-contain"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextImage}
              className="absolute right-4 md:right-8 p-3 bg-white/5 hover:bg-white/15 border border-white/10 rounded-full text-white transition-colors cursor-pointer z-10 hidden sm:block"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          <div className="bg-gradient-to-t from-black/80 to-transparent p-6 z-10">
            <div className="flex justify-center gap-2 max-w-full overflow-x-auto py-2 no-scrollbar">
              {mediaItems.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => selectGalleryItem(index)}
                  className={`relative w-16 h-12 rounded-lg overflow-hidden shrink-0 transition-all border-2 cursor-pointer ${galleryIndex === index ? 'border-brand-accent scale-105' : 'border-transparent opacity-50 hover:opacity-100'}`}
                >
                  {item.type === 'image' ? (
                    <Image
                      src={item.url}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      sizes="64px"
                      className="object-cover"
                      unoptimized
                    />
                  ) : item.type === 'video' ? (
                    <div className="w-full h-full bg-brand-black flex items-center justify-center relative">
                      <video src={item.url} className="w-full h-full object-cover opacity-60" muted />
                      <Play className="absolute w-4 h-4 text-white fill-white" />
                    </div>
                  ) : (
                    <div className="w-full h-full bg-brand-black flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-brand-accent/40" />
                      <span className="absolute text-[8px] font-black text-white uppercase tracking-wider">3D</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
