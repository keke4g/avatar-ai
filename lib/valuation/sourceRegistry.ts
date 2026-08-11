export type ValuationSourcePriority = 'P0' | 'P1' | 'P2';
export type ValuationSourceCadence = 'monthly' | 'quarterly' | 'annual' | 'manual';

export interface ValuationSourceDefinition {
  id: string;
  name: string;
  organization: string;
  priority: ValuationSourcePriority;
  cadence: ValuationSourceCadence;
  officialUrl: string;
  geographicScope: string;
  purpose: string;
  preferredFormats: string[];
  ingestionMode: 'api' | 'download-discovery' | 'manual-review';
  attribution: string;
  enabledForPilot: boolean;
}

/**
 * Registro auditable de fuentes oficiales para México.
 *
 * Las URLs apuntan siempre a la institucion que publica los datos. Los archivos
 * encontrados se conservan con hash y fecha de descarga; nunca se reemplazan
 * silenciosamente.
 */
export const VALUATION_SOURCE_REGISTRY: readonly ValuationSourceDefinition[] = [
  {
    id: 'sniiv-open-data',
    name: 'SNIIV - Datos abiertos de vivienda',
    organization: 'SEDATU / CONAVI',
    priority: 'P0',
    cadence: 'quarterly',
    officialUrl: 'https://sniiv.sedatu.gob.mx/Reporte/Datos_abiertos',
    geographicScope: 'Mexico, estado y municipio',
    purpose: 'Inventario, financiamiento, oferta y dias de inventario.',
    preferredFormats: ['csv', 'xlsx', 'json'],
    ingestionMode: 'download-discovery',
    attribution: 'Sistema Nacional de Informacion e Indicadores de Vivienda, SEDATU.',
    enabledForPilot: true,
  },
  {
    id: 'shf-home-price-index',
    name: 'Indice SHF de precios de la vivienda',
    organization: 'Sociedad Hipotecaria Federal',
    priority: 'P0',
    cadence: 'quarterly',
    officialUrl: 'https://www.gob.mx/shf/documentos/datos-abiertos-indice-shf',
    geographicScope: 'Mexico, estados y municipios seleccionados',
    purpose: 'Actualizacion temporal y calibracion de precios de vivienda.',
    preferredFormats: ['xlsx', 'xls', 'csv', 'pdf'],
    ingestionMode: 'download-discovery',
    attribution: 'Sociedad Hipotecaria Federal.',
    enabledForPilot: true,
  },
  {
    id: 'shf-quarterly-bulletin-2026-q1',
    name: 'Índice SHF de precios de la vivienda — 1T 2026',
    organization: 'Sociedad Hipotecaria Federal',
    priority: 'P0',
    cadence: 'quarterly',
    officialUrl: 'https://www.gob.mx/shf/articulos/indice-shf-de-precios-de-la-vivienda-en-mexico-primer-trimestre-de-2026',
    geographicScope: 'México, entidades federativas y municipios publicados',
    purpose: 'Corte trimestral vigente, distribución de avalúos y apreciación de precios.',
    preferredFormats: ['html', 'pdf'],
    ingestionMode: 'download-discovery',
    attribution: 'Sociedad Hipotecaria Federal, primer trimestre de 2026.',
    enabledForPilot: true,
  },
  {
    id: 'shf-appraisal-indicators',
    name: 'Indicadores de inmuebles valuados',
    organization: 'Sociedad Hipotecaria Federal',
    priority: 'P0',
    cadence: 'quarterly',
    officialUrl: 'https://www.gob.mx/shf/documentos/indicadores-sociedad-hipotecaria-federal',
    geographicScope: 'Mexico y entidades federativas',
    purpose: 'Medianas y promedios observados en inmuebles valuados.',
    preferredFormats: ['xlsx', 'xls', 'csv', 'pdf'],
    ingestionMode: 'download-discovery',
    attribution: 'Sociedad Hipotecaria Federal.',
    enabledForPilot: true,
  },
  {
    id: 'shf-valuation-methodology',
    name: 'Metodologia y reglas de valuacion SHF',
    organization: 'Sociedad Hipotecaria Federal',
    priority: 'P0',
    cadence: 'manual',
    officialUrl: 'https://www.gob.mx/shf/documentos/reglas-de-caracter-general',
    geographicScope: 'Mexico',
    purpose: 'Evidencia metodologica; no se usa como dato numerico.',
    preferredFormats: ['pdf'],
    ingestionMode: 'download-discovery',
    attribution: 'Sociedad Hipotecaria Federal.',
    enabledForPilot: true,
  },
  {
    id: 'inegi-mass-downloads',
    name: 'INEGI - Marco Geoestadistico, DENUE e INPC',
    organization: 'INEGI',
    priority: 'P0',
    cadence: 'annual',
    officialUrl: 'https://www.inegi.org.mx/app/descarga/default.html',
    geographicScope: 'México, entidad, municipio, AGEB y manzana según producto',
    purpose: 'Geografia, entorno urbano, actividad economica e inflacion.',
    preferredFormats: ['zip', 'csv', 'shp', 'xlsx'],
    ingestionMode: 'manual-review',
    attribution: 'Instituto Nacional de Estadistica y Geografia.',
    enabledForPilot: true,
  },
  {
    id: 'culiacan-cadastral-values',
    name: 'Valores unitarios de suelo y construccion de Culiacan',
    organization: 'Municipio de Culiacan / Congreso del Estado de Sinaloa',
    priority: 'P0',
    cadence: 'annual',
    officialUrl: 'https://catastro.culiacan.gob.mx/',
    geographicScope: 'Municipio de Culiacan',
    purpose: 'Referencia fiscal y apoyo al enfoque fisico de costo.',
    preferredFormats: ['pdf', 'xlsx'],
    ingestionMode: 'manual-review',
    attribution: 'Municipio de Culiacan y Congreso del Estado de Sinaloa.',
    enabledForPilot: true,
  },
  {
    id: 'cnbv-housing-portfolio',
    name: 'Portafolio de credito a la vivienda',
    organization: 'CNBV',
    priority: 'P1',
    cadence: 'monthly',
    officialUrl: 'https://portafolioinfo.cnbv.gob.mx/Paginas/Inicio.aspx?ID=13&Titulo=Casas+',
    geographicScope: 'Mexico, entidad y municipio segun reporte',
    purpose: 'Tasas, LTV, actividad y condiciones de credito hipotecario.',
    preferredFormats: ['xlsx', 'csv'],
    ingestionMode: 'manual-review',
    attribution: 'Comision Nacional Bancaria y de Valores.',
    enabledForPilot: false,
  },
  {
    id: 'data-mexico',
    name: 'Data Mexico',
    organization: 'Secretaria de Economia',
    priority: 'P1',
    cadence: 'quarterly',
    officialUrl: 'https://www.economia.gob.mx/datamexico/es/about/infoapi',
    geographicScope: 'Mexico, estados y municipios',
    purpose: 'Contexto demografico, laboral y economico complementario.',
    preferredFormats: ['json', 'csv'],
    ingestionMode: 'api',
    attribution: 'Data Mexico, Secretaria de Economia.',
    enabledForPilot: false,
  },
] as const;

export const getPilotValuationSources = (): ValuationSourceDefinition[] =>
  VALUATION_SOURCE_REGISTRY.filter((source) => source.enabledForPilot);
