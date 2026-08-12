// A short visual pre-roll lets the cached talking video enter on the same
// perceived beat as Fish Audio without delaying text generation or streaming.
export const ETERNA_AVATAR_AUDIO_LEAD_IN_MS = 160;

// The PCM startup buffer already gives mobile devices time to leave the input
// route. Adding another fixed delay made every voice turn slower and could
// activate the phone speaker before Bluetooth became the selected media route.
export const ETERNA_MOBILE_MIC_TO_SPEAKER_HANDOFF_MS = 0;
export const ETERNA_PCM_START_BUFFER_MS = 500;

interface EternaPlaybackLeadInOptions {
  afterRecognition: boolean;
  isMobile: boolean;
}

export function getEternaPlaybackLeadInMs({
  afterRecognition,
  isMobile,
}: EternaPlaybackLeadInOptions): number {
  return ETERNA_AVATAR_AUDIO_LEAD_IN_MS
    + (afterRecognition && isMobile ? ETERNA_MOBILE_MIC_TO_SPEAKER_HANDOFF_MS : 0);
}

export function hasEnoughEternaPcmStartupAudio(bufferedDurationSeconds: number): boolean {
  return bufferedDurationSeconds * 1_000 >= ETERNA_PCM_START_BUFFER_MS;
}

export function shouldUseAutomaticBargeIn(isMobile: boolean): boolean {
  return !isMobile;
}
