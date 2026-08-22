import type { TerritorialDomain } from './types';

export interface TerritorialSourceDefinition {
  id: string;
  organization: string;
  title: string;
  officialUrl: string;
  sourceRole: 'primary' | 'official_aggregator';
  cadence: string;
  geographicCoverage: string;
  domains: TerritorialDomain[];
  attribution: string;
  limitations: string[];
}

export const TERRITORIAL_SOURCE_REGISTRY: readonly TerritorialSourceDefinition[] = [
  {
    id: 'inegi-enoe',
    organization: 'INEGI',
    title: 'Encuesta Nacional de Ocupación y Empleo (ENOE)',
    officialUrl: 'https://www.inegi.org.mx/programas/enoe/15ymas/',
    sourceRole: 'primary',
    cadence: 'Mensual y trimestral',
    geographicCoverage: 'Nacional y estatal; algunas ciudades autorrepresentadas',
    domains: ['employment', 'income', 'informality', 'economic_sectors', 'purchasing_power'],
    attribution: 'Instituto Nacional de Estadística y Geografía (INEGI), ENOE.',
    limitations: [
      'La ENOE no produce estimaciones representativas para todos los municipios.',
      'El salario observado no equivale a ingreso disponible ni a capacidad crediticia individual.',
    ],
  },
  {
    id: 'data-mexico-enoe',
    organization: 'Secretaría de Economía / INEGI',
    title: 'Data México — cubo ENOE',
    officialUrl: 'https://www.economia.gob.mx/datamexico/es/about/infoapi',
    sourceRole: 'official_aggregator',
    cadence: 'Trimestral',
    geographicCoverage: 'Nacional y estatal',
    domains: ['employment', 'income', 'informality', 'economic_sectors', 'purchasing_power'],
    attribution: 'Data México, Secretaría de Economía; fuente primaria subyacente: INEGI, ENOE.',
    limitations: [
      'Se conserva la consulta exacta del cubo y se identifica a INEGI como fuente primaria.',
      'No se usa para inferir atributos de una persona concreta.',
    ],
  },
  {
    id: 'inegi-denue',
    organization: 'INEGI',
    title: 'Directorio Estadístico Nacional de Unidades Económicas (DENUE)',
    officialUrl: 'https://www.inegi.org.mx/servicios/api_denue.html',
    sourceRole: 'primary',
    cadence: 'Actualizaciones periódicas por edición',
    geographicCoverage: 'Nacional, estatal, municipal, localidad y entorno geográfico',
    domains: ['business_activity', 'economic_sectors'],
    attribution: 'Instituto Nacional de Estadística y Geografía (INEGI), DENUE.',
    limitations: [
      'Cuenta establecimientos registrados; no mide ventas, ingresos ni todo el comercio informal.',
      'Las consultas en vivo requieren un token oficial de INEGI.',
    ],
  },
  {
    id: 'inegi-economic-census',
    organization: 'INEGI',
    title: 'Censos Económicos',
    officialUrl: 'https://www.inegi.org.mx/programas/ce/2024/',
    sourceRole: 'primary',
    cadence: 'Quinquenal',
    geographicCoverage: 'Nacional, estatal y municipal según tabulado',
    domains: ['business_activity', 'economic_sectors', 'employment'],
    attribution: 'Instituto Nacional de Estadística y Geografía (INEGI), Censos Económicos.',
    limitations: [
      'Es una línea base estructural, no una lectura mensual de actividad.',
      'Los agregados pueden incluir supresión estadística en geografías pequeñas.',
    ],
  },
  {
    id: 'inegi-enigh',
    organization: 'INEGI',
    title: 'Encuesta Nacional de Ingresos y Gastos de los Hogares 2024',
    officialUrl: 'https://www.inegi.org.mx/programas/enigh/nc/2024/',
    sourceRole: 'primary',
    cadence: 'Bienal',
    geographicCoverage: 'Nacional, estatal y urbano/rural',
    domains: ['income', 'purchasing_power', 'housing_need'],
    attribution: 'Instituto Nacional de Estadística y Geografía (INEGI), ENIGH.',
    limitations: [
      'No es representativa para estimaciones municipales directas.',
      'Poder adquisitivo es una inferencia que debe conservar composición del hogar e inflación.',
    ],
  },
  {
    id: 'conapo-population-projections',
    organization: 'CONAPO',
    title: 'Reconstrucción y proyecciones de población municipal 1990–2040',
    officialUrl: 'https://www.datos.gob.mx/es/dataset/proyecciones-de-poblacion',
    sourceRole: 'primary',
    cadence: 'Por nueva corrida de proyección',
    geographicCoverage: 'Nacional, estatal y municipal',
    domains: ['demographics', 'housing_need'],
    attribution: 'Consejo Nacional de Población (CONAPO).',
    limitations: [
      'Los años futuros son escenarios demográficos, no población observada.',
      'Crecimiento poblacional no equivale por sí solo a plusvalía o demanda solvente.',
    ],
  },
  {
    id: 'sniiv-housing-backlog',
    organization: 'SEDATU / CONAVI',
    title: 'SNIIV — Rezago habitacional',
    officialUrl: 'https://sniiv.sedatu.gob.mx/Reporte/Datos_abiertos',
    sourceRole: 'primary',
    cadence: 'Bienal estatal y censal municipal',
    geographicCoverage: 'Estatal 2024 y municipal 2020',
    domains: ['housing_need'],
    attribution: 'Sistema Nacional de Información e Indicadores de Vivienda, SEDATU / CONAVI.',
    limitations: [
      'Rezago habitacional mide precariedad, falta de excusado o hacinamiento; no es demanda comercial observada.',
      'El corte municipal vigente proviene del Censo de Población y Vivienda 2020.',
    ],
  },
  {
    id: 'sniiv-housing-financing',
    organization: 'SEDATU / CONAVI',
    title: 'SNIIV — Financiamientos y registro de vivienda',
    officialUrl: 'https://sniiv.sedatu.gob.mx/Reporte/Datos_abiertos',
    sourceRole: 'primary',
    cadence: 'Mensual',
    geographicCoverage: 'Nacional, estatal y municipal',
    domains: ['housing_market', 'housing_need', 'purchasing_power'],
    attribution: 'Sistema Nacional de Información e Indicadores de Vivienda, SEDATU.',
    limitations: [
      'Las acciones de financiamiento registradas no equivalen a toda la demanda de vivienda.',
      'Los rangos salariales se publican en UMA y no representan ingreso neto.',
    ],
  },
  {
    id: 'imss-insured-employment',
    organization: 'IMSS',
    title: 'Datos abiertos de puestos de trabajo afiliados al IMSS',
    officialUrl: 'https://datos.imss.gob.mx/group/asegurados',
    sourceRole: 'primary',
    cadence: 'Mensual',
    geographicCoverage: 'Nacional, estatal y municipal',
    domains: ['employment', 'income', 'economic_sectors'],
    attribution: 'Instituto Mexicano del Seguro Social (IMSS).',
    limitations: [
      'Mide empleo formal registrado; no representa el empleo total.',
      'El salario base de cotización no es salario neto.',
    ],
  },
  {
    id: 'coneval-poverty-social-lag',
    organization: 'CONEVAL',
    title: 'Pobreza municipal e Índice de Rezago Social',
    officialUrl: 'https://www.coneval.org.mx/Medicion/Paginas/Programas_BD_municipal_2010_2020.aspx',
    sourceRole: 'primary',
    cadence: 'Según publicación oficial',
    geographicCoverage: 'Nacional, estatal, municipal y localidad según producto',
    domains: ['housing_need', 'purchasing_power', 'demographics'],
    attribution: 'Consejo Nacional de Evaluación de la Política de Desarrollo Social (CONEVAL).',
    limitations: [
      'Rezago social no equivale a pobreza multidimensional ni a capacidad individual de pago.',
      'No debe usarse para excluir zonas o personas de oportunidades de vivienda.',
    ],
  },
  {
    id: 'shf-house-price-index',
    organization: 'Sociedad Hipotecaria Federal',
    title: 'Índice SHF de precios de la vivienda',
    officialUrl: 'https://www.gob.mx/shf/documentos/datos-abiertos-indice-shf',
    sourceRole: 'primary',
    cadence: 'Trimestral',
    geographicCoverage: 'Nacional, estatal y municipios seleccionados',
    domains: ['housing_market', 'purchasing_power'],
    attribution: 'Sociedad Hipotecaria Federal (SHF).',
    limitations: [
      'Se basa en avalúos hipotecarios y no cubre por completo la renta ni transacciones informales.',
      'Una relación precio/ingreso es una inferencia, no una precalificación crediticia.',
    ],
  },
] as const;

export const getTerritorialSource = (sourceId: string): TerritorialSourceDefinition | undefined =>
  TERRITORIAL_SOURCE_REGISTRY.find((source) => source.id === sourceId);
