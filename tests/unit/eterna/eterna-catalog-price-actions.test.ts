import assert from 'node:assert/strict';
import test from 'node:test';

import {
  detectCatalogPriceRequest,
  resolveCatalogPriceRequest,
} from '../../../lib/eterna/actions/CatalogPriceActions';
import { planFastPropertySearch } from '../../../lib/eterna/fastSearchPlanner';
import { searchProperties } from '../../../lib/search/SearchEngine';
import type { Property, PropertyOffering, PropertyOfferingMode } from '../../../lib/types';

function offering(
  propertyId: string,
  mode: PropertyOfferingMode,
  priceAmount: number | null,
  currency = 'MXN',
): PropertyOffering {
  return {
    id: `${propertyId}-${mode}`,
    propertyId,
    mode,
    status: 'ACTIVE',
    visibility: 'PUBLIC',
    priceAmount,
    currency,
    billingPeriod: mode === 'SALE' ? 'TOTAL' : mode === 'MONTHLY_RENT' ? 'MONTH' : 'NIGHT',
    isPriceNegotiable: false,
    acceptsOffers: false,
    requiresApproval: false,
    allowInstantRequest: false,
    swapPreferences: {},
    isFeatured: false,
    featuredRank: 0,
    metadata: {},
  };
}

function property(params: {
  id: string;
  title: string;
  city?: string;
  type?: Property['type'];
  primaryOperation?: Property['primaryOperation'];
  offerings: PropertyOffering[];
}): Property {
  return {
    id: params.id,
    title: params.title,
    description: '',
    type: params.type || 'Villa',
    location: `${params.city || 'Culiacán Rosales'}, México`,
    city: params.city || 'Culiacán Rosales',
    country: 'México',
    valueRating: 'Premium',
    images: [],
    amenities: [],
    auraScore: 90,
    bedrooms: 3,
    bathrooms: 2,
    maxGuests: 5,
    hostId: 'host',
    hostName: 'Host',
    hostAvatar: '',
    hostVerified: true,
    hostRating: 5,
    hostReviewsCount: 0,
    availableStart: '2026-01-01',
    availableEnd: '2026-12-31',
    latitude: 24.8,
    longitude: -107.4,
    isPublished: true,
    folderStatus: 'PUBLISHED',
    primaryOperation: params.primaryOperation || 'SALE',
    offerings: params.offerings,
  };
}

const expensive = property({
  id: 'expensive',
  title: 'Casa Grande',
  offerings: [
    offering('expensive', 'MONTHLY_RENT', 7_500),
    offering('expensive', 'SALE', 8_790_000),
  ],
});
const cheapest = property({
  id: 'cheapest',
  title: 'Casa Aeropuerto',
  offerings: [offering('cheapest', 'SALE', 2_599_996)],
});
const middle = property({
  id: 'middle',
  title: 'Casa del Río',
  offerings: [offering('middle', 'SALE', 2_899_996)],
});

test('detecta comparaciones y órdenes de precio expresadas naturalmente', () => {
  assert.deepEqual(detectCatalogPriceRequest('me gustaría conocer la que tiene menor precio'), {
    intent: 'lowest',
    sort: 'price_asc',
    requestedCount: 1,
  });
  assert.equal(detectCatalogPriceRequest('¿Cuál es la propiedad más cara?')?.intent, 'highest');
  assert.equal(detectCatalogPriceRequest('Ordénalas de menor a mayor')?.intent, 'sort_asc');
  assert.equal(detectCatalogPriceRequest('¿Cuál es el rango de precios?')?.intent, 'range');
  assert.equal(detectCatalogPriceRequest('show me the cheapest one')?.intent, 'lowest');
});

test('resuelve el menor y mayor precio usando la modalidad comercial correcta', () => {
  const lowest = resolveCatalogPriceRequest({
    prompt: 'me gustaría conocer la que tiene menor precio',
    properties: [expensive, cheapest, middle],
    operation: 'sale',
    language: 'es',
  });
  assert.equal(lowest?.intent, 'lowest');
  assert.equal(lowest?.orderedPropertyIds[0], 'cheapest');
  assert.match(lowest?.reply || '', /MXN \$2,599,996/);
  assert.doesNotMatch(lowest?.reply || '', /7,500/);

  const highest = resolveCatalogPriceRequest({
    prompt: 'ahora muéstrame la más cara',
    properties: [expensive, cheapest, middle],
    operation: 'sale',
    language: 'es',
  });
  assert.equal(highest?.orderedPropertyIds[0], 'expensive');
  assert.match(highest?.reply || '', /MXN \$8,790,000/);
});

test('explica el rango y evita comparar modalidades o monedas incompatibles', () => {
  const range = resolveCatalogPriceRequest({
    prompt: 'dime el rango de precios',
    properties: [expensive, cheapest, middle],
    operation: 'sale',
    language: 'es',
  });
  assert.match(range?.reply || '', /MXN \$2,599,996/);
  assert.match(range?.reply || '', /MXN \$8,790,000/);

  const rental = property({
    id: 'rent',
    title: 'Departamento en renta',
    primaryOperation: 'RENT',
    offerings: [offering('rent', 'MONTHLY_RENT', 18_000)],
  });
  const mixed = resolveCatalogPriceRequest({
    prompt: '¿cuál es la más barata?',
    properties: [cheapest, rental],
    language: 'es',
  });
  assert.equal(mixed?.intent, 'clarification');
  assert.match(mixed?.reply || '', /mezclan precios de venta, renta mensual/);

  const usd = property({
    id: 'usd',
    title: 'Casa en dólares',
    offerings: [offering('usd', 'SALE', 500_000, 'USD')],
  });
  const currencies = resolveCatalogPriceRequest({
    prompt: 'ordena por menor precio',
    properties: [cheapest, usd],
    operation: 'sale',
    language: 'es',
  });
  assert.equal(currencies?.intent, 'clarification');
  assert.match(currencies?.reply || '', /monedas distintas/);
});

test('cede al buscador cuando la solicitud cambia de ciudad u operación', () => {
  const guadalajara = property({
    id: 'gdl',
    title: 'Departamento Tetlán',
    city: 'Guadalajara',
    type: 'Apartment',
    offerings: [offering('gdl', 'SALE', 2_180_000)],
  });

  assert.equal(resolveCatalogPriceRequest({
    prompt: 'muéstrame la más barata en Guadalajara',
    properties: [cheapest, middle],
    catalogProperties: [cheapest, middle, guadalajara],
    operation: 'sale',
    language: 'es',
  }), null);

  assert.equal(resolveCatalogPriceRequest({
    prompt: 'ahora la renta más barata',
    properties: [cheapest, middle],
    operation: 'sale',
    language: 'es',
  }), null);
});

test('el plan rápido conserva la intención de ordenar por precio', () => {
  const plan = planFastPropertySearch({
    prompt: 'busco la casa más barata en Puebla para comprar',
    currentMemory: {},
    catalogLocations: [{ city: 'Puebla' }],
  });
  assert.equal(plan.ready, true);
  assert.equal(plan.memory.sort?.value, 'price_asc');
  assert.equal(plan.memory.operation?.value, 'sale');
  assert.equal(plan.memory.city?.value, 'Puebla');
});

test('SearchEngine ordena por precio de venta y no por una renta activa', () => {
  const sorted = searchProperties([expensive, cheapest, middle], {
    operation: 'sale',
    sort: 'price_asc',
  });
  assert.deepEqual(sorted.map((item) => item.id), ['cheapest', 'middle', 'expensive']);
});
