const DEFAULT_APP_ORIGIN = 'https://towersmexico.com';

export const getPublicAppOrigin = (): string => {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return (configuredOrigin || DEFAULT_APP_ORIGIN).replace(/\/+$/, '');
};

export const getAuthRedirectUrl = (path: string): string => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getPublicAppOrigin()}${normalizedPath}`;
};
