import 'client-only';

import { decodePcm16Le, parsePcm16LeSampleRate } from '@/lib/shared/pcm16';

export const ETERNA_FIRST_AUDIO_TIMEOUT_MS = 3_500;

type WebkitWindow = typeof window & {
  webkitAudioContext?: typeof AudioContext;
};

export interface PcmStreamPlaybackOptions {
  response: Response;
  context: AudioContext;
  signal: AbortSignal;
  sources: Set<AudioBufferSourceNode>;
  onFirstAudioScheduled: (context: AudioContext) => void;
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
  onFirstAudioScheduled,
  onPlaybackEnded,
}: PcmStreamPlaybackOptions): Promise<void> {
  const sampleRate = getPcmSampleRate(response);
  if (!sampleRate || !response.body) {
    throw new Error('La respuesta no contiene un stream PCM compatible');
  }

  const reader = response.body.getReader();
  let pendingByte: number | null = null;
  let nextStartTime = context.currentTime + 0.04;
  let scheduledSources = 0;
  let streamEnded = false;
  let firstAudioScheduled = false;
  let playbackEnded = false;

  const finishIfReady = () => {
    if (playbackEnded || signal.aborted || !streamEnded || scheduledSources > 0) return;
    playbackEnded = true;
    onPlaybackEnded();
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

    const startAt = Math.max(nextStartTime, context.currentTime + 0.02);
    source.start(startAt);
    nextStartTime = startAt + audioBuffer.duration;

    if (!firstAudioScheduled) {
      firstAudioScheduled = true;
      onFirstAudioScheduled(context);
    }
  }

  if (signal.aborted) return;
  if (!firstAudioScheduled) throw new Error('El stream PCM terminó sin audio');

  streamEnded = true;
  finishIfReady();
}
