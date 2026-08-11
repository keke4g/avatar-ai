import { memo } from 'react';
import { ChevronLeft, ChevronRight, Compass, Play, ZoomIn } from 'lucide-react';
import type { LanguageType } from '@/lib/context/LanguageContext';
import type { Property } from '@/lib/types';
import { PropertyMediaItem } from '../PropertyMediaItem';
import type { PropertyGalleryController } from './usePropertyGallery';

interface PropertyGalleryHeroProps {
  controller: PropertyGalleryController;
  language: LanguageType;
  property: Property;
}

export const PropertyGalleryHero = memo(function PropertyGalleryHero({
  controller,
  language,
  property,
}: PropertyGalleryHeroProps) {
  const {
    handleNextHeroMedia,
    handlePrevHeroMedia,
    heroMediaIndex,
    mediaItems,
    openGallery,
  } = controller;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 rounded-2xl overflow-hidden shadow-premium mb-10 cursor-pointer">
      <div
        onClick={() => openGallery(heroMediaIndex)}
        className="md:col-span-2 aspect-[4/3] md:aspect-square relative overflow-hidden bg-brand-gray-100 group"
      >
        <div className="h-full w-full md:hidden">
          {mediaItems[heroMediaIndex] ? (
            <PropertyMediaItem
              item={mediaItems[heroMediaIndex]}
              title={property.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-brand-gray-100">
              <Compass className="h-12 w-12 animate-pulse text-brand-gray-300" />
            </div>
          )}
        </div>
        <div className="hidden h-full w-full md:block">
          {mediaItems[0] ? (
            <PropertyMediaItem
              item={mediaItems[0]}
              title={property.title}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-brand-gray-100">
              <Compass className="h-12 w-12 animate-pulse text-brand-gray-300" />
            </div>
          )}
        </div>

        <div className="absolute inset-0 hidden items-center justify-center bg-black/10 opacity-0 transition-opacity duration-300 group-hover:opacity-100 md:flex">
          <span className="bg-white/95 text-brand-black text-xs font-black px-4 py-2 rounded-full shadow-md flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
            <ZoomIn className="w-3.5 h-3.5" />
            <span>{language === 'es' ? 'Ver galería' : 'View gallery'}</span>
          </span>
        </div>

        {mediaItems.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 flex -translate-y-1/2 items-center justify-between px-3 md:hidden">
            <button
              type="button"
              onClick={handlePrevHeroMedia}
              aria-label={language === 'es' ? 'Imagen anterior' : 'Previous image'}
              className="group/arrow pointer-events-auto flex h-12 w-12 items-center justify-center border-0 bg-transparent transition-transform active:scale-90"
            >
              <ChevronLeft aria-hidden="true" className="liquid-glass-chevron h-9 w-9 transition-all group-active/arrow:scale-90" />
            </button>
            <button
              type="button"
              onClick={handleNextHeroMedia}
              aria-label={language === 'es' ? 'Imagen siguiente' : 'Next image'}
              className="group/arrow pointer-events-auto flex h-12 w-12 items-center justify-center border-0 bg-transparent transition-transform active:scale-90"
            >
              <ChevronRight aria-hidden="true" className="liquid-glass-chevron h-9 w-9 transition-all group-active/arrow:scale-90" />
            </button>
          </div>
        )}

        {mediaItems.length > 1 && (
          <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 md:hidden">
            {mediaItems.map((_, index) => (
              <span
                key={index}
                className={`h-1.5 rounded-full shadow-sm transition-all ${index === heroMediaIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/55'}`}
              />
            ))}
          </div>
        )}

        {mediaItems[heroMediaIndex]?.type === 'video' && (
          <div className="absolute right-4 top-4 z-10 flex items-center justify-center rounded-full bg-brand-black/60 p-2 text-white md:hidden">
            <Play className="w-4 h-4 fill-white text-white" />
          </div>
        )}
        {mediaItems[0]?.type === 'video' && (
          <div className="absolute right-4 top-4 z-10 hidden items-center justify-center rounded-full bg-brand-black/60 p-2 text-white md:flex">
            <Play className="w-4 h-4 fill-white text-white" />
          </div>
        )}
      </div>

      <div className="hidden md:grid md:col-span-2 grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, indexOffset) => {
          const index = indexOffset + 1;
          const item = mediaItems[index];
          if (!item) {
            return (
              <div key={`fallback-${index}`} className="aspect-square bg-brand-gray-100 flex items-center justify-center border border-brand-gray-200/50">
                <Compass className="w-8 h-8 text-brand-gray-300 animate-pulse" />
              </div>
            );
          }
          return (
            <div
              key={index}
              onClick={() => openGallery(index)}
              className="aspect-square relative overflow-hidden bg-brand-gray-100 group"
            >
              <PropertyMediaItem
                item={item}
                title={property.title}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500 ease-out"
              />
              <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <span className="bg-white/95 text-brand-black text-[10px] font-black px-3 py-1.5 rounded-full shadow-sm">
                  {language === 'es' ? 'Ver más' : 'View more'}
                </span>
              </div>
              {item.type === 'video' && (
                <div className="absolute top-2 right-2 bg-brand-black/60 text-white p-1.5 rounded-full z-10 flex items-center justify-center">
                  <Play className="w-3.5 h-3.5 fill-white text-white" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
