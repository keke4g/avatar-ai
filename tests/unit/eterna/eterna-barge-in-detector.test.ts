import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateAudioRms,
  createBargeInDetectorState,
  evaluateBargeInFrame,
} from '../../../lib/eterna/bargeInDetector';

const feedFrames = (
  state: ReturnType<typeof createBargeInDetectorState>,
  fromMs: number,
  toMs: number,
  rms: number,
) => {
  let lastFrame = evaluateBargeInFrame(state, rms, fromMs);
  for (let now = fromMs + 20; now <= toMs; now += 20) {
    lastFrame = evaluateBargeInFrame(state, rms, now);
  }
  return lastFrame;
};

test('audio RMS represents the energy of the microphone samples', () => {
  const samples = Float32Array.from([0.5, -0.5, 0.5, -0.5]);
  assert.equal(calculateAudioRms(samples), 0.5);
});

test('assistant echo near the calibrated room level does not interrupt Eterna', () => {
  const state = createBargeInDetectorState(0);
  feedFrames(state, 0, 580, 0.012);
  const frame = feedFrames(state, 600, 1_400, 0.024);

  assert.equal(frame.triggered, false);
  assert.equal(state.speechEvidenceMs, 0);
});

test('a short loud noise is rejected instead of interrupting Eterna', () => {
  const state = createBargeInDetectorState(0);
  feedFrames(state, 0, 580, 0.01);
  feedFrames(state, 600, 700, 0.09);
  const frame = feedFrames(state, 720, 1_000, 0.01);

  assert.equal(frame.triggered, false);
  assert.equal(state.speechEvidenceMs, 0);
});

test('sustained user speech triggers automatic interruption', () => {
  const state = createBargeInDetectorState(0);
  feedFrames(state, 0, 580, 0.01);
  const frame = feedFrames(state, 600, 900, 0.08);

  assert.equal(frame.triggered, true);
  assert.ok(state.speechEvidenceMs >= 240);
});
