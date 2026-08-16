import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPublicAppOrigin } from '../../../lib/authUrls';
import {
  getCanonicalPropertyUrl,
  getPublicPropertyForSeo,
} from '../../../lib/seo/publicProperties';
import PropertyDetailsClient from './_components/PropertyDetailsClient';
import PropertyIndexableSummary from './_components/PropertyIndexableSummary';

interface PropertyDetailsPageProps {
  params: Promise<{ id: string }>;
}

const excerpt = (value: string, maxLength = 158): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trimEnd()}…`
    : normalized;
};

export async function generateMetadata({ params }: PropertyDetailsPageProps): Promise<Metadata> {
  const { id } = await params;
  const property = await getPublicPropertyForSeo(id);

  if (!property || property.isDemo) {
    return {
      title: 'Propiedad no disponible',
      description: 'Esta propiedad no está disponible públicamente.',
      robots: { index: false, follow: false },
    };
  }

  const canonical = getCanonicalPropertyUrl(property.id);
  const title = property.metaTitle
    ?.trim()
    .replace(/\s*\|\s*(?:AuraSwap|Towers México)\s*$/i, '')
    || `${property.title} en ${property.location || property.country || 'México'}`;
  const brandedTitle = `${title} | Towers México`;
  const description = excerpt(property.metaDescription?.trim() || property.description);
  const images = property.images.slice(0, 4).map((url) => ({
    url,
    alt: property.title,
  }));

  return {
    metadataBase: new URL(getPublicAppOrigin()),
    title,
    description,
    keywords: property.metaKeywords.length > 0 ? property.metaKeywords : undefined,
    alternates: { canonical },
    robots: { index: true, follow: true },
    openGraph: {
      type: 'website',
      locale: 'es_MX',
      siteName: 'Towers México',
      url: canonical,
      title: brandedTitle,
      description,
      images,
    },
    twitter: {
      card: images.length > 0 ? 'summary_large_image' : 'summary',
      title: brandedTitle,
      description,
      images: images.map((image) => image.url),
    },
  };
}

export default async function PropertyDetailsPage({ params }: PropertyDetailsPageProps) {
  const { id } = await params;
  const property = await getPublicPropertyForSeo(id);

  if (!property || property.isDemo) notFound();

  const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Residence',
        name: property.title,
        description: excerpt(property.description, 500),
        url: getCanonicalPropertyUrl(property.id),
        image: property.images,
        address: {
          '@type': 'PostalAddress',
          addressLocality: property.location || undefined,
          addressCountry: property.country || undefined,
        },
        ...(property.latitude !== null && property.longitude !== null
          ? {
              geo: {
                '@type': 'GeoCoordinates',
                latitude: property.latitude,
                longitude: property.longitude,
              },
            }
          : {}),
        numberOfBedrooms: property.bedrooms || undefined,
        numberOfBathroomsTotal: property.bathrooms || undefined,
        occupancy: property.maxGuests
          ? {
              '@type': 'QuantitativeValue',
              maxValue: property.maxGuests,
            }
          : undefined,
      };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      <PropertyDetailsClient
        id={id}
        initialContent={<PropertyIndexableSummary property={property} />}
      />
    </>
  );
}
