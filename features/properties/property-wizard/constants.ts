import type { WizardStep } from './types';

export const WIZARD_STEP_COPY: Record<WizardStep, { title: string; description: string }> = {
  0: {
    title: '¿Quién publica esta propiedad?',
    description: 'Define tu rol para adaptar la distribución legal y las herramientas de contacto.',
  },
  1: {
    title: 'Cuéntanos lo esencial',
    description: 'Agrega el título, tipo de inmueble y una descripción clara de la propiedad.',
  },
  2: {
    title: '¿Dónde se encuentra?',
    description: 'Ubica la propiedad con precisión y decide qué información será pública.',
  },
  3: {
    title: '¿Cómo quieres comercializarla?',
    description: 'Elige uno o varios canales: intercambio, renta o venta.',
  },
  4: {
    title: 'Características y superficies',
    description: 'Describe la distribución, capacidad y medidas del inmueble.',
  },
  5: {
    title: 'Espacios y amenidades',
    description: 'Distingue los espacios propios, el equipamiento privado y las amenidades compartidas.',
  },
  6: {
    title: 'Configura el intercambio',
    description: 'Indica qué buscas recibir y bajo qué condiciones aceptarías un swap.',
  },
  7: {
    title: 'Condiciones de renta',
    description: 'Define precios, depósitos, disponibilidad y reglas de arrendamiento.',
  },
  8: {
    title: 'Precio y situación legal',
    description: 'Completa los términos comerciales y el expediente necesario para la venta.',
  },
  9: {
    title: 'Galería y multimedia',
    description: 'Sube las imágenes y recorridos que ayudarán a presentar la propiedad.',
  },
  10: {
    title: 'Esquema comercial',
    description: 'Configura exclusividad, comisiones y colaboración con la red.',
  },
  11: {
    title: 'Revisa antes de enviar',
    description: 'Confirma la calidad y la información del anuncio antes de enviarlo a revisión.',
  },
  12: {
    title: 'Datos del propietario',
    description: 'Guarda el contacto privado y las indicaciones necesarias para coordinar visitas.',
  },
};

