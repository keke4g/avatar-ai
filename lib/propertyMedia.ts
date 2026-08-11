import type { Property } from './types';

export interface PropertyGalleryMediaItem {
  type: 'image' | 'video' | 'youtube' | 'vimeo';
  url: string;
}

export function getPropertyGalleryMedia(property?: Property): PropertyGalleryMediaItem[] {
  if (!property) return [];

  if (property.media && property.media.length > 0) {
    const mediaItems: PropertyGalleryMediaItem[] = [];
    for (const media of property.media) {
      if (media.mediaType === 'IMAGE') mediaItems.push({ type: 'image', url: media.url });
      else if (media.mediaType === 'VIDEO' || media.mediaType === 'DRONE') mediaItems.push({ type: 'video', url: media.url });
      else if (media.mediaType === 'YOUTUBE') mediaItems.push({ type: 'youtube', url: media.url });
      else if (media.mediaType === 'VIMEO') mediaItems.push({ type: 'vimeo', url: media.url });
    }
    return mediaItems;
  }

  return (property.images || []).map((url) => ({ type: 'image', url }));
}
