import { supabase } from '../supabaseClient';
import { useSupabase } from './ServiceFactory';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

async function cropAvatarToWebp(file: File): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    const objectUrl = URL.createObjectURL(file);
    element.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(element);
    };
    element.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen.'));
    };
    element.src = objectUrl;
  });

  const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
  if (sourceSize < 160) {
    throw new Error('La imagen debe medir al menos 160 × 160 px.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Tu navegador no pudo preparar la imagen.');

  const sourceX = (image.naturalWidth - sourceSize) / 2;
  const sourceY = (image.naturalHeight - sourceSize) / 2;
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 512, 512);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error('No se pudo optimizar la imagen.')),
      'image/webp',
      0.86,
    );
  });

  return new File([blob], 'avatar.webp', { type: 'image/webp' });
}

export async function uploadProfileAvatar(userId: string, file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('Usa una imagen JPG, PNG o WebP.');
  }
  if (file.size <= 0 || file.size > MAX_AVATAR_BYTES) {
    throw new Error('La imagen debe pesar menos de 5 MB.');
  }

  const optimized = await cropAvatarToWebp(file);

  if (!useSupabase) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('No se pudo guardar la imagen.'));
      reader.readAsDataURL(optimized);
    });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData.user?.id !== userId) {
    throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
  }

  const objectPath = `${userId}/avatar.webp`;
  const { error: uploadError } = await supabase.storage
    .from('profile-avatars')
    .upload(objectPath, optimized, {
      upsert: true,
      contentType: 'image/webp',
      cacheControl: '3600',
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data } = supabase.storage.from('profile-avatars').getPublicUrl(objectPath);
  const publicUrl = `${data.publicUrl}?v=${crypto.randomUUID()}`;
  const { error: profileError } = await supabase.rpc('set_my_profile_avatar', {
    target_avatar_url: publicUrl,
  });
  if (profileError) throw new Error(profileError.message);

  return publicUrl;
}

export async function removeProfileAvatar(userId: string): Promise<void> {
  if (!useSupabase) return;

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || authData.user?.id !== userId) {
    throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
  }

  const { error: profileError } = await supabase.rpc('set_my_profile_avatar', {
    target_avatar_url: null,
  });
  if (profileError) throw new Error(profileError.message);

  const { error: storageError } = await supabase.storage
    .from('profile-avatars')
    .remove([`${userId}/avatar.webp`]);
  if (storageError && !storageError.message.toLowerCase().includes('not found')) {
    throw new Error(storageError.message);
  }
}
