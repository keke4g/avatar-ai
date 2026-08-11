const PCM_FORMAT_PATTERN = /^pcm_s16le_(\d+)$/i;
const MIN_PCM_SAMPLE_RATE = 8_000;
const MAX_PCM_SAMPLE_RATE = 96_000;

export function parsePcm16LeSampleRate(format: string | null | undefined): number | null {
  const match = PCM_FORMAT_PATTERN.exec(format?.trim() || '');
  if (!match) return null;

  const sampleRate = Number(match[1]);
  if (!Number.isInteger(sampleRate) || sampleRate < MIN_PCM_SAMPLE_RATE || sampleRate > MAX_PCM_SAMPLE_RATE) {
    return null;
  }
  return sampleRate;
}

export function decodePcm16Le(bytes: Uint8Array): Float32Array {
  const sampleCount = Math.floor(bytes.byteLength / 2);
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const offset = index * 2;
    const unsignedSample = bytes[offset] | (bytes[offset + 1] << 8);
    const signedSample = unsignedSample >= 0x8000 ? unsignedSample - 0x10000 : unsignedSample;
    samples[index] = signedSample / 0x8000;
  }

  return samples;
}
