import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getListingQuality,
  getPreviewPriceLabel,
  getWizardSteps,
  mapDbToUiType,
  mapPublisherType,
  mapUiToDbType,
} from '../../../features/properties/property-wizard/utils';

test('mapea identidades y tipos estables del publicador', () => {
  assert.equal(mapPublisherType('OWNER'), 'owner');
  assert.equal(mapPublisherType('CONSTRUCTION_COMPANY'), 'developer');
  assert.equal(mapPublisherType('PROPERTY_MANAGER'), 'property_manager');
  assert.equal(mapPublisherType(undefined), 'owner');

  assert.equal(mapUiToDbType('Departamento'), 'Apartment');
  assert.equal(mapDbToUiType('Beach House'), 'Casa de Playa');
  assert.equal(mapDbToUiType(mapUiToDbType('Loft')), 'Loft');
});

test('calcula calidad completa y recomendaciones para un anuncio incompleto', () => {
  const complete = getListingQuality({
    title: 'Casa familiar en Montebello',
    shortDescription: 'Residencia amplia, iluminada y lista para habitar.',
    location: 'Montebello, Culiacán',
    country: 'México',
    selectedModes: ['SALE'],
    images: ['1', '2', '3', '4', '5'],
    selectedAmenities: ['A', 'B', 'C'],
    customAmenities: ['D', 'E'],
    videoPlaceholder: 'video',
    virtualTourPlaceholder: 'tour',
  });
  assert.deepEqual(complete, { score: 100, suggestions: [] });

  const empty = getListingQuality({
    title: '',
    shortDescription: '',
    location: '',
    country: '',
    selectedModes: [],
    images: [],
    selectedAmenities: [],
    customAmenities: [],
    videoPlaceholder: '',
    virtualTourPlaceholder: '',
  });
  assert.equal(empty.score, 0);
  assert.equal(empty.suggestions.length, 8);
});

test('prioriza la operación comercial correcta en la vista previa', () => {
  assert.equal(
    getPreviewPriceLabel({
      selectedModes: ['SALE', 'SHORT_RENT'],
      salePrice: 5_000_000,
      saleCurrency: 'MXN',
      nightlyPrice: 2_000,
      monthlyPrice: 0,
      monthlyCurrency: 'MXN',
    }),
    '$5,000,000 MXN',
  );
  assert.equal(
    getPreviewPriceLabel({
      selectedModes: ['SWAP'],
      salePrice: 0,
      saleCurrency: 'MXN',
      nightlyPrice: 0,
      monthlyPrice: 0,
      monthlyCurrency: 'MXN',
    }),
    'Intercambio / Swap',
  );
});

test('muestra únicamente los pasos condicionales aplicables', () => {
  const steps = getWizardSteps({
    publisherRepresentativeType: 'OWNER',
    canCaptureOwnerContact: false,
    hasInitialData: false,
    selectedModes: ['SWAP', 'SALE'],
  });
  const visibleIds = steps.filter((step) => step.isVisible).map((step) => step.id);

  assert.ok(visibleIds.includes(6));
  assert.ok(visibleIds.includes(8));
  assert.ok(!visibleIds.includes(0));
  assert.ok(!visibleIds.includes(7));
  assert.ok(!visibleIds.includes(12));
});
