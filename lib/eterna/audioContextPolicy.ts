export function isReusablePcmAudioContextState(state: string | null | undefined): boolean {
  return Boolean(state && state !== 'closed');
}
