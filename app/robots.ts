import type { MetadataRoute } from 'next';
import { getPublicAppOrigin } from '../lib/authUrls';

export default function robots(): MetadataRoute.Robots {
  const origin = getPublicAppOrigin();

  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/explore', '/property/'],
      disallow: [
        '/api/',
        '/admin/',
        '/dashboard/',
        '/login',
        '/signup',
        '/onboarding/',
        '/reset-password',
      ],
    },
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}

