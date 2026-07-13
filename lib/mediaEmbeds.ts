export type VirtualTourProvider = 'youtube' | 'vimeo' | 'matterport' | 'generic';

function parseHttpUrl(value: string): URL | null {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed : null;
  } catch {
    return null;
  }
}

function cleanVideoId(value: string | null | undefined): string | null {
  const candidate = value?.trim() || '';
  return /^[A-Za-z0-9_-]{11}$/.test(candidate) ? candidate : null;
}

export function getYouTubeVideoId(value: string): string | null {
  const url = parseHttpUrl(value);
  if (!url) return null;

  const host = url.hostname.toLocaleLowerCase().replace(/^www\./, '');
  if (host === 'youtu.be') {
    return cleanVideoId(url.pathname.split('/').filter(Boolean)[0]);
  }

  const isYouTubeHost = host === 'youtube.com'
    || host.endsWith('.youtube.com')
    || host === 'youtube-nocookie.com'
    || host.endsWith('.youtube-nocookie.com');
  if (!isYouTubeHost) return null;

  const queryId = cleanVideoId(url.searchParams.get('v'));
  if (queryId) return queryId;

  const pathParts = url.pathname.split('/').filter(Boolean);
  if (['embed', 'shorts', 'live'].includes(pathParts[0])) {
    return cleanVideoId(pathParts[1]);
  }

  return null;
}

export function getYouTubeEmbedUrl(value: string): string | null {
  const videoId = getYouTubeVideoId(value);
  return videoId
    ? `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&playsinline=1`
    : null;
}

export function getYouTubeThumbnailUrl(value: string): string | null {
  const videoId = getYouTubeVideoId(value);
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
}

export function getVimeoEmbedUrl(value: string): string | null {
  const url = parseHttpUrl(value);
  if (!url || !url.hostname.toLocaleLowerCase().endsWith('vimeo.com')) return null;

  const videoId = [...url.pathname.split('/').filter(Boolean)]
    .reverse()
    .find((part) => /^\d+$/.test(part));
  return videoId ? `https://player.vimeo.com/video/${videoId}` : null;
}

export function getVirtualTourProvider(value: string): VirtualTourProvider {
  if (getYouTubeVideoId(value)) return 'youtube';
  if (getVimeoEmbedUrl(value)) return 'vimeo';

  const url = parseHttpUrl(value);
  if (url?.hostname.toLocaleLowerCase().endsWith('matterport.com')) return 'matterport';
  return 'generic';
}

export function getEmbeddableMediaUrl(value: string): string | null {
  return getYouTubeEmbedUrl(value)
    || getVimeoEmbedUrl(value)
    || parseHttpUrl(value)?.toString()
    || null;
}
