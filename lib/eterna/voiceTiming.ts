// A short visual pre-roll lets the cached talking video enter on the same
// perceived beat as Fish Audio without delaying text generation or streaming.
export const ETERNA_AVATAR_AUDIO_LEAD_IN_MS = 160;

// Mobile WebViews need a little more time to switch the hardware audio route
// from SpeechRecognition input back to speaker output. Without this handoff,
// the operating system can swallow the beginning of the next response.
export const ETERNA_MOBILE_MIC_TO_SPEAKER_HANDOFF_MS = 650;
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
