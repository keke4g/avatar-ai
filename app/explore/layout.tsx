import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Explorar propiedades en México',
  description: 'Explora propiedades verificadas en venta, renta o intercambio en Towers México.',
  alternates: { canonical: '/explore' },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  openGraph: {
    url: '/explore',
    title: 'Explorar propiedades en México | Towers México',
    description: 'Catálogo de propiedades verificadas para comprar, rentar o intercambiar en México.',
  },
};

export default function ExploreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
