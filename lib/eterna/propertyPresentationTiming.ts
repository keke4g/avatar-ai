export const ETERNA_PROPERTY_PRESENTATION_MIN_AUDIBLE_MS = 4_500;
export const ETERNA_PROPERTY_PRESENTATION_SILENT_HOLD_MS = 12_000;

interface PropertyPresentationCloseDelayOptions {
  audibleSpeechStartedAt: number | null;
  endedAt: number;
}

export function getPropertyPresentationCloseDelay({
  audibleSpeechStartedAt,
  endedAt,
}: PropertyPresentationCloseDelayOptions): number {
  if (audibleSpeechStartedAt === null) {
    return ETERNA_PROPERTY_PRESENTATION_SILENT_HOLD_MS;
  }

  return Math.max(
    0,
    ETERNA_PROPERTY_PRESENTATION_MIN_AUDIBLE_MS - Math.max(0, endedAt - audibleSpeechStartedAt),
  );
}
