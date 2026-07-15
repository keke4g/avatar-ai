import { Metadata } from 'next';
import { MOCK_PROPERTIES, USER_PROPERTIES } from '../../../lib/mockData';
import PropertyDetailsClient from './PropertyDetailsClient';

interface PropertyDetailsPageProps {
  params: Promise<{ id: string }>;
}

// 1. Dynamic SEO Metadata Generation (Open Graph / Production Indexing Ready)
export async function generateMetadata({ params }: PropertyDetailsPageProps): Promise<Metadata> {
  const { id } = await params;
  const property = [...USER_PROPERTIES, ...MOCK_PROPERTIES].find((p) => p.id === id);

  if (!property) {
    return {
      title: 'Propiedad en AuraSwap — detalles, costos y contacto',
      description: 'Consulta la información, características, costos y opciones de contacto de esta propiedad en AuraSwap.',
    };
  }

  const excerpt = property.description.length > 150 
    ? `${property.description.slice(0, 150)}...` 
    : property.description;

  return {
    title: `${property.title} — Home Swap in ${property.location} | AuraSwap`,
    description: excerpt,
    openGraph: {
      title: `${property.title} — Direct Swap Exchange`,
      description: excerpt,
      images: [
        {
          url: property.images[0],
          width: 1200,
          height: 630,
          alt: property.title,
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${property.title} — AuraSwap`,
      description: excerpt,
      images: [property.images[0]],
    },
  };
}

export default async function PropertyDetailsPage({ params }: PropertyDetailsPageProps) {
  const { id } = await params;
  return <PropertyDetailsClient id={id} />;
}
