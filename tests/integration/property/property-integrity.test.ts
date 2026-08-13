import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { Property, PropertyOffering } from '../../../lib/types';
import { PropertyEligibilityEngine } from '../../../lib/services/PropertyEligibilityEngine';
import { PropertyValidator } from '../../../lib/services/PropertyValidator';
import { validatePropertyImportBatch } from '../../../lib/services/PropertyImportValidator';
import { mapPostgresOffering } from '../../../lib/services/PropertyMapper';
import {
  calculateRentalSigningCosts,
  shouldSyncSuggestedRentalDeposit,
} from '../../../lib/rentalTerms';
import {
  AppointmentCrmRecord,
  buildAppointmentWhatsAppUrl,
  formatAppointmentFolio,
} from '../../../lib/services/AppointmentCrmService';
import { parseBudgetRange } from '../../../lib/search/SearchEngine';
import {
  isPropertyPublishingTrigger,
  isPropertySearchTrigger,
} from '../../../lib/eterna/IntentRouter';
import { planFastPropertySearch } from '../../../lib/eterna/fastSearchPlanner';
import { buildPropertyPresentation } from '../../../lib/eterna/actions/PropertyActions';
import {
  getEternaValuationDossier,
  resolveValuationQuestion,
} from '../../../lib/eterna/actions/ValuationActions';
import { ensureConversationContinues } from '../../../lib/eterna/conversationContinuity';
import { parsePageAgentResponse } from '../../../lib/eterna/pageAgent';
import { getPropertyGalleryMedia } from '../../../lib/propertyMedia';
import {
  getPropertyMicroMarketKey,
  hasValidMexicoCoordinates,
  ValuationEngine,
} from '../../../lib/valuation/ValuationEngine';
import { mapMarketObservationToCatalogProperty } from '../../../lib/valuation/MarketObservationMapper';
import { buildPresentationValuation } from '../../../features/properties/property-details/propertyValuation';

const offering: PropertyOffering = {
  id: 'offering-1',
  propertyId: 'property-1',
  mode: 'SALE',
  status: 'ACTIVE',
  visibility: 'PUBLIC',
  priceAmount: 2_500_000,
  currency: 'MXN',
  billingPeriod: 'TOTAL',
  isPriceNegotiable: false,
  acceptsOffers: true,
  requiresApproval: true,
  allowInstantRequest: false,
  swapPreferences: {},
  isFeatured: false,
  featuredRank: 0,
  metadata: {},
};

const validProperty = (): Partial<Property> => ({
  id: 'property-1',
  hostId: 'user-1',
  title: 'Casa contemporánea con jardín',
  description: 'Residencia completa con espacios amplios, iluminación natural y acabados durables.',
  type: 'Villa',
  valueRating: 'Curated',
  location: 'Chihuahua, Chihuahua',
  country: 'México',
  latitude: 28.632,
  longitude: -106.069,
  bedrooms: 3,
  bathrooms: 2,
  levelsCount: 2,
  parkingSpaces: 2,
  images: Array.from({ length: 5 }, (_, index) => `https://example.com/photo-${index}.jpg`),
  offerings: [offering],
  isPublished: true,
  folderStatus: 'PUBLISHED',
});

test('publication rejects absent and out-of-country coordinates', () => {
  const absent = PropertyValidator.validateForPublication({
    ...validProperty(),
    latitude: null,
    longitude: null,
  });
  assert.equal(absent.success, false);
  assert.ok(absent.errors.some((error) => error.field === 'latitude'));

  const outsideMexico = PropertyValidator.validateForPublication({
    ...validProperty(),
    latitude: 35.6762,
    longitude: 139.6503,
  });
  assert.ok(outsideMexico.errors.some((error) => error.field === 'location'));
});

test('review submission only requires title, location, price and one photo', () => {
  const result = PropertyValidator.validateForPublication({
    ...validProperty(),
    title: 'Casa',
    description: '',
    type: undefined,
    valueRating: undefined,
    parkingSpaces: 0,
    images: ['https://example.com/1.jpg'],
  });
  assert.equal(result.success, true);
  assert.equal(result.errors.length, 0);
  assert.ok(result.warnings.some((warning) => warning.field === 'description'));
});

test('review submission still blocks a missing price or photo', () => {
  const withoutPrice = PropertyValidator.validateForPublication({
    ...validProperty(),
    offerings: [{ ...offering, priceAmount: 0 }],
  });
  assert.ok(withoutPrice.errors.some((error) => error.field === 'price'));

  const withoutPhotos = PropertyValidator.validateForPublication({
    ...validProperty(),
    images: [],
    media: [],
  });
  assert.ok(withoutPhotos.errors.some((error) => error.field === 'images'));
});

test('multilevel homes may have more built area than land area', () => {
  const result = PropertyValidator.validateForPublication({
    ...validProperty(),
    surfaceTotal: 200,
    surfaceBuilt: 289.84,
  });
  assert.equal(result.success, true);
  assert.equal(result.errors.some((error) => error.field === 'surfaceBuilt'), false);
});

test('unknown legal facts never produce a green status or compatible mortgage', () => {
  const property = validProperty() as Property;
  const legal = PropertyEligibilityEngine.getLegalStatus(property);
  const credits = PropertyEligibilityEngine.calculateEligibleCredits(property);
  assert.equal(legal.status, 'YELLOW');
  assert.equal(credits.compatibles.includes('Crédito Hipotecario Bancario'), false);
});

test('rental offering mapper preserves every contracting condition', () => {
  const mapped = mapPostgresOffering({
    id: 'rent-offering-1',
    property_id: 'property-1',
    mode: 'MONTHLY_RENT',
    status: 'ACTIVE',
    visibility: 'PUBLIC',
    price_amount: '7500.00',
    currency: 'MXN',
    billing_period: 'MONTH',
    deposit_amount: '7500.00',
    security_deposit_amount: '7500.00',
    advance_months: 1,
    requires_guarantor: true,
    requires_legal_policy: true,
    min_months: 12,
    is_price_negotiable: false,
    accepts_offers: false,
    requires_approval: true,
    allow_instant_request: false,
    swap_preferences: {},
    is_featured: false,
    featured_rank: 0,
    metadata: {
      rentalFurnishingStatus: 'SEMI_FURNISHED',
      includedRentalServices: ['WATER'],
    },
    property_offering_availability: [],
    pricing_rules: [],
  });

  assert.equal(mapped.depositAmount, 7500);
  assert.equal(mapped.securityDepositAmount, 7500);
  assert.equal(mapped.advanceMonths, 1);
  assert.equal(mapped.requiresGuarantor, true);
  assert.equal(mapped.requiresLegalPolicy, true);
  assert.deepEqual(mapped.metadata.includedRentalServices, ['WATER']);
});

test('public rental offering rebuilds safe metadata fields from the public view', () => {
  const mapped = mapPostgresOffering({
    id: 'rent-offering-public',
    property_id: 'property-1',
    mode: 'MONTHLY_RENT',
    status: 'ACTIVE',
    visibility: 'PUBLIC',
    price_amount: '7500.00',
    currency: 'MXN',
    billing_period: 'MONTH',
    rental_furnishing_status: 'SEMI_FURNISHED',
    included_rental_services: ['WATER', 'INTERNET'],
    accepts_pets: false,
    includes_maintenance: true,
    property_offering_availability: [],
    pricing_rules: [],
  });

  assert.equal(mapped.metadata.rentalFurnishingStatus, 'SEMI_FURNISHED');
  assert.deepEqual(mapped.metadata.includedRentalServices, ['WATER', 'INTERNET']);
  assert.equal(mapped.metadata.includesServices, true);
  assert.equal(mapped.metadata.acceptsPets, false);
  assert.equal(mapped.metadata.includesMaintenance, true);
});

test('monthly rental signing total includes advance rent and security deposit', () => {
  const costs = calculateRentalSigningCosts({
    monthlyRent: 7_500,
    advanceMonths: 1,
    securityDeposit: 7_500,
  });

  assert.equal(costs.rentDueAtSigning, 7_500);
  assert.equal(costs.securityDeposit, 7_500);
  assert.equal(costs.totalDueAtSigning, 15_000);
  assert.equal(shouldSyncSuggestedRentalDeposit(0, 7_500), true);
  assert.equal(shouldSyncSuggestedRentalDeposit(7_500, 7_500), true);
  assert.equal(shouldSyncSuggestedRentalDeposit(5_000, 7_500), false);
});

test('batch import rejects duplicate inventory rows', () => {
  const first = { ...validProperty(), internalCode: 'AS-001', isPublished: false, folderStatus: 'UNDER_REVIEW' as const };
  const result = validatePropertyImportBatch([
    { rowNumber: 2, property: first },
    { rowNumber: 3, property: { ...first, title: 'Otro título válido para la misma casa' } },
  ]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.rejected[0]?.duplicateOfRow, 2);
});

test('appointment CRM generates stable folios and a complete WhatsApp handoff', () => {
  const appointment: AppointmentCrmRecord = {
    id: 'appointment-1',
    appointmentNumber: 27,
    clientName: 'María López',
    appointmentAt: '2026-08-01T18:30:00.000Z',
    propertyReference: 'Casa Bugambilias · AS-P-000027',
    prospectorUserId: 'advisor-1',
    prospectorName: 'Christian Towers',
    paymentMethod: 'Crédito bancario',
    clientPhone: '+52 667 123 4567',
    status: 'NEW',
    createdBy: 'advisor-1',
    createdAt: '2026-07-29T18:00:00.000Z',
    updatedAt: '2026-07-29T18:00:00.000Z',
  };

  assert.equal(formatAppointmentFolio(appointment.appointmentNumber), 'CI-000027');

  const whatsappUrl = buildAppointmentWhatsAppUrl(appointment, 'es');
  assert.ok(whatsappUrl.startsWith('https://wa.me/526624739146?text='));

  const message = decodeURIComponent(whatsappUrl.split('?text=')[1]);
  assert.match(message, /NUEVA CITA · TOWERS MÉXICO/);
  assert.match(message, /CI-000027/);
  assert.match(message, /María López/);
  assert.match(message, /Casa Bugambilias/);
  assert.match(message, /Christian Towers/);
  assert.match(message, /Crédito bancario/);
  assert.match(message, /\+52 667 123 4567/);
});

test('Eterna routes owner selling language to publishing instead of catalog search', () => {
  const publishingPrompt = 'Quiero vender una casa';
  assert.equal(isPropertyPublishingTrigger(publishingPrompt), true);
  assert.equal(isPropertySearchTrigger(publishingPrompt), false);
  assert.equal(planFastPropertySearch({
    prompt: publishingPrompt,
    currentMemory: {},
    catalogLocations: [],
  }).matched, false);

  const buyerPrompt = 'Busco una casa en venta en Culiacán';
  assert.equal(isPropertyPublishingTrigger(buyerPrompt), false);
  assert.equal(planFastPropertySearch({
    prompt: buyerPrompt,
    currentMemory: {},
    catalogLocations: [],
  }).matched, true);
});

test('Eterna preserves minimum budgets expressed as arriba de', () => {
  assert.deepEqual(
    parseBudgetRange('Busco un departamento en Culiacán arriba de 5 millones de pesos'),
    { min: 5_000_000 },
  );

  const plan = planFastPropertySearch({
    prompt: 'Busco un departamento en Culiacán arriba de 5 millones de pesos para comprar',
    currentMemory: {},
    catalogLocations: [],
  });
  assert.equal(plan.ready, true);
  assert.equal(plan.memory.budget?.value, 'desde 5000000');
});

test('Eterna presents a property briefly and leaves the conversation open', () => {
  const presentation = buildPropertyPresentation(
    { ...validProperty(), offerings: [offering] } as Property,
    'es',
    0,
  );

  assert.ok(presentation.speech.length < 430);
  assert.ok(presentation.speech.endsWith('?'));
  assert.match(presentation.speech, /precio de venta de/);
  assert.match(presentation.speech, /una casa/);
  assert.doesNotMatch(presentation.speech, /una villa/);
  assert.doesNotMatch(presentation.speech, /baños completos y \$[\d,.]+/);
});

test('Eterna identifies monthly rent instead of speaking an isolated amount', () => {
  const rentalPresentation = buildPropertyPresentation(
    {
      ...validProperty(),
      offerings: [{
        ...offering,
        id: 'offering-rent',
        mode: 'MONTHLY_RENT',
        billingPeriod: 'MONTH',
        priceAmount: 18_500,
      }],
    } as Property,
    'es',
    0,
  );

  assert.match(rentalPresentation.speech, /renta mensual de/);
});

test('Eterna appends a contextual continuation only when it is needed', () => {
  const continued = ensureConversationContinues(
    'Abrí el mapa con la ubicación y los puntos cercanos.',
    'es',
    'property',
  );
  assert.ok(continued.endsWith('?'));

  const alreadyOpen = '¿Quieres revisar primero el entorno o el precio?';
  assert.equal(ensureConversationContinues(alreadyOpen, 'es', 'property'), alreadyOpen);
});

test('Eterna accepts the property location modal as a page action', () => {
  const parsed = parsePageAgentResponse({
    reply: 'Abriré el mapa. ¿Quieres revisar algún lugar cercano?',
    intent: 'interact',
    action: {
      type: 'open_property_location',
      route: '',
      target: 'Mapa y lugares cercanos',
      channel: 'none',
      requiresConfirmation: false,
    },
    search: {
      intent: 'general',
      operation: 'unknown',
      purpose: 'unknown',
      city: '',
      zone: '',
      propertyType: 'unknown',
      budgetText: '',
      budgetMin: 0,
      budgetMax: 0,
      rooms: 0,
      features: [],
      missingField: 'none',
      readyToSearch: false,
    },
    propertyStage: 'discovery',
    contactIntent: false,
    preferredContact: 'none',
    leadSummary: '',
    suggestedReplies: ['Ver hospitales', 'Ver escuelas'],
    understoodGoal: 'Abrir el mapa de la propiedad',
  });

  assert.equal(parsed?.action.type, 'open_property_location');
});

test('Eterna accepts expanded property video as a page action', () => {
  const parsed = parsePageAgentResponse({
    reply: 'Abriré el video de la propiedad. ¿Quieres revisar después la ubicación?',
    intent: 'interact',
    action: {
      type: 'open_property_video',
      route: '',
      target: 'Video de la propiedad',
      channel: 'none',
      requiresConfirmation: false,
    },
    search: {
      intent: 'general',
      operation: 'unknown',
      purpose: 'unknown',
      city: '',
      zone: '',
      propertyType: 'unknown',
      budgetText: '',
      budgetMin: 0,
      budgetMax: 0,
      rooms: 0,
      features: [],
      missingField: 'none',
      readyToSearch: false,
    },
    propertyStage: 'discovery',
    contactIntent: false,
    preferredContact: 'none',
    leadSummary: '',
    suggestedReplies: ['Ver ubicación', 'Revisar amenidades'],
    understoodGoal: 'Abrir el video de la propiedad',
  });

  assert.equal(parsed?.action.type, 'open_property_video');
});

test('property gallery includes direct, YouTube and Vimeo videos in display order', () => {
  const property = {
    ...validProperty(),
    media: [
      { mediaType: 'IMAGE', url: 'https://example.com/photo.webp' },
      { mediaType: 'VIDEO', url: 'https://example.com/tour.mp4' },
      { mediaType: 'YOUTUBE', url: 'https://youtu.be/dQw4w9WgXcQ' },
      { mediaType: 'VIMEO', url: 'https://vimeo.com/123456' },
    ],
  } as Property;

  assert.deepEqual(
    getPropertyGalleryMedia(property).map((item) => item.type),
    ['image', 'video', 'youtube', 'vimeo'],
  );
});

const valuedProperty = () => ({
  ...validProperty(),
  valuation: {
    currency: 'MXN',
    estimatedSaleValue: 7_775_735,
    saleRangeLow: 6_843_000,
    saleRangeHigh: 8_709_000,
    salePricePerM2: 54_643,
    estimatedMonthlyRent: 42_969,
    rentRangeLow: 39_000,
    rentRangeHigh: 47_000,
    rentPricePerM2: 307,
    estimatedCapRate: 5.4,
    grossRentalYield: 5.4,
    listingPrice: 7_650_000,
    listingVsEstimatePct: -1.6,
    areaReferenceValue: null,
    areaRangeLow: null,
    areaRangeHigh: null,
    areaPricePerM2: null,
    areaReferenceOperation: null,
    areaLocationBasis: null,
    evidenceTier: 'STRICT_ESTIMATE' as const,
    confidence: 'MEDIUM' as const,
    confidenceScore: 78,
    comparableCount: 12,
    saleComparableCount: 8,
    rentComparableCount: 4,
    dataAsOf: '2026-07-31',
    modelVersion: 'towers-market-v5',
    methodology: 'Comparables homologados por ubicación, superficie y antigüedad',
    warnings: [],
    comparables: [{
      propertyId: 'private-comparable-1',
      title: 'Comparable privado',
      location: 'Dirección privada',
    }],
  },
}) as Property & { valuation: Record<string, unknown> };

test('Eterna answers valuation figures deterministically with range and confidence', () => {
  const answer = resolveValuationQuestion('¿Cuánto vale esta propiedad?', valuedProperty(), 'es');

  assert.ok(answer);
  assert.match(answer.reply, /estimación automatizada de Towers México/i);
  assert.match(answer.reply, /\$7,775,735/);
  assert.match(answer.reply, /\$6,843,000/);
  assert.match(answer.reply, /confianza es media/i);
  assert.match(answer.reply, /12 comparables/i);
  assert.match(answer.reply, /No sustituye un avalúo oficial/i);
  assert.ok(answer.reply.endsWith('?'));
  assert.doesNotMatch(answer.speech, /m²|%/);
});

test('Eterna explains rent and cap rate without sending symbols to TTS', () => {
  const rent = resolveValuationQuestion('¿Cuál es la renta estimada?', valuedProperty(), 'es');
  assert.match(rent?.reply || '', /\$42,969/);
  assert.match(rent?.reply || '', /\$307\/m²/);
  assert.match(rent?.speech || '', /por metro cuadrado/);
  assert.doesNotMatch(rent?.speech || '', /m²/);

  const cap = resolveValuationQuestion('¿Qué cap rate tendría?', valuedProperty(), 'es');
  assert.match(cap?.reply || '', /5\.4%/);
  assert.match(cap?.speech || '', /5\.4 por ciento/);
  assert.match(cap?.reply || '', /no descuenta vacancia/i);
});

test('Eterna compares the listing price without calling it a guaranteed opportunity', () => {
  const answer = resolveValuationQuestion('¿Está barato o es una buena oportunidad?', valuedProperty(), 'es');

  assert.match(answer?.reply || '', /1\.6% por debajo/i);
  assert.match(answer?.reply || '', /no una garantía de oportunidad/i);
  assert.ok(answer?.reply.endsWith('?'));
});

test('Eterna never invents an estimate when valuation data is absent or insufficient', () => {
  const absent = resolveValuationQuestion(
    '¿Cuánto vale?',
    validProperty() as Property,
    'es',
  );
  assert.match(absent?.reply || '', /Todavía no hay una estimación automatizada/i);
  assert.doesNotMatch(absent?.reply || '', /\$\d/);

  const insufficient = {
    ...valuedProperty(),
    valuation: {
      ...valuedProperty().valuation,
      estimatedSaleValue: null,
      confidence: 'INSUFFICIENT',
    },
  } as unknown as Property;
  const result = resolveValuationQuestion('Dame el avalúo', insufficient, 'es');
  assert.match(result?.reply || '', /datos disponibles como insuficientes/i);
  assert.doesNotMatch(result?.reply || '', /\$\d/);
});

test('Eterna also hides positive values from low-confidence or legacy models', () => {
  const lowConfidence = {
    ...valuedProperty(),
    valuation: {
      ...valuedProperty().valuation,
      confidence: 'LOW' as const,
    },
  } as unknown as Property;
  const legacyModel = {
    ...valuedProperty(),
    valuation: {
      ...valuedProperty().valuation,
      modelVersion: 'towers-market-v4',
    },
  } as unknown as Property;

  for (const property of [lowConfidence, legacyModel]) {
    const answer = resolveValuationQuestion('¿Cuánto vale?', property, 'es');
    assert.match(answer?.reply || '', /datos disponibles como insuficientes/i);
    assert.doesNotMatch(answer?.reply || '', /\$\d/);
    assert.equal(getEternaValuationDossier(property), null);
  }
});

test('Eterna valuation dossier excludes private comparable identities', () => {
  const dossier = getEternaValuationDossier(valuedProperty());
  const serialized = JSON.stringify(dossier);

  assert.match(serialized, /ESTIMACION_AUTOMATIZADA_DE_VALOR/);
  assert.match(serialized, /7775735/);
  assert.doesNotMatch(serialized, /private-comparable-1|Comparable privado|Dirección privada/);
});

test('Eterna valuation resolver does not intercept mortgage monthly-payment questions', () => {
  const answer = resolveValuationQuestion(
    '¿Cuánto pagaría al mes de hipoteca con 20% de enganche?',
    valuedProperty(),
    'es',
  );
  assert.equal(answer, null);
});

test('valuation engine fails closed when nearby listings belong to another micro-market', () => {
  const target = {
    ...validProperty(),
    id: 'target',
    type: 'Villa',
    latitude: 24.80,
    longitude: -107.39,
    surfaceBuilt: 200,
    offerings: [{ ...offering, propertyId: 'target', priceAmount: 4_100_000 }],
  } as Property;
  const comparable = (
    id: string,
    price: number,
    surfaceBuilt: number,
    latitude: number,
    longitude: number,
    neighborhood: string,
  ) => ({
    ...validProperty(),
    id,
    type: 'Villa',
    latitude,
    longitude,
    neighborhood,
    location: `${neighborhood}, Culiacán Rosales`,
    surfaceBuilt,
    offerings: [{ ...offering, id: `offering-${id}`, propertyId: id, priceAmount: price }],
    isPublished: true,
    isDemo: false,
  }) as Property;
  const catalog = [
    target,
    comparable('near-1', 4_000_000, 200, 24.801, -107.391, 'Montebello'),
    comparable('near-2', 4_400_000, 220, 24.805, -107.395, 'Villas del Río'),
    comparable('japan-outlier', 80_000_000, 100, 35.5988, 139.7229, 'Centro'),
  ];

  const result = ValuationEngine.evaluate(target, catalog, {
    maxDistanceMeters: 25_000,
    now: new Date('2026-08-03T00:00:00.000Z'),
  });

  assert.equal(hasValidMexicoCoordinates(catalog[3]), false);
  assert.equal(result.saleComparableCount, 0);
  assert.equal(result.estimatedSaleValue, null);
  assert.equal(result.salePricePerM2, null);
  assert.equal(result.confidence, 'INSUFFICIENT');
  assert.ok(result.comparables.every((item) => item.propertyId !== 'japan-outlier'));
});

test('Lomas de Angelópolis locality aliases resolve to one metropolitan micro-market', () => {
  const phaseTwo = {
    ...validProperty(),
    privateNeighborhood: 'Lomas de Angelópolis 2',
    location: 'Lomas de Angelópolis, San Bernardino Tlaxcalancingo',
  } as Property;
  const sanAndres = {
    ...validProperty(),
    neighborhood: 'Lomas de Angelópolis',
    privateNeighborhood: undefined,
    location: 'Lomas de Angelópolis, San Andrés Cholula',
  } as Property;
  assert.equal(getPropertyMicroMarketKey(phaseTwo), getPropertyMicroMarketKey(sanAndres));
});

test('legacy city and state location does not use the state as the city', () => {
  const target = {
    ...validProperty(),
    neighborhood: 'Urbivilla del Cedro',
    location: 'Culiacán Rosales, Sinaloa',
  } as Property;
  const external = {
    ...validProperty(),
    neighborhood: 'Villa del Cedro',
    location: 'Villa del Cedro, Culiacán Rosales, Sinaloa',
  } as Property;
  assert.equal(getPropertyMicroMarketKey(target), 'culiacan|villa del cedro');
  assert.equal(getPropertyMicroMarketKey(target), getPropertyMicroMarketKey(external));
});

test('Tres Ríos numeric and written aliases resolve to one micro-market', () => {
  const target = {
    ...validProperty(),
    neighborhood: 'Desarrollo Urbano Tres Ríos',
    location: 'Desarrollo Urbano Tres Ríos, Culiacán Rosales',
  } as Property;
  const external = {
    ...validProperty(),
    neighborhood: 'Zona comercial Desarrollo Urbano 3 Ríos',
    location: 'Zona comercial Desarrollo Urbano 3 Ríos, Culiacán Rosales',
  } as Property;
  assert.equal(getPropertyMicroMarketKey(target), getPropertyMicroMarketKey(external));
});

test('city-only Guadalajara is not interpreted as a neighborhood in Jalisco', () => {
  const property = {
    ...validProperty(),
    neighborhood: undefined,
    location: 'Guadalajara, Jalisco',
  } as Property;
  assert.equal(getPropertyMicroMarketKey(property), 'guadalajara');
});

test('valuation engine does not use a city-wide bucket as a micro-market', () => {
  const target = {
    ...validProperty(),
    id: 'city-only-target',
    type: 'Apartment',
    location: 'Guadalajara, Jalisco',
    neighborhood: undefined,
    latitude: 20.6618,
    longitude: -103.2772,
    surfaceBuilt: 60,
  } as Property;
  const result = ValuationEngine.evaluate(target, [target], { now: new Date('2026-08-09T00:00:00Z') });
  assert.equal(result.confidence, 'INSUFFICIENT');
  assert.ok(result.warnings.some((warning) => warning.includes('micromercado')));
});

test('Aldama Tetlán and Tetlán resolve to one Guadalajara micro-market', () => {
  const aldama = {
    ...validProperty(),
    neighborhood: 'Aldama Tetlán',
    location: 'Aldama Tetlán, Guadalajara',
  } as Property;
  const tetlan = {
    ...validProperty(),
    neighborhood: 'Tetlán',
    location: 'Tetlán, Guadalajara',
  } as Property;
  assert.equal(getPropertyMicroMarketKey(aldama), getPropertyMicroMarketKey(tetlan));
});

test('Villas del Oriente II resolves to its Tonalá market despite the legacy Tlaquepaque label', () => {
  const legacy = {
    ...validProperty(),
    neighborhood: 'Villas del Oriente II',
    location: 'Villas del Oriente II, San Pedro Tlaquepaque',
  } as Property;
  const portal = {
    ...validProperty(),
    neighborhood: 'Villas de Oriente 2',
    location: 'Villas de Oriente 2, Tonalá',
  } as Property;
  assert.equal(getPropertyMicroMarketKey(legacy), 'tonala|villas de oriente ii');
  assert.equal(getPropertyMicroMarketKey(legacy), getPropertyMicroMarketKey(portal));
});

test('valuation engine publishes an initial commercial estimate from three coherent comparables', () => {
  const target = {
    ...validProperty(),
    id: 'stable-target',
    type: 'Villa',
    neighborhood: 'Montebello',
    location: 'Montebello, Culiacán Rosales',
    latitude: 24.80,
    longitude: -107.39,
    surfaceBuilt: 200,
    surfaceTotal: 250,
    offerings: [{ ...offering, propertyId: 'stable-target', priceAmount: 5_100_000 }],
  } as Property;
  const comparable = (index: number, price: number, latitudeOffset: number) => ({
    ...validProperty(),
    id: `stable-${index}`,
    type: 'Villa',
    neighborhood: 'Montebello',
    location: 'Montebello, Culiacán Rosales',
    latitude: 24.80 + latitudeOffset,
    longitude: -107.39,
    surfaceBuilt: 195 + index * 2,
    surfaceTotal: 245 + index * 2,
    bedrooms: 3,
    bathrooms: 2,
    offerings: [{
      ...offering,
      id: `stable-offering-${index}`,
      propertyId: `stable-${index}`,
      priceAmount: price,
    }],
    isPublished: true,
    isDemo: false,
    publishedAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  }) as Property;
  const catalog = [
    target,
    comparable(1, 4_800_000, 0.001),
    comparable(2, 5_000_000, -0.001),
    comparable(3, 5_100_000, 0.0015),
  ];

  const result = ValuationEngine.evaluate(target, catalog, {
    now: new Date('2026-08-03T00:00:00.000Z'),
  });

  assert.equal(result.saleComparableCount, 3);
  assert.equal(result.estimatedSaleValue, null);
  assert.ok(result.areaReferenceValue);
  assert.ok(result.areaRangeLow);
  assert.ok(result.areaRangeHigh);
  assert.equal(result.evidenceTier, 'AREA_REFERENCE');
  assert.equal(result.confidence, 'LOW');
  assert.match(result.modelVersion, /v5$/);
});

test('two comparables remain insufficient for a public commercial estimate', () => {
  const target = {
    ...validProperty(),
    id: 'two-comparable-target',
    type: 'Villa',
    neighborhood: 'Montebello',
    location: 'Montebello, Culiacán Rosales',
    surfaceBuilt: 200,
    surfaceTotal: 250,
    offerings: [{ ...offering, propertyId: 'two-comparable-target', priceAmount: 5_100_000 }],
  } as Property;
  const comparable = (index: number, price: number) => ({
    ...target,
    id: `two-comparable-${index}`,
    surfaceBuilt: 198 + index,
    offerings: [{
      ...offering,
      id: `two-comparable-offering-${index}`,
      propertyId: `two-comparable-${index}`,
      priceAmount: price,
    }],
    publishedAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  }) as Property;

  const result = ValuationEngine.evaluate(target, [
    target,
    comparable(1, 4_900_000),
    comparable(2, 5_200_000),
  ], { now: new Date('2026-08-03T00:00:00.000Z') });

  assert.equal(result.areaReferenceValue, null);
  assert.equal(result.evidenceTier, 'INSUFFICIENT');
  assert.equal(result.confidence, 'INSUFFICIENT');
  assert.match(result.warnings.join(' '), /3 propiedades comparables/i);
});

test('three incoherent prices remain hidden despite meeting the raw count', () => {
  const target = {
    ...validProperty(),
    id: 'dispersed-target',
    type: 'Villa',
    neighborhood: 'Montebello',
    location: 'Montebello, Culiacán Rosales',
    surfaceBuilt: 200,
    surfaceTotal: 250,
    offerings: [{ ...offering, propertyId: 'dispersed-target', priceAmount: 5_000_000 }],
  } as Property;
  const prices = [1_000_000, 5_000_000, 12_000_000];
  const comparables = prices.map((price, index) => ({
    ...target,
    id: `dispersed-${index}`,
    offerings: [{
      ...offering,
      id: `dispersed-offering-${index}`,
      propertyId: `dispersed-${index}`,
      priceAmount: price,
    }],
    publishedAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  }) as Property);

  const result = ValuationEngine.evaluate(target, [target, ...comparables], {
    now: new Date('2026-08-03T00:00:00.000Z'),
  });

  assert.equal(result.areaReferenceValue, null);
  assert.equal(result.confidence, 'INSUFFICIENT');
  assert.match(result.warnings.join(' '), /dispersión|retirar una propiedad/i);
});

test('external observations without coordinates publish only a commercial estimate and never invent distance', () => {
  const target = {
    ...validProperty(),
    id: 'market-target',
    type: 'Villa',
    neighborhood: 'La Conquista',
    location: 'La Conquista, Culiacán Rosales',
    city: 'Culiacán Rosales',
    state: 'Sinaloa',
    latitude: 24.81,
    longitude: -107.39,
    surfaceBuilt: 100,
    surfaceTotal: 110,
    offerings: [{ ...offering, propertyId: 'market-target', priceAmount: 2_700_000 }],
  } as Property;
  const marketRows = [
    2_500_000,
    2_560_000,
    2_620_000,
    2_680_000,
    2_740_000,
    2_800_000,
    2_860_000,
    2_920_000,
  ].map((price, index) => ({
    id: `00000000-0000-4000-8000-00000000000${index}`,
    source_code: index % 2 ? 'inmuebles24' : 'propiedades-com',
    external_reference: `listing-${index}`,
    observation_kind: 'ASKING_SALE' as const,
    observation_date: '2026-08-01',
    property_type: 'HOUSE' as const,
    title: `Casa comparable ${index}`,
    neighborhood: 'La Conquista',
    city: 'Culiacán Rosales',
    state: 'Sinaloa',
    latitude: null,
    longitude: null,
    bedrooms: 3,
    bathrooms: 2,
    parking_spaces: 2,
    construction_age: 5,
    conservation_state: null,
    surface_total_m2: 108 + index,
    surface_built_m2: 98 + index,
    price_amount: price,
    currency: 'MXN',
    quality_score: 80,
    published_at: null,
    last_verified_at: '2026-08-03T00:00:00.000Z',
    location_precision: 'NEIGHBORHOOD' as const,
    syndication_fingerprint: `fingerprint-${index}`,
    data_completeness: 0.9,
    usage_authorization: 'AUTHORIZED' as const,
  }));
  const observations = marketRows
    .map(mapMarketObservationToCatalogProperty)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  assert.ok(observations.every((item) => item.valuationSource?.publishedAt === null));
  assert.ok(observations.every((item) => item.updatedAt === '2026-08-03T00:00:00.000Z'));

  const result = ValuationEngine.evaluate(target, [target, ...observations], {
    now: new Date('2026-08-04T00:00:00.000Z'),
  });

  assert.equal(result.saleComparableCount, 8);
  assert.equal(result.estimatedSaleValue, null);
  assert.ok(result.areaReferenceValue);
  assert.equal(result.evidenceTier, 'AREA_REFERENCE');
  assert.equal(result.confidence, 'LOW');
  assert.ok(result.comparables.every((item) => item.marketObservationId));
  assert.ok(result.comparables.every((item) => item.distanceMeters === null));
  assert.match(result.warnings.join(' '), /estimación comercial aproximada/i);
});

test('valuation engine publishes only a current, geolocated and source-diverse authorized sample', () => {
  const target = {
    ...validProperty(),
    id: 'authorized-target',
    type: 'Villa',
    neighborhood: 'Montebello',
    location: 'Montebello, Culiacán Rosales',
    city: 'Culiacán Rosales',
    state: 'Sinaloa',
    latitude: 24.80,
    longitude: -107.39,
    surfaceBuilt: 200,
    surfaceTotal: 250,
    bedrooms: 3,
    bathrooms: 3,
    offerings: [{ ...offering, propertyId: 'authorized-target', priceAmount: 5_100_000 }],
  } as Property;
  const rows = Array.from({ length: 8 }, (_, index) => ({
    id: `10000000-0000-4000-8000-00000000000${index}`,
    source_code: index < 4 ? 'easybroker-authorized-a' : 'easybroker-authorized-b',
    external_reference: `authorized-${index}`,
    observation_kind: 'ASKING_SALE' as const,
    observation_date: '2026-08-03',
    published_at: '2026-07-15T00:00:00.000Z',
    last_verified_at: '2026-08-03T00:00:00.000Z',
    property_type: 'HOUSE' as const,
    title: `Casa autorizada ${index}`,
    neighborhood: 'Montebello',
    city: 'Culiacán Rosales',
    state: 'Sinaloa',
    latitude: 24.799 + index * 0.00025,
    longitude: -107.391 + index * 0.0002,
    location_precision: 'POINT' as const,
    bedrooms: 3,
    bathrooms: 3,
    parking_spaces: 2,
    construction_age: 5,
    conservation_state: null,
    surface_total_m2: 245 + index,
    surface_built_m2: 196 + index,
    price_amount: 4_900_000 + index * 60_000,
    currency: 'MXN',
    quality_score: 92,
    syndication_fingerprint: `unique-home-${index}`,
    data_completeness: 0.95,
    usage_authorization: 'AUTHORIZED' as const,
  }));
  const observations = rows
    .map(mapMarketObservationToCatalogProperty)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const result = ValuationEngine.evaluate(target, [target, ...observations], {
    now: new Date('2026-08-04T00:00:00.000Z'),
  });

  assert.equal(result.saleComparableCount, 8);
  assert.ok(result.estimatedSaleValue);
  assert.equal(result.confidence, 'MEDIUM');
  assert.ok(result.confidenceScore >= 65);
  assert.match(result.modelVersion, /v5$/);
});

test('valuation engine can use a current, minimal and source-diverse research sample', () => {
  const target = {
    ...validProperty(),
    id: 'research-target',
    type: 'Villa',
    neighborhood: 'Montebello',
    location: 'Montebello, Culiacán Rosales',
    city: 'Culiacán Rosales',
    state: 'Sinaloa',
    latitude: 24.80,
    longitude: -107.39,
    surfaceBuilt: 200,
    surfaceTotal: 250,
    bedrooms: 3,
    bathrooms: 3,
    offerings: [{ ...offering, propertyId: 'research-target', priceAmount: 5_100_000 }],
  } as Property;
  const rows = Array.from({ length: 8 }, (_, index) => ({
    id: `20000000-0000-4000-8000-00000000000${index}`,
    source_code: index < 4 ? 'propiedades-com' : 'inmuebles24',
    external_reference: `research-${index}`,
    observation_kind: 'ASKING_SALE' as const,
    observation_date: '2026-08-03',
    published_at: '2026-07-15T00:00:00.000Z',
    last_verified_at: '2026-08-03T00:00:00.000Z',
    property_type: 'HOUSE' as const,
    title: `Casa pública ${index}`,
    neighborhood: 'Montebello',
    city: 'Culiacán',
    state: 'Sinaloa',
    latitude: 24.799 + index * 0.00025,
    longitude: -107.391 + index * 0.0002,
    location_precision: 'POINT' as const,
    bedrooms: 3,
    bathrooms: 3,
    parking_spaces: 2,
    construction_age: 5,
    conservation_state: null,
    surface_total_m2: 245 + index,
    surface_built_m2: 196 + index,
    price_amount: 4_900_000 + index * 60_000,
    currency: 'MXN',
    quality_score: 92,
    syndication_fingerprint: `public-home-${index}`,
    data_completeness: 0.95,
    usage_authorization: 'RESEARCH_ONLY' as const,
  }));
  const observations = rows
    .map(mapMarketObservationToCatalogProperty)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const result = ValuationEngine.evaluate(target, [target, ...observations], {
    now: new Date('2026-08-04T00:00:00.000Z'),
  });

  assert.equal(result.saleComparableCount, 8);
  assert.ok(result.estimatedSaleValue);
  assert.equal(result.confidence, 'MEDIUM');
  assert.match(result.methodology, /investigación/i);
});

test('commercial estimate does not require point distance when the exact micromarket matches', () => {
  const target = {
    ...validProperty(),
    id: 'dominated-target',
    type: 'Villa',
    neighborhood: 'Montebello',
    location: 'Montebello, Culiacán Rosales',
    latitude: 24.80,
    longitude: -107.39,
    surfaceBuilt: 200,
    surfaceTotal: 250,
  } as Property;
  const comparable = (index: number, latitude: number, price: number) => ({
    ...target,
    id: `dominated-${index}`,
    latitude,
    offerings: [{
      ...offering,
      id: `dominated-offering-${index}`,
      propertyId: `dominated-${index}`,
      priceAmount: price,
    }],
    publishedAt: '2026-07-15T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
  }) as Property;

  const result = ValuationEngine.evaluate(target, [
    target,
    comparable(1, 24.8001, 5_000_000),
    comparable(2, 24.84, 5_050_000),
    comparable(3, 24.845, 5_100_000),
    comparable(4, 24.85, 5_150_000),
    comparable(5, 24.855, 5_200_000),
  ]);

  assert.equal(result.estimatedSaleValue, null);
  assert.ok(result.areaReferenceValue);
  assert.equal(result.evidenceTier, 'AREA_REFERENCE');
  assert.equal(result.confidence, 'LOW');
});

test('valuation engine refuses to invent a value without surface or enough comparables', () => {
  const target = {
    ...validProperty(),
    id: 'insufficient-target',
    surfaceBuilt: null,
    surfaceTotal: null,
  } as Property;
  const result = ValuationEngine.evaluate(target, [target], { minComparables: 2 });

  assert.equal(result.estimatedSaleValue, null);
  assert.equal(result.confidence, 'INSUFFICIENT');
  assert.match(result.warnings.join(' '), /superficie/i);
});

test('valuation engine publishes a separate low-confidence area reference without invented distances', () => {
  const target = {
    ...validProperty(),
    id: 'area-reference-target',
    type: 'Villa',
    neighborhood: 'La Conquista',
    location: 'La Conquista, Culiacán Rosales',
    city: 'Culiacán Rosales',
    state: 'Sinaloa',
    latitude: 24.81,
    longitude: -107.39,
    surfaceBuilt: 100,
    surfaceTotal: 110,
    bedrooms: 3,
    bathrooms: 2,
    offerings: [{ ...offering, propertyId: 'area-reference-target', priceAmount: 2_800_000 }],
  } as Property;
  const rows = Array.from({ length: 10 }, (_, index) => ({
    id: `30000000-0000-4000-8000-0000000000${String(index).padStart(2, '0')}`,
    source_code: index < 5 ? 'portal-a' : 'portal-b',
    external_reference: `area-${index}`,
    observation_kind: 'ASKING_SALE' as const,
    observation_date: '2026-08-03',
    published_at: null,
    last_verified_at: '2026-08-03T00:00:00.000Z',
    property_type: 'HOUSE' as const,
    title: `Casa de área ${index}`,
    neighborhood: 'La Conquista',
    city: 'Culiacán Rosales',
    state: 'Sinaloa',
    latitude: null,
    longitude: null,
    location_precision: 'NEIGHBORHOOD' as const,
    bedrooms: 3,
    bathrooms: 2,
    parking_spaces: 2,
    construction_age: 5,
    conservation_state: null,
    surface_total_m2: 105 + index,
    surface_built_m2: 96 + index,
    price_amount: 2_550_000 + index * 45_000,
    currency: 'MXN',
    quality_score: 92,
    syndication_fingerprint: `area-home-${index}`,
    data_completeness: 0.95,
    usage_authorization: 'RESEARCH_ONLY' as const,
  }));
  const observations = rows
    .map(mapMarketObservationToCatalogProperty)
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const result = ValuationEngine.evaluate(target, [target, ...observations], {
    now: new Date('2026-08-04T00:00:00.000Z'),
  });

  assert.equal(result.estimatedSaleValue, null);
  assert.ok(result.areaReferenceValue);
  assert.ok(result.areaRangeLow);
  assert.ok(result.areaRangeHigh);
  assert.equal(result.evidenceTier, 'AREA_REFERENCE');
  assert.equal(result.confidence, 'LOW');
  assert.equal(result.listingVsEstimatePct, null);
  assert.equal(result.grossRentalYield, null);
  assert.equal(result.comparableCount, 10);
  assert.ok(result.comparables.every((item) => item.distanceMeters === null));
});

test('Eterna calls an area reference an approximate commercial estimate, not an appraisal', () => {
  const property = {
    ...valuedProperty(),
    valuation: {
      ...valuedProperty().valuation,
      estimatedSaleValue: null,
      saleRangeLow: null,
      saleRangeHigh: null,
      salePricePerM2: null,
      listingVsEstimatePct: null,
      estimatedCapRate: null,
      grossRentalYield: null,
      areaReferenceValue: 5_200_000,
      areaRangeLow: 4_700_000,
      areaRangeHigh: 5_900_000,
      areaPricePerM2: 26_000,
      areaReferenceOperation: 'SALE',
      areaLocationBasis: 'NEIGHBORHOOD',
      evidenceTier: 'AREA_REFERENCE',
      confidence: 'LOW',
      confidenceScore: 61,
      comparableCount: 11,
    },
  } as unknown as Property;

  const answer = resolveValuationQuestion('¿Cuánto vale esta propiedad?', property, 'es');
  assert.match(answer?.reply || '', /estimación comercial aproximada/i);
  assert.match(answer?.reply || '', /\$5,200,000/);
  assert.match(answer?.reply || '', /no sustituye un avalúo/i);
  assert.match(JSON.stringify(getEternaValuationDossier(property)), /ESTIMACION_COMERCIAL_ORIENTATIVA/);
});

test('property valuation presentation classifies a low listing against the commercial range', () => {
  const automatedValuation = {
    ...valuedProperty().valuation!,
    estimatedSaleValue: null,
    saleRangeLow: null,
    saleRangeHigh: null,
    salePricePerM2: null,
    areaReferenceValue: 5_200_000,
    areaRangeLow: 4_700_000,
    areaRangeHigh: 5_900_000,
    areaPricePerM2: 26_000,
    areaReferenceOperation: 'SALE' as const,
    areaLocationBasis: 'NEIGHBORHOOD' as const,
    evidenceTier: 'AREA_REFERENCE' as const,
    confidence: 'LOW' as const,
    confidenceScore: 54,
    comparableCount: 3,
  };
  const listingOffering = {
    ...offering,
    priceAmount: 4_500_000,
  };

  const presentation = buildPresentationValuation({
    automatedValuation,
    language: 'es',
    offerings: [listingOffering],
    selectedMode: 'SALE',
  });

  assert.equal(presentation?.status, 'REFERENCE_ONLY');
  assert.equal(presentation?.estimatedValue, 5_200_000);
  assert.equal(presentation?.marketPosition, 'BELOW');
  assert.equal(presentation?.differencePercent, -13.46);
  assert.equal(presentation?.confidenceLabel, 'Estimación inicial');
});

test('valuation recalculation reads private subject overrides through a service-only RPC', () => {
  const recalculationScript = readFileSync(
    resolve(process.cwd(), 'scripts/valuation/recalculate-market-valuations.ts'),
    'utf8',
  );
  const rpcMigration = readFileSync(
    resolve(
      process.cwd(),
      'supabase/migrations/20260811030840_expose_verified_valuation_subject_overrides.sql',
    ),
    'utf8',
  );

  assert.match(recalculationScript, /rpc\('get_verified_property_subject_overrides'\)/);
  assert.doesNotMatch(recalculationScript, /\.schema\('valuation'\)/);
  assert.match(
    rpcMigration,
    /revoke all on function public\.get_verified_property_subject_overrides\(\)[\s\S]*from public, anon, authenticated;/,
  );
  assert.match(
    rpcMigration,
    /grant execute on function public\.get_verified_property_subject_overrides\(\)[\s\S]*to service_role;/,
  );
});

test('production valuation gate exposes three-comparable guidance without opening write access', () => {
  const migration = readFileSync(
    resolve(
      process.cwd(),
      'supabase/migrations/20260813055916_simplify_market_guidance.sql',
    ),
    'utf8',
  );

  assert.match(migration, /new\.comparable_count >= 3/);
  assert.match(migration, /new\.confidence_score between 30 and 64/);
  assert.match(migration, /persisted\.source_count >= 1/);
  assert.match(migration, /security definer[\s\S]*set search_path = pg_catalog, public, valuation/);
  assert.match(
    migration,
    /revoke all on function public\.save_market_valuation_run\(jsonb\) from public, anon, authenticated;/,
  );
  assert.match(
    migration,
    /grant execute on function public\.save_market_valuation_run\(jsonb\) to service_role;/,
  );
  assert.match(migration, /property_valuation_runs_property_created_idx/);
});
