import type { EternaPropertyVisualSection } from './events';

const normalizeVisualPrompt = (prompt: string) => prompt
  .toLocaleLowerCase('es-MX')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

type VisualRule = {
  section: EternaPropertyVisualSection;
  pattern: RegExp;
};

// Order matters: the more specific commercial and evidence intents must be
// resolved before broad words such as "precio", "detalle" or "información".
const VISUAL_RULES: VisualRule[] = [
  {
    section: 'valuation',
    pattern: /\b(?:valuacion|avaluo|estimacion|valor de mercado|rango de valor|comparables?|precio por metro|precio por m2)\b/,
  },
  {
    section: 'mortgage',
    pattern: /\b(?:mensualidad|mensualidades|pago mensual|pagaria al mes|pagar al mes|cuanto pagaria|cuanto se paga al mes|simulador hipotecario|simulacion hipotecaria|calcular hipoteca|calcula(?:r)? (?:mi |la )?mensualidad|enganche|plazo|tasa anual|hipoteca)\b/,
  },
  {
    section: 'financing',
    pattern: /\b(?:opciones? de pago|formas? de pago|metodos? de pago|opciones? de financiamiento|metodos? de financiamiento|financiamiento|financiar|credito bancario|infonavit|fovissste|recursos propios)\b/,
  },
  {
    section: 'legal',
    pattern: /\b(?:legal|juridic|escritura|gravamen|predial|documentacion legal|expediente|regimen|adeudo|documentos? de propiedad)\b/,
  },
  {
    section: 'location',
    pattern: /\b(?:ubicacion|mapa|entorno|alrededores|lugares? cercanos?|que hay cerca|como llegar|escuelas?|hospitales?|parques?|supermercados?)\b/,
  },
  {
    section: 'media',
    pattern: /\b(?:videos?|multimedia|tour virtual|recorrido virtual|tour 3d|planos?|drone|documentos? multimedia)\b/,
  },
  {
    section: 'gallery',
    pattern: /\b(?:fotos?|imagenes?|galeria|portada|fachada)\b/,
  },
  {
    section: 'amenities',
    pattern: /\b(?:amenidades?|comodidades|que ofrece|que incluye|equipamiento|interiores?|exteriores?|areas? interiores?|areas? exteriores?|areas? comunes?|zonas? comunes?|amenidades? privadas?|amenidades? compartidas?|alberca|piscina|jacuzzi|sauna|jardin|gimnasio|gym|roof garden|terraza|balcon|cocina|sala|comedor|cuarto de lavado|lavanderia|estudio|oficina|cochera|patio|elevador|ascensor|vestidor|amueblada|amueblado|aire acondicionado|mascotas?|pet center|zona de mascotas|area de mascotas|game room|cuarto de juegos|sala de juegos|salon de juegos|cinema room|sala de cine|ludoteca|coworking|business center|salon de usos multiples|fire pit|fogatero|asador|huerto|cancha|domotica|alexa|cerradura inteligente|paneles solares|fibra optica|lobby)\b/,
  },
  {
    section: 'contact',
    pattern: /\b(?:datos? de contacto|responsable de la publicacion|quien (?:es|la) (?:el |la )?(?:asesor|agente|propietario)|telefono|whatsapp|correo)\b/,
  },
  {
    section: 'commercial',
    pattern: /\b(?:precio|costo|cuanto cuesta|venta|renta|intercambio|disponibilidad|condiciones comerciales|negociable|oferta)\b/,
  },
  {
    section: 'market',
    pattern: /\b(?:analisis de mercado|mercado inmobiliario|inversion|rendimiento|plusvalia|historial de precio|evidencia comercial|me conviene|la recomiendas|lo recomiendas)\b/,
  },
  {
    section: 'technical',
    pattern: /\b(?:recamaras?|habitaciones?|banos?|metros cuadrados|m2|superficie|terreno|construccion|niveles?|estacionamientos?|cuantos carros|que tan grande|de que tamano|servicios|seguridad|vigilancia|detalles? tecnicos?|especificaciones?)\b/,
  },
  {
    section: 'description',
    pattern: /\b(?:descripcion|como es|cuentame de|hablame de|acerca de)\b/,
  },
  {
    section: 'summary',
    pattern: /\b(?:resumen|resumeme|vista general|panorama|en pocas palabras|lo mas importante|presentame la propiedad|presentacion|informacion general|datos principales)\b/,
  },
];

export function resolvePropertyVisualSection(
  prompt: string,
  knownAmenities: string[] = [],
): EternaPropertyVisualSection | null {
  const normalized = normalizeVisualPrompt(prompt);
  if (!normalized) return null;
  const resolved = VISUAL_RULES.find((rule) => rule.pattern.test(normalized))?.section;
  if (resolved) return resolved;

  const asksAboutPublishedAmenity = knownAmenities.some((amenity) => {
    const normalizedAmenity = normalizeVisualPrompt(amenity);
    return normalizedAmenity.length >= 4 && normalized.includes(normalizedAmenity);
  });
  return asksAboutPublishedAmenity ? 'amenities' : null;
}

export const isTemporaryPropertyVisualSection = (
  section: EternaPropertyVisualSection,
) => section === 'summary';
