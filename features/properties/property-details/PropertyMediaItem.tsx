import { memo } from 'react';
import Image from 'next/image';
import { getYouTubeEmbedUrl } from '@/lib/mediaEmbeds';
import type { PropertyGalleryMediaItem } from './propertyDetailsData';

type RenderableMediaItem = PropertyGalleryMediaItem | {
  type: 'youtube';
  url: string;
};

interface PropertyMediaItemProps {
  item: RenderableMediaItem;
  title: string;
  className?: string;
}

export const PropertyMediaItem = memo(function PropertyMediaItem({
  item,
  title,
  className,
}: PropertyMediaItemProps) {
  if (item.type === 'youtube') {
    const embedUrl = getYouTubeEmbedUrl(item.url);
    if (!embedUrl) return null;

    return (
      <iframe
        src={embedUrl}
        className={`${className} border-0`}
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    );
  }

  if (item.type === 'video') {
    return (
      <video
        src={item.url}
        controls
        className={className}
      />
    );
  }

  return (
    <Image
      src={item.url}
      alt={title}
      width={1600}
      height={1200}
      sizes="(max-width: 767px) 100vw, 50vw"
      unoptimized
      className={className}
      loading="lazy"
      decoding="async"
    />
  );
});
