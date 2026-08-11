import type { Metadata } from 'next';
import PublicProfileClient from './PublicProfileClient';

interface PublicProfilePageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: 'Perfil inmobiliario',
  description: 'Conoce al responsable de la publicación y explora sus propiedades disponibles.',
};

export default async function PublicProfilePage({ params }: PublicProfilePageProps) {
  const { id } = await params;
  return <PublicProfileClient profileId={id} />;
}
