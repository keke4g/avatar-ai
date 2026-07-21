const COMPACT_WORDS = [
  'SUPERMERCADOS', 'UNIVERSIDAD', 'GUADALAJARA', 'HOSPITALES', 'HOSPITAL',
  'SUPERMERCADO', 'CLINICAS', 'CLINICA', 'FARMACIAS', 'FARMACIA', 'ESCUELAS',
  'ESCUELA', 'COLEGIOS', 'COLEGIO', 'INSTITUTO', 'ABARROTES', 'MAZATLAN',
  'MONTERREY', 'CULIACAN', 'JALISCO', 'SINALOA', 'MEXICO', 'MEDICOS', 'MEDICO',
  'JARDINES', 'JARDIN', 'PARQUES', 'PARQUE', 'MERCADO', 'CENTRO', 'CIVIL',
  'NUEVO', 'LEON', 'SALUD', 'PLAZA', 'SAN', 'SANTA', 'JOSE', 'MARIA', 'DEL',
  'LAS', 'LOS', 'DE', 'LA',
].sort((a, b) => b.length - a.length);

const ACCENTS: Record<string, string> = {
  clinica: 'clínica',
  clinicas: 'clínicas',
  jardin: 'jardín',
  jardines: 'jardines',
  mazatlan: 'Mazatlán',
  mexico: 'México',
  medica: 'médica',
  medicas: 'médicas',
  medico: 'médico',
  medicos: 'médicos',
  leon: 'León',
};

const ACRONYMS = new Set(['DIF', 'IMSS', 'ISSSTE', 'ITESO', 'UAG', 'UANL', 'UNAM', 'UP', 'UVM']);
const LOWERCASE_WORDS = new Set(['a', 'al', 'de', 'del', 'el', 'en', 'la', 'las', 'los', 'y']);

function splitCompactToken(token: string): string[] | null {
  const upper = token.toLocaleUpperCase('es-MX');
  const memo = new Map<number, string[] | null>();

  const visit = (index: number): string[] | null => {
    if (index === upper.length) return [];
    if (memo.has(index)) return memo.get(index) || null;
    for (const word of COMPACT_WORDS) {
      if (!upper.startsWith(word, index)) continue;
      const rest = visit(index + word.length);
      if (rest) {
        const result = [word, ...rest];
        memo.set(index, result);
        return result;
      }
    }
    memo.set(index, null);
    return null;
  };

  const parts = visit(0);
  return parts && parts.length > 1 ? parts : null;
}

function titleCaseUppercaseName(value: string): string {
  return value.split(/(\s+|[-/])/).map((part, index) => {
    if (!part || /^\s+$|^[-/]$/.test(part)) return part;
    const upper = part.toLocaleUpperCase('es-MX');
    if (ACRONYMS.has(upper)) return upper;

    const lower = part.toLocaleLowerCase('es-MX');
    if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower;
    const accented = ACCENTS[lower] || lower;
    if (/^[A-ZÁÉÍÓÚÑ]/.test(accented)) return accented;
    return accented.charAt(0).toLocaleUpperCase('es-MX') + accented.slice(1);
  }).join('');
}

/** Normalizes common compact/all-caps names returned by Google Places. */
export function formatGooglePlaceName(value: string): string {
  const compact = value
    .normalize('NFKC')
    .replace(/[_|]+/g, ' ')
    .replace(/(?<=[a-záéíóúñ])(?=[A-ZÁÉÍÓÚÑ])/g, ' ')
    .replace(/(?<=[A-Za-zÁÉÍÓÚÑáéíóúñ])(?=\d)|(?<=\d)(?=[A-Za-zÁÉÍÓÚÑáéíóúñ])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!compact) return compact;

  const separated = compact.split(' ').flatMap((token) => {
    if (!/^[A-ZÁÉÍÓÚÑ]+$/.test(token) || token.length < 7) return [token];
    return splitCompactToken(token) || [token];
  }).join(' ');

  const letters = separated.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '');
  return letters && letters === letters.toLocaleUpperCase('es-MX')
    ? titleCaseUppercaseName(separated)
    : separated;
}
