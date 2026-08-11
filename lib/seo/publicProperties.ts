import 'server-only';

import { cache } from 'react';
import { createClient } from '@supabase/supabase-js';
import { getPublicAppOrigin } from '../authUrls';

export interface PublicPropertySeoRecord {
  id: string;
  title: string;
  description: string;
  type: string | null;
  location: string | null;
  country: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  isDemo: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string[];
  publishedAt: string | null;
  updatedAt: string | null;
  images: string[];
}

interface PublicPropertyRow {
  id: string;
  title: string;
  description: string;
  type: string | null;
  location: string | null;
  country: string | null;
  address: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  max_guests: number | null;
  is_demo: boolean | null;
  meta_title: string | null;
  meta_description: string | null;
  meta_keywords: string[] | null;
  published_at: string | null;
  updated_at: string | null;
}

interface PublicMediaRow {
  property_id: string;
  url: string;
  display_order: number | null;
  is_primary: boolean | null;
}

const getPublicClient = () => {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!rawUrl || !anonKey) return null;

  const url = rawUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
};

const toNumberOrNull = (value: number | string | null): number | null => {
  if (value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const mapRecord = (row: PublicPropertyRow, media: PublicMediaRow[] = []): PublicPropertySeoRecord => ({
  id: row.id,
  title: row.title,
  description: row.description,
  type: row.type,
  location: row.location,
  country: row.country,
  address: row.address,
  latitude: toNumberOrNull(row.latitude),
  longitude: toNumberOrNull(row.longitude),
  bedrooms: row.bedrooms,
  bathrooms: row.bathrooms,
  maxGuests: row.max_guests,
  isDemo: row.is_demo === true,
  metaTitle: row.meta_title,
  metaDescription: row.meta_description,
  metaKeywords: row.meta_keywords || [],
  publishedAt: row.published_at,
  updatedAt: row.updated_at,
  images: media
    .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || (a.display_order || 0) - (b.display_order || 0))
    .map((item) => item.url)
    .filter(Boolean),
});

const PROPERTY_SELECT = [
  'id',
  'title',
  'description',
  'type',
  'location',
  'country',
  'address',
  'latitude',
  'longitude',
  'bedrooms',
  'bathrooms',
  'max_guests',
  'is_demo',
  'meta_title',
  'meta_description',
  'meta_keywords',
  'published_at',
  'updated_at',
].join(',');

export const getPublicPropertyForSeo = cache(async (id: string): Promise<PublicPropertySeoRecord | null> => {
  const client = getPublicClient();
  if (!client || !id) return null;

  const { data, error } = await client
    .from('public_properties_view')
    .select(PROPERTY_SELECT)
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle();

  if (error || !data) {
    if (error && error.code !== 'PGRST116') {
      console.warn('[seo] Unable to load public property metadata:', error.message);
    }
    return null;
  }

  const { data: media, error: mediaError } = await client
    .from('public_property_media_view')
    .select('property_id,url,display_order,is_primary')
    .eq('property_id', id)
    .eq('media_type', 'IMAGE')
    .order('display_order', { ascending: true });

  if (mediaError) {
    console.warn('[seo] Unable to load public property media:', mediaError.message);
  }

  return mapRecord(data as unknown as PublicPropertyRow, (media || []) as PublicMediaRow[]);
});

export const listPublicPropertiesForSitemap = async (): Promise<PublicPropertySeoRecord[]> => {
  const client = getPublicClient();
  if (!client) return [];

  const { data, error } = await client
    .from('public_properties_view')
    .select(PROPERTY_SELECT)
    .eq('is_published', true)
    .or('is_demo.eq.false,is_demo.is.null')
    .order('published_at', { ascending: false });

  if (error || !data) {
    if (error) console.warn('[seo] Unable to build property sitemap:', error.message);
    return [];
  }

  return (data as unknown as PublicPropertyRow[]).map((row) => mapRecord(row));
};

export const getCanonicalPropertyUrl = (id: string): string =>
  `${getPublicAppOrigin()}/property/${encodeURIComponent(id)}`;

