import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_ETERNA_VOICE_ENGINE,
  ETERNA_VOICE_ENGINES,
  isEternaVoiceEngine,
} from '../../../lib/eterna/voiceConfig';

test('Fish Audio is a supported selectable Eterna voice engine', () => {
  assert.equal(isEternaVoiceEngine('fishaudio'), true);
  assert.equal(
    ETERNA_VOICE_ENGINES.some(engine => (
      engine.id === 'fishaudio'
      && engine.voice.includes('Español latinoamericano')
    )),
    true,
  );
});

test('Fish Audio is primary and browser is the only fallback', () => {
  assert.equal(DEFAULT_ETERNA_VOICE_ENGINE, 'fishaudio');
  assert.deepEqual(
    ETERNA_VOICE_ENGINES.map(engine => engine.id),
    ['fishaudio', 'browser'],
  );
  assert.equal(isEternaVoiceEngine('browser'), true);
  assert.equal(isEternaVoiceEngine('elevenlabs'), false);
  assert.equal(isEternaVoiceEngine('deepgram'), false);
  assert.equal(isEternaVoiceEngine('azure'), false);
});
