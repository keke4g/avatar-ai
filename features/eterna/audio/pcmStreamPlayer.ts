import 'client-only';

import { decodePcm16Le, parsePcm16LeSampleRate } from '@/lib/shared/pcm16';
import {
  ETERNA_AVATAR_AUDIO_LEAD_IN_MS,
  hasEnoughEternaPcmStartupAudio,
} from '@/lib/eterna/voiceTiming';

export const ETERNA_FIRST_AUDIO_TIMEOUT_MS = 5_500;

type WebkitWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

export interface PcmStreamPlaybackOptions {
  response: Response;
  context: AudioContext;
  signal: AbortSignal;
  sources: Set<AudioBufferSourceNode>;
  leadInMs?: number;
  onFirstAudioScheduled: (context: AudioContext, startAt: number) => void;
  onPlaybackEnded: () => void;
}

export function getPcmSampleRate(response: Pick<Response, 'headers' | 'body'>): number | null {
  if (!response.body) return null;

  return parsePcm16LeSampleRate(response.headers.get('X-Voice-Format'));
}

export function createBrowserAudioContext(): AudioContext {
  const AudioContextClass = window.AudioContext || (window as WebkitWindow).webkitAudioContext;
  if (!AudioContextClass) throw new Error('Web Audio no está disponible');
  return new AudioContextClass();
}

export function stopPcmSources(sources: Set<AudioBufferSourceNode>): void {
  sources.forEach((source) => {
    source.onended = null;
    try {
      source.stop();
    } catch {
      // A source that already ended cannot be stopped again.
    }
  });
  sources.clear();
}

export async function playPcmStream({
  response,
  context,
  signal,
  sources,
  leadInMs = ETERNA_AVATAR_AUDIO_LEAD_IN_MS,
  onFirstAudioScheduled,
  onPlaybackEnded,
}: PcmStreamPlaybackOptions): Promise<void> {
  const sampleRate = getPcmSampleRate(response);
  if (!sampleRate || !response.body) {
    throw new Error('La respuesta no contiene un stream PCM compatible');
  }

  const reader = response.body.getReader();
  let pendingByte: number | null = null;
  let nextStartTime: number | null = null;
  let scheduledSources = 0;
  let streamEnded = false;
  let firstAudioScheduled = false;
  let playbackEnded = false;
  let bufferedDuration = 0;
  let startupBuffered = false;
  const startupBuffers: AudioBuffer[] = [];

  const finishIfReady = () => {
    if (playbackEnded || signal.aborted || !streamEnded || scheduledSources > 0) return;
    playbackEnded = true;
    onPlaybackEnded();
  };

  const scheduleBuffer = (audioBuffer: AudioBuffer) => {
    const source = context.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(context.destination);
    scheduledSources += 1;
    sources.add(source);
    source.onended = () => {
      scheduledSources = Math.max(0, scheduledSources - 1);
      sources.delete(source);
      finishIfReady();
    };

    const earliestStartTime = nextStartTime ?? (context.currentTime + (leadInMs / 1_000));
    const startAt = Math.max(earliestStartTime, context.currentTime + 0.02);
    source.start(startAt);
    nextStartTime = startAt + audioBuffer.duration;

    if (!firstAudioScheduled) {
      firstAudioScheduled = true;
      onFirstAudioScheduled(context, startAt);
    }
  };

  const flushStartupBuffers = () => {
    if (startupBuffered || startupBuffers.length === 0) return;
    startupBuffered = true;
    startupBuffers.splice(0).forEach(scheduleBuffer);
  };

  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value?.byteLength) continue;

    let bytes = value;
    if (pendingByte !== null) {
      bytes = new Uint8Array(value.byteLength + 1);
      bytes[0] = pendingByte;
      bytes.set(value, 1);
    }

    pendingByte = bytes.byteLength % 2 === 1 ? bytes[bytes.byteLength - 1] : null;
    const evenBytes = pendingByte === null ? bytes : bytes.subarray(0, bytes.byteLength - 1);
    if (!evenBytes.byteLength) continue;

    const samples = decodePcm16Le(evenBytes);
    const audioBuffer = context.createBuffer(1, samples.length, sampleRate);
    audioBuffer.getChannelData(0).set(samples);

    if (!startupBuffered) {
      startupBuffers.push(audioBuffer);
      bufferedDuration += audioBuffer.duration;
      if (hasEnoughEternaPcmStartupAudio(bufferedDuration)) {
        flushStartupBuffers();
      }
    } else {
      scheduleBuffer(audioBuffer);
    }
  }

  if (signal.aborted) return;
  flushStartupBuffers();
  if (!firstAudioScheduled) throw new Error('El stream PCM terminó sin audio');

  streamEnded = true;
  finishIfReady();
}
