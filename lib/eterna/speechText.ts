const SPOKEN_AMOUNT = String.raw`\d(?:[\d.,\s]*\d)?`;

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
  if (language !== 'es' || !text.trim()) return text;

  let normalized = replaceCurrencyAmount(text, String.raw`MXN|M\.?\s*N\.?`, 'pesos');
  normalized = replaceCurrencyAmount(normalized, 'USD', 'dólares estadounidenses');

  return normalized
    .replace(/\bpesos(?:\s+mexicanos)?\s+(?:MXN|M\.?\s*N\.?)\b/gi, 'pesos')
    .replace(/\bdólares(?:\s+estadounidenses)?\s+USD\b/gi, 'dólares estadounidenses')
    .replace(/\b(?:MXN|M\.?\s*N\.?)\b/gi, 'pesos mexicanos')
    .replace(/\bUSD\b/gi, 'dólares estadounidenses')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}
