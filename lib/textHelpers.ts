/**
 * Text helpers for natural Spanish language formatting.
 */

/**
 * Formats a count with a singular or plural noun in Spanish, ensuring correct gender agreement.
 * For example:
 * - formatCount(1, 'baño', 'baños', 'masculine') => 'un baño'
 * - formatCount(1, 'recámara', 'recámaras', 'feminine') => 'una recámara'
 * - formatCount(2, 'baño', 'baños', 'masculine') => '2 baños' (or 'dos baños' if spelledOut is true)
 */
export function formatCount(
  count: number,
  singular: string,
  plural: string,
  gender: 'masculine' | 'feminine',
  spelledOut: boolean = false
): string {
  const cleanCount = Math.floor(count);

  if (cleanCount === 1) {
    const prefix = gender === 'masculine' ? 'un' : 'una';
    return `${prefix} ${singular}`;
  }

  if (spelledOut) {
    const numberWords: Record<number, string> = {
      0: 'cero',
      2: 'dos',
      3: 'tres',
      4: 'cuatro',
      5: 'cinco',
      6: 'seis',
      7: 'siete',
      8: 'ocho',
      9: 'nueve',
      10: 'diez'
    };
    if (cleanCount in numberWords) {
      return `${numberWords[cleanCount]} ${plural}`;
    }
  }

  return `${cleanCount} ${plural}`;
}

/**
 * Utility to convert an arbitrary list of number-noun pairs to a natural Spanish phrase.
 * Example:
 * formatSentencePart([
 *   { count: 2, singular: 'habitación', plural: 'habitaciones', gender: 'feminine' },
 *   { count: 1, singular: 'baño', plural: 'baños', gender: 'masculine' },
 *   { count: 1, singular: 'estacionamiento', plural: 'estacionamientos', gender: 'masculine' }
 * ])
 * => 'dos habitaciones, un baño y un estacionamiento'
 */
export interface CountItem {
  count: number;
  singular: string;
  plural: string;
  gender: 'masculine' | 'feminine';
}

export function formatSentencePart(items: CountItem[], spelledOut: boolean = true): string {
  const activeItems = items.filter(item => item.count !== undefined && item.count !== null);
  if (activeItems.length === 0) return '';

  const formatted = activeItems.map(item => formatCount(item.count, item.singular, item.plural, item.gender, spelledOut));
  
  if (formatted.length === 1) return formatted[0];
  if (formatted.length === 2) return `${formatted[0]} y ${formatted[1]}`;
  
  return `${formatted.slice(0, -1).join(', ')} y ${formatted[formatted.length - 1]}`;
}

/**
 * Formats full and half bathrooms into a natural language string.
 * Example:
 * - formatBathrooms(2, 1, 'es') => '2 baños y 1 medio baño'
 * - formatBathrooms(1, 0, 'es') => 'un baño'
 * - formatBathrooms(2, 0, 'en') => '2 bathrooms'
 */
export function formatBathrooms(bathrooms: number, halfBathrooms: number = 0, lang: 'es' | 'en' = 'es'): string {
  const cleanFull = Math.floor(bathrooms);
  const cleanHalf = Math.floor(halfBathrooms);

  const fullText = lang === 'es'
    ? formatCount(cleanFull, 'baño', 'baños', 'masculine')
    : `${cleanFull} bathroom${cleanFull !== 1 ? 's' : ''}`;
  
  if (cleanHalf > 0) {
    const halfText = lang === 'es'
      ? formatCount(cleanHalf, 'medio baño', 'medios baños', 'masculine')
      : `${cleanHalf} half bathroom${cleanHalf !== 1 ? 's' : ''}`;
    return lang === 'es' ? `${fullText} y ${halfText}` : `${fullText} and ${halfText}`;
  }
  
  return fullText;
}
