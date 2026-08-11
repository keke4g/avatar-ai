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
  ];

  return [
    ...staticEntries,
    ...properties.map((property) => ({
      url: getCanonicalPropertyUrl(property.id),
      lastModified: property.updatedAt || property.publishedAt || undefined,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ];
}

