import { stripEternaMarkup } from './textSanitization';

const SPOKEN_AMOUNT = String.raw`\d(?:[\d.,\s]*\d)?(?:\s+(?:mil|mill[oó]n(?:es)?))?`;

function replaceCurrencyAmount(
  text: string,
  currencyPattern: string,
  spokenCurrency: string,
): string {
  const beforeAmount = new RegExp(
    String.raw`\b(?:${currencyPattern})\s*\$?\s*(${SPOKEN_AMOUNT})\b`,
    'gi',
  );
  const afterDollarAmount = new RegExp(
    String.raw`\$\s*(${SPOKEN_AMOUNT})\s*(?:${currencyPattern})\b`,
    'gi',
  );
  const afterAmount = new RegExp(
    String.raw`\b(${SPOKEN_AMOUNT})\s*(?:${currencyPattern})\b`,
    'gi',
  );

  return text
    .replace(beforeAmount, `$1 ${spokenCurrency}`)
    .replace(afterDollarAmount, `$1 ${spokenCurrency}`)
    .replace(afterAmount, `$1 ${spokenCurrency}`);
}

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
    String.raw`USD|US\$|d[oó]lares?(?:\s+estadounidenses)?`,
    'dólares estadounidenses',
  );
  normalized = replaceCurrencyAmount(normalized, String.raw`MXN|M\.?\s*N\.?`, 'pesos');

  return normalized
    .replace(new RegExp(String.raw`\$\s*(${SPOKEN_AMOUNT})\s+pesos\b`, 'gi'), '$1 pesos')
    .replace(new RegExp(String.raw`\$\s*(${SPOKEN_AMOUNT})\s+dólares estadounidenses\b`, 'gi'), '$1 dólares estadounidenses')
    // AuraSwap opera por defecto en México. A falta de un código de moneda
    // explícito, el signo "$" representa pesos y nunca dólares para Eterna.
    .replace(new RegExp(String.raw`\$\s*(${SPOKEN_AMOUNT})\b`, 'gi'), '$1 pesos')
    .replace(/\b(mil|mill[oó]n(?:es)?)\s+pesos\b/gi, '$1 de pesos')
    .replace(/\b(mil|mill[oó]n(?:es)?)\s+dólares estadounidenses\b/gi, '$1 de dólares estadounidenses')
    .replace(/\bpesos(?:\s+mexicanos)?\s+(?:MXN|M\.?\s*N\.?)\b/gi, 'pesos')
    .replace(/\bdólares(?:\s+estadounidenses)?\s+USD\b/gi, 'dólares estadounidenses')
    .replace(/\b(?:MXN|M\.?\s*N\.?)\b/gi, 'pesos mexicanos')
    .replace(/\bUSD\b/gi, 'dólares estadounidenses')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
