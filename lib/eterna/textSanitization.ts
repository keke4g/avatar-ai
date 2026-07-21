/**
 * Gemini occasionally returns lightweight Markdown even when the prompt asks
 * for plain text. Eterna renders and speaks plain prose, so remove presentation
 * syntax while preserving the actual wording and line breaks.
 */
export function stripEternaMarkup(value: string): string {
  if (!value) return value;

  return value
    .replace(/\[([^\]]+)]\((?:[^)]+)\)/g, '$1')
    .replace(/```(?:[a-z0-9_-]+)?\s*/gi, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-*•]\s+)+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/_([^_\n]+)_/g, '$1')
    .replace(/[＊*]/g, ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
