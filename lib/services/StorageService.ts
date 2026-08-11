import { supabase } from '../supabaseClient';

export interface IStorageService {
  uploadImage(file: File): Promise<string>;
  uploadImagePair(galleryFile: File, thumbFile: File): Promise<{ galleryUrl: string; thumbnailUrl: string }>;
  deleteImage(url: string): Promise<boolean>;
}

export class SupabaseStorageService implements IStorageService {
  private bucketName = 'property-images';

  private async getAuthenticatedUploadPrefix(): Promise<string> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw new Error('Debes iniciar sesión para subir archivos de una propiedad.');
    }
    return data.user.id;
  }

  private createObjectName(extension: string): string {
    const safeExtension = extension.toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
    const id = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    return `${id}.${safeExtension}`;
  }

  async uploadImage(file: File): Promise<string> {
    const userPrefix = await this.getAuthenticatedUploadPrefix();
    const fileExt = file.name.split('.').pop() || 'webp';
    const filePath = `${userPrefix}/${this.createObjectName(fileExt)}`;

    const { error } = await supabase.storage
      .from(this.bucketName)
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
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
    const userPrefix = await this.getAuthenticatedUploadPrefix();
    const baseName = this.createObjectName('webp').replace(/\.webp$/, '');
    const galleryPath = `${userPrefix}/${baseName}.webp`;
    const thumbPath = `${userPrefix}/${baseName}-thumb.webp`;

    const { error: gError } = await supabase.storage
      .from(this.bucketName)
      .upload(galleryPath, galleryFile, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: false,
      });

    if (gError) {
      console.error('[SupabaseStorageService] Gallery upload error:', gError.message);
      throw gError;
    }

    const { error: tError } = await supabase.storage
      .from(this.bucketName)
      .upload(thumbPath, thumbFile, {
        contentType: 'image/webp',
        cacheControl: '31536000',
        upsert: false,
      });

    if (tError) {
      await supabase.storage.from(this.bucketName).remove([galleryPath]);
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
      const filePath = decodeURIComponent(parts[1].split('?')[0]);
      const extensionIndex = filePath.lastIndexOf('.');
      const thumbnailPath = extensionIndex >= 0
        ? `${filePath.slice(0, extensionIndex)}-thumb${filePath.slice(extensionIndex)}`
        : `${filePath}-thumb.webp`;

      const { error } = await supabase.storage
        .from(this.bucketName)
        .remove([filePath, thumbnailPath]);

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
