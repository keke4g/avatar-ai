-- Private, valuation-only corrections backed by public evidence. These rows
-- never alter the published listing, its address, or its publication status.

create table if not exists valuation.property_subject_overrides (
  property_id uuid primary key references public.properties(id) on delete cascade,
  surface_built_m2 numeric check (surface_built_m2 is null or surface_built_m2 > 0),
  surface_total_m2 numeric check (surface_total_m2 is null or surface_total_m2 > 0),
  neighborhood text,
  city text,
  state text,
  review_status text not null default 'PENDING'
    check (review_status in ('PENDING', 'VERIFIED', 'REJECTED')),
  evidence_confidence numeric not null default 0
    check (evidence_confidence between 0 and 1),
  evidence_urls text[] not null default '{}',
  evidence_note text not null default '',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table valuation.property_subject_overrides enable row level security;
revoke all on valuation.property_subject_overrides from public, anon, authenticated;
grant select, insert, update, delete on valuation.property_subject_overrides to service_role;

insert into valuation.property_subject_overrides (
  property_id,
  surface_built_m2,
  surface_total_m2,
  neighborhood,
  city,
  state,
  review_status,
  evidence_confidence,
  evidence_urls,
  evidence_note,
  verified_at,
  updated_at
) values
  (
    '322e2053-3778-4331-a268-f4e68e07ba3d',
    163.51,
    null,
    'Desarrollo Urbano Tres Ríos',
    'Culiacán Rosales',
    'Sinaloa',
    'VERIFIED',
    0.99,
    array['https://www.towersmexico.com/casas/cuatro-rios-departamento-tea-7/1'],
    'Coincidencia exacta de modelo Tea, precio, recámaras y ubicación; la ficha original informa 163.51 m².',
    now(),
    now()
  ),
  (
    '6280c0b5-f3d0-4be6-b57b-363407af3b9b',
    50,
    null,
    'Villa Universidad',
    'Culiacán Rosales',
    'Sinaloa',
    'VERIFIED',
    0.93,
    array[
      'https://www.nestoria.mx/villa-universidad_culiacan/departamento/renta',
      'https://casas.trovit.com.mx/renta-departamento-culiacan-ciudad-universitaria'
    ],
    'Coincidencia de precio, una recámara, un baño, descripción y 50 m²; publicaciones sindicadas se tratan como una sola evidencia.',
    now(),
    now()
  ),
  (
    'e83974de-bd16-4ccd-bba3-ffa31f381c48',
    60,
    60,
    'Tetlán',
    'Guadalajara',
    'Jalisco',
    'VERIFIED',
    0.98,
    array[
      'https://departamento.mercadolibre.com.mx/MLM-5438860588-departamento-venta-2r-60m2-presa-laurel-condominio-tetlan-guadalajara-_JM',
      'https://aristia-inmobiliaria.easybroker.com/property/venta-2r-60m2-presa-laurel-condominio-tetlan-guadalajara'
    ],
    'Modelo Rosa de Presa Laurel: coincidencia exacta de modelo, terraza, dos recámaras, un baño y 60 m².',
    now(),
    now()
  ),
  (
    '9659584a-b8f7-4a03-8ebb-d49b72b95605',
    181,
    181,
    'Zona Dorada',
    'Mazatlán',
    'Sinaloa',
    'VERIFIED',
    0.90,
    array[
      'https://www.vivanuncios.com.mx/a-venta-departamento/fraccionamiento-sabalo-country-club/departamento-en-fraccionamiento-sabalo-country-club/149134699',
      'https://www.inmuebles24.com/propiedades/clasificado/veclapin-departamento-en-fraccionamiento-sabalo-country-club-149134681.html'
    ],
    'Corrección privada para valuación: coincidencia de precio, tres recámaras, dos baños y 181 m². Las coordenadas públicas contradictorias no se usan.',
    now(),
    now()
  ),
  (
    'bf28aec2-f369-48c0-a1cb-ab9878ecfbf9',
    null,
    null,
    'Villas de Oriente II',
    'Tonalá',
    'Jalisco',
    'VERIFIED',
    0.99,
    array[
      'https://www.waze.com/live-map/directions/mexico/jalisco/guadalajara/villas-del-oriente-ii?to=place.ChIJs93c-o2zKIQRApmAvMlsiqU',
      'https://www.iepcjalisco.org.mx/sites/default/files/mapas2012/PSI142697.pdf'
    ],
    'La cartografía y navegación pública ubican Villas de Oriente II en Tonalá, Jalisco.',
    now(),
    now()
  )
on conflict (property_id) do update set
  surface_built_m2 = excluded.surface_built_m2,
  surface_total_m2 = excluded.surface_total_m2,
  neighborhood = excluded.neighborhood,
  city = excluded.city,
  state = excluded.state,
  review_status = excluded.review_status,
  evidence_confidence = excluded.evidence_confidence,
  evidence_urls = excluded.evidence_urls,
  evidence_note = excluded.evidence_note,
  verified_at = excluded.verified_at,
  updated_at = now();

comment on table valuation.property_subject_overrides is
  'Private, provenance-backed valuation inputs. They do not mutate public property inventory.';
