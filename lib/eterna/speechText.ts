import { stripEternaMarkup } from './textSanitization';

const SPOKEN_AMOUNT = String.raw`\d(?:[\d.,\s]*\d)?(?:\s+(?:mil|mill[oó]n(?:es)?))?`;
const CONTEXT_NUMBER = String.raw`\d+(?:[.,]\d+)?`;

interface CurrencyForms {
  singular: string;
  plural: string;
}

const PESO_FORMS: CurrencyForms = { singular: 'peso', plural: 'pesos' };
const USD_FORMS: CurrencyForms = {
  singular: 'dólar estadounidense',
  plural: 'dólares estadounidenses',
};

const UNITS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
];
const TENS = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function apocopateMasculine(value: string): string {
  return value
    .replace(/veintiuno$/u, 'veintiún')
    .replace(/ y uno$/u, ' y un')
    .replace(/uno$/u, 'un');
}

function numberBelowOneThousand(value: number, beforeNoun = false): string {
  if (value === 100) return 'cien';
  if (value < 16) return beforeNoun ? apocopateMasculine(UNITS[value]) : UNITS[value];
  if (value === 16) return 'dieciséis';
  if (value < 20) return `dieci${UNITS[value - 10]}`;
  if (value < 30) {
    const accentedTwenties: Record<number, string> = {
      22: 'veintidós',
      23: 'veintitrés',
      26: 'veintiséis',
    };
    const word = value === 20 ? 'veinte' : accentedTwenties[value] || `veinti${UNITS[value - 20]}`;
    return beforeNoun ? apocopateMasculine(word) : word;
  }
  if (value < 100) {
    const units = value % 10;
    const word = units ? `${TENS[Math.floor(value / 10)]} y ${UNITS[units]}` : TENS[Math.floor(value / 10)];
    return beforeNoun ? apocopateMasculine(word) : word;
  }

  const remainder = value % 100;
  const word = remainder
    ? `${HUNDREDS[Math.floor(value / 100)]} ${numberBelowOneThousand(remainder, beforeNoun)}`
    : HUNDREDS[Math.floor(value / 100)];
  return beforeNoun ? apocopateMasculine(word) : word;
}

function integerToSpanish(value: number, beforeNoun = false): string {
  const integer = Math.max(0, Math.trunc(value));
  if (integer < 1_000) return numberBelowOneThousand(integer, beforeNoun);

  const groups: string[] = [];
  const thousandMillions = Math.floor(integer / 1_000_000_000);
  const millions = Math.floor((integer % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((integer % 1_000_000) / 1_000);
  const remainder = integer % 1_000;

  if (thousandMillions) {
    groups.push(thousandMillions === 1
      ? 'mil millones'
      : `${integerToSpanish(thousandMillions, true)} mil millones`);
  }
  if (millions) {
    groups.push(millions === 1
      ? 'un millón'
      : `${integerToSpanish(millions, true)} millones`);
  }
  if (thousands) {
    groups.push(thousands === 1 ? 'mil' : `${integerToSpanish(thousands, true)} mil`);
  }
  if (remainder) groups.push(numberBelowOneThousand(remainder, beforeNoun));

  const words = groups.join(' ');
  return beforeNoun ? apocopateMasculine(words) : words;
}

function parseSpokenAmount(rawAmount: string): number | null {
  const compact = rawAmount.trim().toLocaleLowerCase('es-MX');
  const scaleMatch = compact.match(/\s+(mil|mill[oó]n(?:es)?)$/u);
  const scale = scaleMatch?.[1] === 'mil'
    ? 1_000
    : scaleMatch
      ? 1_000_000
      : 1;
  let numeric = scaleMatch ? compact.slice(0, scaleMatch.index).trim() : compact;
  numeric = numeric.replace(/\s+/g, '');

  if (scale > 1) {
    if (numeric.includes(',') && numeric.includes('.')) numeric = numeric.replace(/,/g, '');
    else numeric = numeric.replace(',', '.');
  } else if (/^\d{1,3}(?:[.,]\d{3})+$/u.test(numeric)) {
    numeric = numeric.replace(/[.,]/g, '');
  } else if (numeric.includes(',') && numeric.includes('.')) {
    const decimalSeparator = numeric.lastIndexOf(',') > numeric.lastIndexOf('.') ? ',' : '.';
    numeric = numeric
      .replace(decimalSeparator === ',' ? /\./g : /,/g, '')
      .replace(decimalSeparator, '.');
  } else {
    numeric = numeric.replace(',', '.');
  }

  const parsed = Number(numeric) * scale;
  return Number.isFinite(parsed) && parsed >= 0 && parsed < 1_000_000_000_000
    ? parsed
    : null;
}

function speakCurrencyAmount(rawAmount: string, currency: CurrencyForms): string {
  const amount = parseSpokenAmount(rawAmount);
  if (amount === null) return `${rawAmount} ${currency.plural}`;

  const totalCents = Math.round(amount * 100);
  const whole = Math.floor(totalCents / 100);
  const cents = totalCents % 100;
  const amountWords = integerToSpanish(whole, true);
  const needsDe = whole >= 1_000_000 && whole % 1_000_000 === 0;
  const currencyWord = whole === 1 ? currency.singular : currency.plural;
  const currencyWords = `${amountWords}${needsDe ? ' de' : ''} ${currencyWord}`;
  if (!cents) return currencyWords;
  return `${currencyWords} con ${integerToSpanish(cents, true)} ${cents === 1 ? 'centavo' : 'centavos'}`;
}

function replaceCurrencyAmount(
  text: string,
  currencyPattern: string,
  currency: CurrencyForms,
): string {
  const amountRange = new RegExp(
    String.raw`\b(${SPOKEN_AMOUNT})\s+(a|y)\s+(${SPOKEN_AMOUNT})(?:\s+de)?\s+(?:${currencyPattern})\b`,
    'gi',
  );
  const beforeAmount = new RegExp(
    String.raw`\b(?:${currencyPattern})\s*\$?\s*(${SPOKEN_AMOUNT})\b`,
    'gi',
  );
  const afterDollarAmount = new RegExp(
    String.raw`\$\s*(${SPOKEN_AMOUNT})(?:\s+de)?\s*(?:${currencyPattern})\b`,
    'gi',
  );
  const afterAmount = new RegExp(
    String.raw`\b(${SPOKEN_AMOUNT})(?:\s+de)?\s+(?:${currencyPattern})\b`,
    'gi',
  );

  return text
    .replace(
      amountRange,
      (_match, first: string, connector: string, second: string) => (
        `${speakCurrencyAmount(first, currency)} ${connector.toLocaleLowerCase('es-MX')} ${speakCurrencyAmount(second, currency)}`
      ),
    )
    .replace(beforeAmount, (_match, amount: string) => speakCurrencyAmount(amount, currency))
    .replace(afterDollarAmount, (_match, amount: string) => speakCurrencyAmount(amount, currency))
    .replace(afterAmount, (_match, amount: string) => speakCurrencyAmount(amount, currency));
}

function speakContextNumber(rawNumber: string, beforeNoun = false): string {
  const parsed = parseSpokenAmount(rawNumber);
  if (parsed === null) return rawNumber;
  if (Number.isInteger(parsed)) return integerToSpanish(parsed, beforeNoun);

  const compact = rawNumber.replace(/\s+/g, '');
  const decimalMatch = compact.match(/[.,](\d+)$/u);
  const decimalDigits = decimalMatch?.[1] || String(parsed).split('.')[1] || '';
  const decimalWords = decimalDigits
    .split('')
    .map(digit => UNITS[Number(digit)])
    .join(' ');
  return `${integerToSpanish(Math.floor(parsed))} punto ${decimalWords}`;
}

const MONTH_NAMES: Record<string, string> = {
  ene: 'enero',
  enero: 'enero',
  feb: 'febrero',
  febrero: 'febrero',
  mar: 'marzo',
  marzo: 'marzo',
  abr: 'abril',
  abril: 'abril',
  may: 'mayo',
  mayo: 'mayo',
  jun: 'junio',
  junio: 'junio',
  jul: 'julio',
  julio: 'julio',
  ago: 'agosto',
  agosto: 'agosto',
  sep: 'septiembre',
  sept: 'septiembre',
  septiembre: 'septiembre',
  oct: 'octubre',
  octubre: 'octubre',
  nov: 'noviembre',
  noviembre: 'noviembre',
  dic: 'diciembre',
  diciembre: 'diciembre',
};

/**
 * Converts visual real-estate notation into wording that Spanish TTS engines
 * pronounce unambiguously. In particular, the dollar sign must disappear
 * before an MXN amount or several engines announce it as US dollars.
 */
export function normalizeEternaSpeechText(text: string, language: 'es' | 'en' = 'es'): string {
  const plainText = stripEternaMarkup(text);
  if (language !== 'es' || !plainText.trim()) return plainText;

  let normalized = replaceCurrencyAmount(
    plainText,
    String.raw`USD|US\$|d[oó]lar(?:es)?(?:\s+estadounidenses)?`,
    USD_FORMS,
  );
  normalized = replaceCurrencyAmount(
    normalized,
    String.raw`MXN|M\.?\s*N\.?|pesos?(?:\s+mexicanos)?`,
    PESO_FORMS,
  );

  return normalized
    // Towers México opera por defecto en México. A falta de un código de moneda
    // explícito, el signo "$" representa pesos y nunca dólares para Eterna.
    .replace(
      new RegExp(String.raw`\$\s*(${SPOKEN_AMOUNT})\b`, 'gi'),
      (_match, amount: string) => speakCurrencyAmount(amount, PESO_FORMS),
    )
    .replace(
      new RegExp(String.raw`\b(${CONTEXT_NUMBER})\s*%`, 'gi'),
      (_match, amount: string) => `${speakContextNumber(amount)} por ciento`,
    )
    .replace(
      new RegExp(String.raw`\b(${CONTEXT_NUMBER})\s+por\s+ciento\b`, 'gi'),
      (_match, amount: string) => `${speakContextNumber(amount)} por ciento`,
    )
    .replace(
      new RegExp(String.raw`\b(${CONTEXT_NUMBER})\s*m(?:²|2)(?=\s|[.,;:!?)]|$)`, 'gi'),
      (_match, amount: string) => {
        const parsed = parseSpokenAmount(amount);
        return parsed === 1
          ? `${speakContextNumber(amount, true)} metro cuadrado`
          : `${speakContextNumber(amount, true)} metros cuadrados`;
      },
    )
    .replace(
      /\bm(?:²|2)(?=\s|[.,;:!?)]|$)/gi,
      'metro cuadrado',
    )
    .replace(
      /\b(\d+)\s+(años?|meses?|días?|habitaciones?|recámaras?|baños?|cajones?|estacionamientos?|pisos?|niveles?|comparables?|propiedades?)\b/gi,
      (_match, amount: string, unit: string) => `${integerToSpanish(Number(amount), true)} ${unit}`,
    )
    .replace(
      /\b([0-3]?\d)\s+(?:de\s+)?(ene(?:ro)?|feb(?:rero)?|mar(?:zo)?|abr(?:il)?|may(?:o)?|jun(?:io)?|jul(?:io)?|ago(?:sto)?|sep(?:t|tiembre)?|oct(?:ubre)?|nov(?:iembre)?|dic(?:iembre)?)\s+(?:de\s+)?(\d{4})\b/gi,
      (_match, day: string, month: string, year: string) => (
        `${integerToSpanish(Number(day))} de ${MONTH_NAMES[month.toLocaleLowerCase('es-MX')]} de ${integerToSpanish(Number(year))}`
      ),
    )
    .replace(/\bpesos(?:\s+mexicanos)?\s+(?:MXN|M\.?\s*N\.?)\b/gi, 'pesos')
    .replace(/\bdólares(?:\s+estadounidenses)?\s+USD\b/gi, 'dólares estadounidenses')
    .replace(/\b(?:MXN|M\.?\s*N\.?)\b/gi, 'pesos mexicanos')
    .replace(/\bUSD\b/gi, 'dólares estadounidenses')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
