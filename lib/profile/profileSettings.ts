export interface ProfileSettingsInput {
  name: string;
  bio: string;
  location: string;
  avatar: string;
}

export function normalizeProfileSettings(input: ProfileSettingsInput): ProfileSettingsInput {
  const name = input.name.trim().replace(/\s+/g, ' ');

  if (!name) {
    throw new Error('El nombre es obligatorio.');
  }

  return {
    name: name.slice(0, 120),
    bio: input.bio.trim().slice(0, 500),
    location: input.location.trim().replace(/\s+/g, ' ').slice(0, 160),
    avatar: input.avatar.trim(),
  };
}
