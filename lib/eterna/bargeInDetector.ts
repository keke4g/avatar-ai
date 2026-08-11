export interface BargeInDetectorConfig {
  calibrationMs: number;
  minimumRms: number;
  baselineMultiplier: number;
  requiredEvidenceMs: number;
  evidenceDecayRate: number;
  baselineAdaptationRate: number;
  maxFrameMs: number;
}

export interface BargeInDetectorState {
  startedAt: number;
  lastFrameAt: number;
  baselineRms: number;
  calibrationPeakRms: number;
  calibrationFrames: number;
  speechEvidenceMs: number;
  triggered: boolean;
}

export interface BargeInDetectorFrame {
  triggered: boolean;
  isCalibrating: boolean;
  thresholdRms: number;
  speechEvidenceMs: number;
}

export const DEFAULT_BARGE_IN_DETECTOR_CONFIG: BargeInDetectorConfig = {
  // Give the browser echo canceller time to learn Eterna's current playback
  // level before a user's voice is allowed to interrupt it.
  calibrationMs: 600,
  minimumRms: 0.03,
  baselineMultiplier: 2.25,
  // Sustained evidence rejects keyboard taps, doors, and other short noises.
  requiredEvidenceMs: 240,
  evidenceDecayRate: 1.5,
  baselineAdaptationRate: 0.025,
  maxFrameMs: 50,
};

export const createBargeInDetectorState = (startedAt: number): BargeInDetectorState => ({
  startedAt,
  lastFrameAt: startedAt,
  baselineRms: 0,
  calibrationPeakRms: 0,
  calibrationFrames: 0,
  speechEvidenceMs: 0,
  triggered: false,
});

export const calculateAudioRms = (samples: Float32Array): number => {
  if (samples.length === 0) return 0;

  let squaredTotal = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index];
    squaredTotal += sample * sample;
  }

  return Math.sqrt(squaredTotal / samples.length);
};

export const evaluateBargeInFrame = (
  state: BargeInDetectorState,
  rms: number,
  now: number,
  config: BargeInDetectorConfig = DEFAULT_BARGE_IN_DETECTOR_CONFIG,
): BargeInDetectorFrame => {
  if (state.triggered) {
    return {
      triggered: true,
      isCalibrating: false,
      thresholdRms: config.minimumRms,
      speechEvidenceMs: state.speechEvidenceMs,
    };
  }

  const safeRms = Number.isFinite(rms) ? Math.max(0, rms) : 0;
  const elapsedMs = Math.max(0, now - state.startedAt);
  const frameMs = Math.min(config.maxFrameMs, Math.max(0, now - state.lastFrameAt));
  state.lastFrameAt = now;

  if (elapsedMs < config.calibrationMs) {
    state.calibrationFrames += 1;
    const sampleWeight = 1 / state.calibrationFrames;
    state.baselineRms += (safeRms - state.baselineRms) * sampleWeight;
    state.calibrationPeakRms = Math.max(state.calibrationPeakRms, safeRms);
    state.speechEvidenceMs = 0;

    const calibrationBaseline = Math.max(state.baselineRms, state.calibrationPeakRms * 0.5);
    return {
      triggered: false,
      isCalibrating: true,
      thresholdRms: Math.max(config.minimumRms, calibrationBaseline * config.baselineMultiplier),
      speechEvidenceMs: 0,
    };
  }

  const effectiveBaseline = Math.max(state.baselineRms, state.calibrationPeakRms * 0.5);
  const thresholdRms = Math.max(config.minimumRms, effectiveBaseline * config.baselineMultiplier);
  const isSpeechCandidate = safeRms >= thresholdRms;

  if (isSpeechCandidate) {
    state.speechEvidenceMs += frameMs;
  } else {
    state.speechEvidenceMs = Math.max(
      0,
      state.speechEvidenceMs - frameMs * config.evidenceDecayRate,
    );

    // Follow slow changes in room noise without letting a loud candidate raise
    // its own threshold while it is being evaluated.
    state.baselineRms += (safeRms - state.baselineRms) * config.baselineAdaptationRate;
  }

  if (state.speechEvidenceMs >= config.requiredEvidenceMs) {
    state.triggered = true;
  }

  return {
    triggered: state.triggered,
    isCalibrating: false,
    thresholdRms,
    speechEvidenceMs: state.speechEvidenceMs,
  };
};
