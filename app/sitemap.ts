import type { MetadataRoute } from 'next';
import { getPublicAppOrigin } from '../lib/authUrls';
import {
  getCanonicalPropertyUrl,
  listPublicPropertiesForSitemap,
} from '../lib/seo/publicProperties';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getPublicAppOrigin();
  const properties = await listPublicPropertiesForSitemap();

  const staticEntries: MetadataRoute.Sitemap = [
    {
      url: origin,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${origin}/explore`,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...[
      'como-funciona',
      'estandares',
      'seguridad',
      'tarifas',
      'privacidad',
      'terminos',
      'cookies',
      'eliminar-cuenta',
    ].map((slug) => ({
      url: `${origin}/info/${slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    })),
  ];

  return [
    ...staticEntries,
    ...properties.map((property) => ({
      url: getCanonicalPropertyUrl(property.id),
      lastModified: property.updatedAt || property.publishedAt || undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      images: property.images,
    })),
  ];
}

