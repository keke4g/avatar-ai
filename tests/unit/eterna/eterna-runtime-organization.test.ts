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
import {
  ETERNA_AVATAR_AUDIO_LEAD_IN_MS,
  ETERNA_MOBILE_MIC_TO_SPEAKER_HANDOFF_MS,
  ETERNA_PCM_START_BUFFER_MS,
  getEternaPlaybackLeadInMs,
  hasEnoughEternaPcmStartupAudio,
  shouldUseAutomaticBargeIn,
} from '../../../lib/eterna/voiceTiming';
import { buildEternaSystemPrompt } from '../../../lib/eterna/systemPrompt';
import {
  isTemporaryPropertyVisualSection,
  resolvePropertyVisualSection,
} from '../../../lib/eterna/propertyVisuals';
import { isReusablePcmAudioContextState } from '../../../lib/eterna/audioContextPolicy';
import {
  ETERNA_PROPERTY_PRESENTATION_SILENT_HOLD_MS,
  getPropertyPresentationCloseDelay,
} from '../../../lib/eterna/propertyPresentationTiming';
import { resolvePropertyVisualAnswer } from '../../../lib/eterna/actions/PropertyVisualActions';
import {
  clearAuthenticatedGreeting,
  consumeAuthenticatedGreeting,
  consumePropertySummaryPresentation,
  getEternaFirstName,
} from '../../../lib/eterna/sessionExperience';
import type { Property } from '../../../lib/types';

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
  assert.match(prompt.content, /3 o 4 oraciones breves/);
  assert.match(prompt.content, /UNA pregunta breve/);
  assert.match(prompt.content, /beneficio cotidiano o la sensación/);
});

test('personaliza el saludo y conserva el resumen una sola vez por propiedad y pestaña', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };

  assert.equal(getEternaFirstName('  Christian   Arellano  ', 'otro@example.com'), 'Christian');
  assert.equal(getEternaFirstName('', 'cristian@example.com'), 'cristian');
  assert.equal(consumePropertySummaryPresentation(storage, 'property-1'), true);
  assert.equal(consumePropertySummaryPresentation(storage, 'property-1'), false);
  assert.equal(consumePropertySummaryPresentation(storage, 'property-2'), true);

  assert.equal(consumeAuthenticatedGreeting(storage, 'user-1'), true);
  assert.equal(consumeAuthenticatedGreeting(storage, 'user-1'), false);
  clearAuthenticatedGreeting(storage, 'user-1');
  assert.equal(consumeAuthenticatedGreeting(storage, 'user-1'), true);
});

test('protege el inicio PCM sin agregar una espera fija al salir del micrófono móvil', () => {
  assert.equal(ETERNA_MOBILE_MIC_TO_SPEAKER_HANDOFF_MS, 0);
  assert.equal(getEternaPlaybackLeadInMs({ afterRecognition: false, isMobile: true }), ETERNA_AVATAR_AUDIO_LEAD_IN_MS);
  assert.equal(getEternaPlaybackLeadInMs({ afterRecognition: true, isMobile: false }), ETERNA_AVATAR_AUDIO_LEAD_IN_MS);
  assert.equal(
    getEternaPlaybackLeadInMs({ afterRecognition: true, isMobile: true }),
    ETERNA_AVATAR_AUDIO_LEAD_IN_MS + ETERNA_MOBILE_MIC_TO_SPEAKER_HANDOFF_MS,
  );
  assert.equal(hasEnoughEternaPcmStartupAudio((ETERNA_PCM_START_BUFFER_MS - 1) / 1_000), false);
  assert.equal(hasEnoughEternaPcmStartupAudio(ETERNA_PCM_START_BUFFER_MS / 1_000), true);
  assert.equal(shouldUseAutomaticBargeIn(true), false);
  assert.equal(shouldUseAutomaticBargeIn(false), true);
});

test('reutiliza contextos de audio móviles suspendidos pero reemplaza los cerrados', () => {
  assert.equal(isReusablePcmAudioContextState('running'), true);
  assert.equal(isReusablePcmAudioContextState('suspended'), true);
  assert.equal(isReusablePcmAudioContextState('closed'), false);
  assert.equal(isReusablePcmAudioContextState(null), false);
});

test('mantiene visible el resumen si la narración no llegó a iniciar', () => {
  assert.equal(getPropertyPresentationCloseDelay({
    audibleSpeechStartedAt: null,
    endedAt: 8_000,
  }), ETERNA_PROPERTY_PRESENTATION_SILENT_HOLD_MS);
  assert.equal(getPropertyPresentationCloseDelay({
    audibleSpeechStartedAt: 1_000,
    endedAt: 2_000,
  }), 3_500);
  assert.equal(getPropertyPresentationCloseDelay({
    audibleSpeechStartedAt: 1_000,
    endedAt: 8_000,
  }), 0);
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
  assert.equal(resolvePropertyVisualSection('¿Cómo se siente la sala y el comedor?'), 'amenities');
  assert.equal(resolvePropertyVisualSection('Hazme un resumen en pocas palabras'), 'summary');
  assert.equal(resolvePropertyVisualSection('Buenos días'), null);
});

test('el resumen es la única experiencia visual temporal', () => {
  assert.equal(isTemporaryPropertyVisualSection('summary'), true);
  assert.equal(isTemporaryPropertyVisualSection('amenities'), false);
  assert.equal(isTemporaryPropertyVisualSection('location'), false);
  assert.equal(isTemporaryPropertyVisualSection('commercial'), false);
});

test('responde secciones visuales desde los datos de la propiedad sin esperar al agente remoto', () => {
  const property = {
    id: 'property-fast-voice',
    title: 'Casa de prueba',
    description: 'Casa familiar con distribución funcional.',
    type: 'Villa',
    location: 'Montebello, Culiacán Rosales',
    country: 'México',
    valueRating: 'Premium',
    images: ['https://example.com/cover.jpg', 'https://example.com/kitchen.jpg'],
    amenities: ['Alberca', 'Gimnasio', 'Balcón'],
    auraScore: 90,
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 6,
    hostId: 'host-1',
    hostName: 'Asesor Towers',
    hostAvatar: '',
    hostVerified: true,
    hostRating: 5,
    hostReviewsCount: 1,
    availableStart: '',
    availableEnd: '',
    latitude: 24.8,
    longitude: -107.4,
    surfaceBuilt: 154.85,
    nearbyPlaces: [{
      id: 'school-1',
      name: 'Colegio del Valle',
      category: 'school',
      latitude: 24.81,
      longitude: -107.41,
      distanceMeters: 900,
      durationSeconds: 240,
      routeSource: 'google_routes',
    }],
    offerings: [{
      id: 'offering-1',
      propertyId: 'property-fast-voice',
      mode: 'SALE',
      status: 'ACTIVE',
      visibility: 'PUBLIC',
      priceAmount: 2_900_000,
      currency: 'MXN',
      billingPeriod: 'TOTAL',
      acceptsBankCredit: true,
      acceptsCash: true,
      isPriceNegotiable: false,
      acceptsOffers: false,
      requiresApproval: false,
      allowInstantRequest: false,
      swapPreferences: {},
      isFeatured: false,
      featuredRank: 0,
      metadata: {},
    }],
  } as Property;

  const amenities = resolvePropertyVisualAnswer({
    language: 'es',
    prompt: 'Dime las amenidades',
    property,
    section: 'amenities',
  });
  assert.match(amenities?.speech || '', /Alberca/);
  assert.match(amenities?.speech || '', /Gimnasio/);
  assert.match(amenities?.speech || '', /relajarse/);
  assert.match(amenities?.speech || '', /bienestar/);
  assert.match(amenities?.speech || '', /\?$/);

  const financing = resolvePropertyVisualAnswer({
    language: 'es',
    prompt: 'Muéstrame las opciones de pago',
    property,
    section: 'financing',
  });
  assert.match(financing?.speech || '', /crédito bancario/);
  assert.match(financing?.speech || '', /recursos propios/);

  const technical = resolvePropertyVisualAnswer({
    language: 'es',
    prompt: 'Dime cuántos metros tiene',
    property,
    section: 'technical',
  });
  assert.match(technical?.speech || '', /154\.85 metros cuadrados/);

  const school = resolvePropertyVisualAnswer({
    language: 'es',
    prompt: '¿Cuál es la escuela más cercana?',
    property,
    section: 'location',
  });
  assert.match(school?.speech || '', /Colegio del Valle/);
  assert.match(school?.speech || '', /4 minutos en auto/);
  assert.doesNotMatch(school?.speech || '', /Abrí el mapa/);

  const generalLocation = resolvePropertyVisualAnswer({
    language: 'es',
    prompt: 'Muéstrame la ubicación',
    property,
    section: 'location',
  });
  assert.match(generalLocation?.speech || '', /Abrí el mapa/);
});
