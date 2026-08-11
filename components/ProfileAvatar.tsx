"use client";

import React from 'react';
import Image from 'next/image';

interface ProfileAvatarProps {
  name?: string | null;
  src?: string | null;
  className?: string;
  textClassName?: string;
  alt?: string;
}

const palette = [
  'bg-[#171717] text-white',
  'bg-[#e9ddff] text-[#5b35a8]',
  'bg-[#dff5e8] text-[#175c3a]',
  'bg-[#ffe5d2] text-[#8b3e13]',
  'bg-[#dcecff] text-[#1f4f8c]',
];

export function getProfileInitial(name?: string | null): string {
  const normalized = name?.trim();
  return normalized ? normalized.charAt(0).toLocaleUpperCase('es-MX') : 'A';
}

export default function ProfileAvatar({
  name,
  src,
  className = 'h-10 w-10',
  textClassName = 'text-sm',
  alt,
}: ProfileAvatarProps) {
  const initial = getProfileInitial(name);
  const paletteIndex = initial.codePointAt(0)! % palette.length;
  const normalizedSource = src?.trim() || '';
  const isGeneratedPlaceholder = normalizedSource.includes('avatar-placeholder.svg');
  const isLegacyStockAvatar = normalizedSource.includes('photo-1535713875002-d1d0cf377fde');
  const usableSource = normalizedSource && !isGeneratedPlaceholder && !isLegacyStockAvatar
    ? normalizedSource
    : '';

  return (
    <span
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-black uppercase ${palette[paletteIndex]} ${className}`}
      aria-label={!usableSource ? (alt || `Perfil de ${name || 'Towers México'}`) : undefined}
    >
      <span className={`${textClassName} leading-none`} aria-hidden="true">{initial}</span>
      {usableSource && (
        <Image
          key={usableSource}
          src={usableSource}
          alt={alt || name || 'Foto de perfil'}
          fill
          sizes="64px"
          unoptimized
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = 'none';
          }}
        />
      )}
    </span>
  );
}
