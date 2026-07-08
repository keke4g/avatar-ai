import { supabase } from '../supabaseClient';

export interface IStorageService {
  uploadImage(file: File): Promise<string>;
  uploadImagePair(galleryFile: File, thumbFile: File): Promise<{ galleryUrl: string; thumbnailUrl: string }>;
  deleteImage(url: string): Promise<boolean>;
}

export class SupabaseStorageService implements IStorageService {
  private bucketName = 'property-images';

  async uploadImage(file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${fileName}`;

    const { data, error } = await supabase.storage
      .from(this.bucketName)
      .upload(filePath, file, {
        contentType: file.type,
      });

    if (error) {
      console.error('[SupabaseStorageService] Upload error:', error.message);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    return publicUrl;
  }

  async uploadImagePair(galleryFile: File, thumbFile: File): Promise<{ galleryUrl: string; thumbnailUrl: string }> {
    const baseName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    const galleryPath = `${baseName}.webp`;
    const thumbPath = `${baseName}-thumb.webp`;

    const { error: gError } = await supabase.storage
      .from(this.bucketName)
      .upload(galleryPath, galleryFile);

    if (gError) {
      console.error('[SupabaseStorageService] Gallery upload error:', gError.message);
      throw gError;
    }

    const { error: tError } = await supabase.storage
      .from(this.bucketName)
      .upload(thumbPath, thumbFile);

    if (tError) {
      console.error('[SupabaseStorageService] Thumbnail upload error:', tError.message);
      throw tError;
    }

    const { data: { publicUrl: galleryUrl } } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(galleryPath);

    const { data: { publicUrl: thumbnailUrl } } = supabase.storage
      .from(this.bucketName)
      .getPublicUrl(thumbPath);

    return { galleryUrl, thumbnailUrl };
  }

  async deleteImage(url: string): Promise<boolean> {
    try {
      // Extract filepath from public URL
      // Example public URL: https://[project-id].supabase.co/storage/v1/object/public/property-images/1715000000-abc.jpg
      const parts = url.split(`/storage/v1/object/public/${this.bucketName}/`);
      if (parts.length < 2) return false;
      const filePath = parts[1];

      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath]);

      if (error) {
        console.error('[SupabaseStorageService] Delete error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      console.error('[SupabaseStorageService] Exception parsing file path for deletion:', err);
      return false;
    }
  }
}

export class InMemoryStorageService implements IStorageService {
  async uploadImage(file: File): Promise<string> {
    console.log('[InMemoryStorageService] Mock upload for file:', file.name);
    const isBrowser = typeof window !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
    return isBrowser
      ? URL.createObjectURL(file)
      : 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80';
  }

  async uploadImagePair(galleryFile: File, thumbFile: File): Promise<{ galleryUrl: string; thumbnailUrl: string }> {
    console.log('[InMemoryStorageService] Mock upload pair for files:', galleryFile.name, thumbFile.name);
    const isBrowser = typeof window !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function';
    
    const galleryUrl = isBrowser 
      ? URL.createObjectURL(galleryFile) 
      : 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80';
      
    const thumbnailUrl = isBrowser 
      ? URL.createObjectURL(thumbFile) 
      : 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=400&q=80';

    return { galleryUrl, thumbnailUrl };
  }

  async deleteImage(url: string): Promise<boolean> {
    console.log('[InMemoryStorageService] Mock delete for URL:', url);
    if (url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch (err) {
        console.warn('[InMemoryStorageService] Failed to revoke URL:', url, err);
      }
    }
    return true;
  }
}
