"use client";

import { useRef, useState } from 'react';
import { Camera, Loader2, RotateCcw, Upload } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';
import { removeProfileAvatar, uploadProfileAvatar } from '../lib/services/ProfileAvatarService';
import { useTranslation } from '../lib/context/LanguageContext';

interface ProfilePhotoUploaderProps {
  userId: string;
  name: string;
  value?: string | null;
  onChange: (url: string) => void;
  compact?: boolean;
}

export default function ProfilePhotoUploader({
  userId,
  name,
  value,
  onChange,
  compact = false,
}: ProfilePhotoUploaderProps) {
  const { language } = useTranslation();
  const copy = language === 'es';
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const choosePhoto = () => inputRef.current?.click();

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setLoading(true);
    setError('');
    try {
      onChange(await uploadProfileAvatar(userId, file));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : (copy ? 'No se pudo subir la imagen.' : 'We could not upload the image.'));
    } finally {
      setLoading(false);
    }
  };

  const handleUseInitial = async () => {
    setLoading(true);
    setError('');
    try {
      await removeProfileAvatar(userId);
      onChange('');
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : (copy ? 'No se pudo quitar la imagen.' : 'We could not remove the image.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`rounded-3xl border border-brand-gray-200 bg-brand-gray-50/55 ${compact ? 'p-4' : 'p-5'}`}>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFile}
        className="hidden"
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={choosePhoto}
          disabled={loading}
          className="group relative mx-auto rounded-full sm:mx-0"
          aria-label={copy ? 'Subir foto de perfil' : 'Upload profile photo'}
        >
          <ProfileAvatar
            name={name}
            src={value}
            className={compact ? 'h-16 w-16 ring-4 ring-white shadow-md' : 'h-20 w-20 ring-4 ring-white shadow-md'}
            textClassName={compact ? 'text-xl' : 'text-2xl'}
          />
          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-brand-black text-white shadow-sm transition group-hover:scale-105">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </span>
        </button>

        <div className="flex-1 text-center sm:text-left">
          <p className="text-xs font-black text-brand-black">
            {copy ? 'Tu inicial es tu imagen predeterminada' : 'Your initial is your default image'}
          </p>
          <p className="mt-1 text-[10px] font-semibold leading-relaxed text-brand-gray-500">
            {copy
              ? 'Puedes subir una fotografía cuando quieras. La ajustaremos y optimizaremos automáticamente.'
              : 'You can upload a photo whenever you like. We will crop and optimize it automatically.'}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <button
              type="button"
              onClick={choosePhoto}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-black px-3.5 py-2 text-[9px] font-black uppercase tracking-wider text-white transition hover:bg-brand-black/90 disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {copy ? 'Subir fotografía' : 'Upload photo'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => void handleUseInitial()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-full border border-brand-gray-200 bg-white px-3.5 py-2 text-[9px] font-black uppercase tracking-wider text-brand-black transition hover:bg-brand-gray-50 disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {copy ? 'Usar inicial' : 'Use initial'}
              </button>
            )}
          </div>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-[10px] font-bold text-rose-600">{error}</p>}
    </div>
  );
}
