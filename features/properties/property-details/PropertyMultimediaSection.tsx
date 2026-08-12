import { memo, useMemo, useState } from 'react';
import { Building, Compass, Download, FileText, Maximize, Play } from 'lucide-react';
import Image from 'next/image';
import { PropertySectionCard } from '@/components/property/PropertySectionCard';
import type { LanguageType } from '@/lib/context/LanguageContext';
import { getEmbeddableMediaUrl, getVimeoEmbedUrl, getYouTubeEmbedUrl } from '@/lib/mediaEmbeds';
import type { Property } from '@/lib/types';

interface PropertyMultimediaSectionProps {
  language: LanguageType;
  property: Property;
}

export const PropertyMultimediaSection = memo(function PropertyMultimediaSection({
  language,
  property,
}: PropertyMultimediaSectionProps) {
  const [activeMediaTab, setActiveMediaTab] = useState('');
  const [activeVideoIndex, setActiveVideoIndex] = useState(0);
  const { documents, floorplans, videos, virtualTours } = useMemo(() => {
    const mediaList = property.media || [];
    return {
      videos: mediaList.filter((media) => ['VIDEO', 'YOUTUBE', 'VIMEO', 'DRONE'].includes(media.mediaType)),
      virtualTours: mediaList.filter((media) => ['MATTERPORT', 'VIRTUAL_TOUR'].includes(media.mediaType)),
      floorplans: mediaList.filter((media) => media.mediaType === 'FLOORPLAN'),
      documents: mediaList.filter((media) => media.mediaType === 'DOCUMENT'),
    };
  }, [property]);

  const availableTabs = [
    videos.length > 0 && 'video',
    virtualTours.length > 0 && 'virtual',
    floorplans.length > 0 && 'floorplan',
    documents.length > 0 && 'document',
  ].filter(Boolean) as string[];
  const currentTab = availableTabs.includes(activeMediaTab) ? activeMediaTab : (availableTabs[0] || '');

  if (availableTabs.length === 0) return null;

  return (
    <PropertySectionCard
      icon={Play}
      eyebrow={language === 'es' ? 'Contenido multimedia' : 'Media content'}
      title={language === 'es' ? 'Multimedia y recorridos' : 'Multimedia & tours'}
      description={language === 'es'
        ? 'Explora videos, recorridos virtuales, planos y documentos de la propiedad.'
        : 'Explore videos, virtual tours, floor plans, and property documents.'}
      contentClassName="p-4 sm:p-5"
    >
      <div className="grid grid-cols-2 gap-1 rounded-2xl border border-brand-gray-100 bg-brand-gray-100 p-1 sm:flex sm:overflow-x-auto">
        {videos.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setActiveMediaTab('video');
              setActiveVideoIndex(0);
            }}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 py-2 text-center text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap sm:flex-1 sm:px-4 sm:text-xs ${currentTab === 'video' ? 'bg-white text-brand-black shadow-sm font-black' : 'text-brand-gray-500 hover:text-brand-black'}`}
          >
            <Play className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{language === 'es' ? 'Videos' : 'Videos'} ({videos.length})</span>
          </button>
        )}
        {virtualTours.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveMediaTab('virtual')}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 py-2 text-center text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap sm:flex-1 sm:px-4 sm:text-xs ${currentTab === 'virtual' ? 'bg-white text-brand-black shadow-sm font-black' : 'text-brand-gray-500 hover:text-brand-black'}`}
          >
            <Compass className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{language === 'es' ? 'Tour 3D / VR' : '3D / VR Tour'} ({virtualTours.length})</span>
          </button>
        )}
        {floorplans.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveMediaTab('floorplan')}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 py-2 text-center text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap sm:flex-1 sm:px-4 sm:text-xs ${currentTab === 'floorplan' ? 'bg-white text-brand-black shadow-sm font-black' : 'text-brand-gray-500 hover:text-brand-black'}`}
          >
            <Building className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{language === 'es' ? 'Planos' : 'Floor Plans'} ({floorplans.length})</span>
          </button>
        )}
        {documents.length > 0 && (
          <button
            type="button"
            onClick={() => setActiveMediaTab('document')}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-2 py-2 text-center text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap sm:flex-1 sm:px-4 sm:text-xs ${currentTab === 'document' ? 'bg-white text-brand-black shadow-sm font-black' : 'text-brand-gray-500 hover:text-brand-black'}`}
          >
            <FileText className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{language === 'es' ? 'Documentación' : 'Documents'} ({documents.length})</span>
          </button>
        )}
      </div>

      <div className="relative w-full overflow-hidden rounded-3xl border border-brand-gray-200/50 bg-brand-gray-100 shadow-inner">
        {currentTab === 'video' && videos.length > 0 && (() => {
          const activeVideo = videos[activeVideoIndex] || videos[0];
          return (
            <div className="relative flex w-full flex-col bg-brand-black">
              <div className="relative aspect-video w-full min-h-[190px] sm:min-h-0">
                {activeVideo.mediaType === 'VIDEO' ? (
                  <video
                    src={activeVideo.url}
                    className="w-full h-full object-contain"
                    controls
                    playsInline
                    preload="metadata"
                  />
                ) : activeVideo.mediaType === 'VIMEO' ? (
                  <iframe
                    src={getVimeoEmbedUrl(activeVideo.url) || activeVideo.url}
                    className="w-full h-full border-0"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                ) : (
                  <iframe
                    src={getYouTubeEmbedUrl(activeVideo.url) || activeVideo.url}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    loading="lazy"
                  />
                )}
              </div>

              {videos.length > 1 && (
                <div className="bg-brand-black/90 p-3 flex gap-2 overflow-x-auto shrink-0 border-t border-brand-gray-900 w-full">
                  {videos.map((video, index) => (
                    <button
                      key={video.id || index}
                      onClick={() => setActiveVideoIndex(index)}
                      className={`relative w-24 aspect-video rounded-lg overflow-hidden border-2 shrink-0 transition-all ${index === activeVideoIndex ? 'border-brand-accent scale-95 shadow-md' : 'border-transparent opacity-60 hover:opacity-100'}`}
                    >
                      {video.thumbnailUrl ? (
                        <Image
                          src={video.thumbnailUrl}
                          alt=""
                          fill
                          sizes="96px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center bg-neutral-900 text-white" aria-hidden="true">
                          <Play className="h-4 w-4" />
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="text-[10px] text-white font-bold bg-brand-black/70 px-1.5 py-0.5 rounded">
                          {video.mediaType}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })()}

        {currentTab === 'virtual' && virtualTours.length > 0 && (() => {
          const activeTour = virtualTours[0];
          const embedUrl = getEmbeddableMediaUrl(activeTour.url);
          return (
            <div className="relative aspect-video w-full min-h-[210px] sm:min-h-0">
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  title={activeTour.title || (language === 'es' ? 'Recorrido virtual de la propiedad' : 'Property virtual tour')}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; xr-spatial-tracking; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm font-semibold text-brand-gray-500">
                  {language === 'es' ? 'El enlace de este recorrido no es válido.' : 'This tour link is not valid.'}
                </div>
              )}
            </div>
          );
        })()}

        {currentTab === 'floorplan' && floorplans.length > 0 && (() => {
          const activePlan = floorplans[0];
          return (
            <div className="group relative flex aspect-[4/3] w-full items-center justify-center bg-white p-4 sm:aspect-video">
              {activePlan.url && (
                <div className="relative h-full w-full">
                  <Image
                    src={activePlan.url}
                    alt={activePlan.title || 'Plano'}
                    fill
                    sizes="(max-width: 640px) calc(100vw - 64px), 640px"
                    className="rounded-2xl object-contain"
                    unoptimized
                  />
                </div>
              )}
              <div className="absolute top-4 right-4 flex gap-2">
                <a
                  href={activePlan.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-brand-black/80 hover:bg-brand-black text-white px-4 py-2.5 rounded-full text-xs font-black shadow-lg backdrop-blur-sm transition-all flex items-center gap-1.5"
                >
                  <Maximize className="w-4 h-4" />
                  <span>{language === 'es' ? 'Ver original' : 'View original'}</span>
                </a>
              </div>
            </div>
          );
        })()}

        {currentTab === 'document' && documents.length > 0 && (
          <div className="grid w-full grid-cols-1 gap-3 bg-white p-4 sm:p-6 md:grid-cols-2 md:gap-4">
            {documents.map((document, index) => (
              <div
                key={document.id || index}
                className="bg-brand-gray-50 border border-brand-gray-200/60 p-4 rounded-3xl shadow-sm hover:shadow-md transition-all flex items-center justify-between gap-4 group h-fit"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-brand-black truncate group-hover:text-brand-accent transition-colors">
                      {document.title || `Documento #${index + 1}`}
                    </h4>
                    <p className="text-[10px] text-brand-gray-400 font-semibold">
                      {document.fileSize ? `${Math.round(document.fileSize / 1024 / 1024 * 100) / 100} MB` : 'PDF'}
                    </p>
                  </div>
                </div>
                <a
                  href={document.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-white hover:bg-brand-accent hover:text-white border border-brand-gray-200 text-brand-black p-2.5 rounded-full transition-all shrink-0 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </PropertySectionCard>
  );
});
