import { PropertyMedia, PropertyMediaType } from '../types';
import { toCamelCase, toSnakeCase } from './PropertyMapper';

export class PropertyMediaMapper {
  /**
   * Converts a database row to a client PropertyMedia object.
   */
  public static mapPostgresToClient(row: any): PropertyMedia {
    const media: Record<string, any> = {};

    for (const [key, value] of Object.entries(row)) {
      const camelKey = toCamelCase(key);
      media[camelKey] = value;
    }

    // Auto-generate thumbnail_url if missing and we have a valid provider/url
    let thumbnailUrl = media.thumbnailUrl || null;
    if (!thumbnailUrl && media.url) {
      thumbnailUrl = this.generateThumbnail(media.mediaType, media.url);
    }

    return {
      id: media.id,
      propertyId: media.propertyId || media.property_id,
      mediaType: media.mediaType as PropertyMediaType,
      storageBucket: media.storageBucket || media.storage_bucket || null,
      storagePath: media.storagePath || media.storage_path || null,
      url: media.url,
      thumbnailUrl: thumbnailUrl,
      title: media.title || null,
      description: media.description || null,
      displayOrder: media.displayOrder !== undefined ? Number(media.displayOrder) : 0,
      isPrimary: !!media.isPrimary,
      metadata: media.metadata || {},
      mimeType: media.mimeType || media.mime_type || null,
      fileSize: media.fileSize !== undefined ? Number(media.fileSize) : null,
      durationSeconds: media.durationSeconds !== undefined ? Number(media.durationSeconds) : null,
      width: media.width !== undefined ? Number(media.width) : null,
      height: media.height !== undefined ? Number(media.height) : null,
      createdAt: media.createdAt || media.created_at,
      updatedAt: media.updatedAt || media.updated_at,
      deletedAt: media.deletedAt || media.deleted_at || null,
    };
  }

  /**
   * Converts a client PropertyMedia object to a database row.
   */
  public static mapClientToPostgres(media: Partial<PropertyMedia>): Record<string, any> {
    const rawPayload: Record<string, any> = {};

    for (const [key, value] of Object.entries(media)) {
      const snakeKey = toSnakeCase(key);
      rawPayload[snakeKey] = value;
    }

    // Ensure metadata is stringified/JSON-safe if it's an object
    if (rawPayload.metadata && typeof rawPayload.metadata === 'object') {
      // Keep it as object, Supabase-js client handles serialization
    } else {
      rawPayload.metadata = {};
    }

    // Only keep database schema valid columns
    const mediaColumns = [
      'id',
      'property_id',
      'media_type',
      'storage_bucket',
      'storage_path',
      'url',
      'thumbnail_url',
      'title',
      'description',
      'display_order',
      'is_primary',
      'metadata',
      'mime_type',
      'file_size',
      'duration_seconds',
      'width',
      'height',
      'created_at',
      'updated_at',
      'deleted_at'
    ];

    return Object.fromEntries(
      Object.entries(rawPayload).filter(([key]) => mediaColumns.includes(key))
    );
  }

  /**
   * Helper to extract video ID and generate high-quality thumbnail preview URL.
   */
  private static generateThumbnail(type: PropertyMediaType, url: string): string | null {
    if (!url) return null;

    try {
      if (type === 'YOUTUBE') {
        let videoId = '';
        if (url.includes('youtube.com')) {
          const parts = url.split('v=');
          if (parts.length > 1) videoId = parts[1].split('&')[0];
        } else if (url.includes('youtu.be')) {
          const parts = url.split('/');
          videoId = parts[parts.length - 1].split('?')[0];
        }
        if (videoId) {
          return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }
      }

      if (type === 'VIMEO') {
        let videoId = '';
        const parts = url.split('/');
        videoId = parts[parts.length - 1].split('?')[0];
        if (videoId) {
          // Fallback to simple Vimeo thumbnail generator service
          return `https://vumbnail.com/${videoId}.jpg`;
        }
      }

      if (type === 'MATTERPORT') {
        // Matterport generic preview placeholder
        return 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=80';
      }

      if (type === 'VIDEO') {
        // Local video preview placeholder
        return 'https://images.unsplash.com/photo-1598257006458-087169a1f08d?auto=format&fit=crop&w=600&q=80';
      }

      if (type === 'FLOORPLAN') {
        // Architectural blueprint preview icon/placeholder
        return 'https://images.unsplash.com/photo-1504917595217-d4dc5ebe6122?auto=format&fit=crop&w=600&q=80';
      }

      if (type === 'DOCUMENT') {
        // Generic document placeholder
        return 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=600&q=80';
      }
    } catch (e) {
      console.warn('Error generating thumbnail for', type, url, e);
    }

    return null;
  }
}
