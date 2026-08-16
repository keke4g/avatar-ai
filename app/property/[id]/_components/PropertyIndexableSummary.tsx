import Image from 'next/image';
import Link from 'next/link';
import { Bath, BedDouble, MapPin } from 'lucide-react';
import type { PublicPropertySeoRecord } from '../../../../lib/seo/publicProperties';

interface PropertyIndexableSummaryProps {
  property: PublicPropertySeoRecord;
}

export default function PropertyIndexableSummary({ property }: PropertyIndexableSummaryProps) {
  const image = property.images[0];
  const location = [property.location, property.country]
    .filter((value, index, values) => Boolean(value) && values.indexOf(value) === index)
    .join(', ');

  return (
    <main className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-10 lg:px-16" aria-label={`Ficha de ${property.title}`}>
      <section className="grid overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.10)] lg:grid-cols-[1.05fr_0.95fr]">
        <div className="relative min-h-[300px] overflow-hidden bg-slate-100 sm:min-h-[440px]">
          {image ? (
            <Image
              src={image}
              alt={property.title}
              fill
              priority
              unoptimized
              sizes="(max-width: 1024px) 100vw, 54vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(14,165,233,0.2),transparent_35%),linear-gradient(145deg,#eef2f7,#dbe3ec)]" />
          )}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/55 to-transparent" aria-hidden="true" />
          <span className="absolute bottom-5 left-5 rounded-full border border-white/25 bg-black/65 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-white backdrop-blur-md">
            Propiedad publicada
          </span>
        </div>

        <div className="flex flex-col justify-center px-6 py-8 sm:px-10 sm:py-12 lg:px-12">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-sky-600">Towers México</p>
          <h1 className="mt-3 text-3xl font-black leading-[1.02] tracking-[-0.045em] text-slate-950 sm:text-5xl">
            {property.title}
          </h1>
          {location && (
            <p className="mt-5 flex items-start gap-2 text-sm font-semibold leading-6 text-slate-500">
              <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              {location}
            </p>
          )}

          {(property.bedrooms || property.bathrooms) && (
            <dl className="mt-7 flex flex-wrap gap-3">
              {property.bedrooms ? (
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5">
                  <BedDouble aria-hidden="true" className="h-4 w-4 text-slate-500" />
                  <dt className="sr-only">Recámaras</dt>
                  <dd className="text-xs font-black text-slate-800">{property.bedrooms} recámaras</dd>
                </div>
              ) : null}
              {property.bathrooms ? (
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5">
                  <Bath aria-hidden="true" className="h-4 w-4 text-slate-500" />
                  <dt className="sr-only">Baños</dt>
                  <dd className="text-xs font-black text-slate-800">{property.bathrooms} baños</dd>
                </div>
              ) : null}
            </dl>
          )}

          <div className="mt-8 border-t border-slate-200 pt-7">
            <h2 className="text-sm font-black text-slate-950">Descripción</h2>
            <p className="mt-2 line-clamp-5 text-sm font-medium leading-7 text-slate-600">
              {property.description}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              <span className="h-2 w-2 animate-pulse rounded-full bg-sky-500" aria-hidden="true" />
              Preparando experiencia interactiva
            </span>
            <Link href="/explore" className="text-xs font-black text-slate-950 underline decoration-sky-500 decoration-2 underline-offset-4">
              Explorar catálogo
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
