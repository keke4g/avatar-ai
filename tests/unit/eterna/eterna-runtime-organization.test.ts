import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeVoiceText,
  voiceTokenOverlap,
} from '../../../features/eterna/voice/browserSpeech';
import {
  determineOfferingMode,
  determineOperation,
  determinePropertyType,
} from '../../../lib/eterna/searchIntentResolution';
import {
  decodePcm16Le,
  parsePcm16LeSampleRate,
} from '../../../lib/shared/pcm16';
import { ETERNA_AVATAR_AUDIO_LEAD_IN_MS } from '../../../lib/eterna/voiceTiming';
import { buildEternaSystemPrompt } from '../../../lib/eterna/systemPrompt';
import {
  isTemporaryPropertyVisualSection,
  resolvePropertyVisualSection,
} from '../../../lib/eterna/propertyVisuals';

test('normaliza transcripciones y detecta ecos por tokens', () => {
  assert.equal(normalizeVoiceText('¡Casa en MÉXICO, por favor!'), 'casa en mexico por favor');
  assert.ok(voiceTokenOverlap('casa en puebla', 'quiero casa en puebla') >= 0.75);
  assert.equal(voiceTokenOverlap('casa en puebla', 'departamento mazatlan'), 0);
});

test('valida el formato PCM y decodifica muestras little-endian', () => {
  assert.ok(ETERNA_AVATAR_AUDIO_LEAD_IN_MS >= 120 && ETERNA_AVATAR_AUDIO_LEAD_IN_MS <= 220);
  assert.equal(parsePcm16LeSampleRate('pcm_s16le_24000'), 24_000);
  assert.equal(parsePcm16LeSampleRate('PCM_S16LE_48000'), 48_000);
  assert.equal(parsePcm16LeSampleRate('mp3'), null);
  assert.equal(parsePcm16LeSampleRate('pcm_s16le_4000'), null);

  const decoded = decodePcm16Le(new Uint8Array([
    0x00, 0x00,
    0xff, 0x7f,
    0x00, 0x80,
    0xff, 0xff,
  ]));
  assert.equal(decoded.length, 4);
  assert.equal(decoded[0], 0);
  assert.ok(decoded[1] > 0.999);
  assert.equal(decoded[2], -1);
  assert.equal(decoded[3], -1 / 32_768);
});

test('resuelve operación, modalidad y tipo de inmueble desde memoria o lenguaje natural', () => {
  assert.equal(determineOperation({}, 'Quiero rentar una casa por mes'), 'rent');
  assert.equal(determineOperation({}, 'Busco hacer swap de mi vivienda'), undefined);
  assert.equal(determineOfferingMode({}, 'Quiero intercambiar mi casa'), 'SWAP');
  assert.equal(determinePropertyType({}, 'Busco un depa en Puebla'), 'Departamentos');
  assert.equal(
    determinePropertyType({ propertyType: { value: 'casa', confidence: 1 } }, 'sin preferencia'),
    'Casas',
  );
});

test('construye un prompt actual, localizado y limitado a rutas reales', () => {
  const prompt = buildEternaSystemPrompt({
    contextBridgeJson: '{"propertiesCount":2}',
    currentPage: '/explore',
    language: 'es',
    userName: 'Christian',
  });

  assert.equal(prompt.role, 'system');
  assert.match(prompt.content, /Christian/);
  assert.match(prompt.content, /hasta 13 etapas/);
  assert.match(prompt.content, /\/dashboard\?tab=properties/);
  assert.match(prompt.content, /"propertiesCount":2/);
  assert.doesNotMatch(prompt.content, /El Wizard consta de 6/);
});

test('traduce preguntas de la ficha en secciones visuales deterministas', () => {
  assert.equal(resolvePropertyVisualSection('Dime las amenidades y si tiene alberca'), 'amenities');
  assert.equal(resolvePropertyVisualSection('Muéstrame el mapa y qué hay cerca'), 'location');
  assert.equal(resolvePropertyVisualSection('Explícame la estimación y sus comparables'), 'valuation');
  assert.equal(resolvePropertyVisualSection('¿Cuánto cuesta y es negociable?'), 'commercial');
  assert.equal(resolvePropertyVisualSection('Muéstrame las opciones de pago'), 'financing');
  assert.equal(resolvePropertyVisualSection('¿Qué métodos de financiamiento aceptan?'), 'financing');
  assert.equal(resolvePropertyVisualSection('¿Cuánto pagaría de mensualidad?'), 'mortgage');
  assert.equal(resolvePropertyVisualSection('Calcula mi pago mensual a 20 años'), 'mortgage');
  assert.equal(resolvePropertyVisualSection('¿Cuántos metros cuadrados tiene?'), 'technical');
  assert.equal(resolvePropertyVisualSection('¿Tiene cuarto de servicio?', ['Cuarto de servicio']), 'amenities');
  assert.equal(resolvePropertyVisualSection('Hazme un resumen en pocas palabras'), 'summary');
  assert.equal(resolvePropertyVisualSection('Buenos días'), null);
});

test('el resumen es la única experiencia visual temporal', () => {
  assert.equal(isTemporaryPropertyVisualSection('summary'), true);
  assert.equal(isTemporaryPropertyVisualSection('amenities'), false);
  assert.equal(isTemporaryPropertyVisualSection('location'), false);
  assert.equal(isTemporaryPropertyVisualSection('commercial'), false);
});
