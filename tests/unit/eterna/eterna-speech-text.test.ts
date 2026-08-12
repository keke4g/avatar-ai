import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeEternaSpeechText } from '../../../lib/eterna/speechText';

test('Eterna pronounces Mexican property prices as complete numbers', () => {
  assert.equal(
    normalizeEternaSpeechText('El precio de venta es $9,700,000 MXN.'),
    'El precio de venta es nueve millones setecientos mil pesos.',
  );
  assert.equal(
    normalizeEternaSpeechText('La renta mensual es MXN $7,500.'),
    'La renta mensual es siete mil quinientos pesos.',
  );
});

test('Eterna expands abbreviated millions and preserves the declared currency', () => {
  assert.equal(
    normalizeEternaSpeechText('El valor estimado es 9.7 millones MXN.'),
    'El valor estimado es nueve millones setecientos mil pesos.',
  );
  assert.equal(
    normalizeEternaSpeechText('Precio: USD 1,250,000.'),
    'Precio: un millón doscientos cincuenta mil dólares estadounidenses.',
  );
});

test('Eterna uses de pesos for exact million amounts', () => {
  assert.equal(
    normalizeEternaSpeechText('Tiene un precio de $3,000,000.'),
    'Tiene un precio de tres millones de pesos.',
  );
});

test('Eterna expands amounts already written with peso words', () => {
  assert.equal(
    normalizeEternaSpeechText('La estimación es 7,775,735 pesos.'),
    'La estimación es siete millones setecientos setenta y cinco mil setecientos treinta y cinco pesos.',
  );
  assert.equal(
    normalizeEternaSpeechText('La mensualidad sería $68,093 pesos.'),
    'La mensualidad sería sesenta y ocho mil noventa y tres pesos.',
  );
  assert.equal(
    normalizeEternaSpeechText('El rango parte de 9.7 millones de pesos.'),
    'El rango parte de nueve millones setecientos mil pesos.',
  );
});

test('Eterna uses correct singular forms and carries rounded cents', () => {
  assert.equal(normalizeEternaSpeechText('MXN 1.'), 'un peso.');
  assert.equal(
    normalizeEternaSpeechText('USD 1.01.'),
    'un dólar estadounidense con un centavo.',
  );
  assert.equal(normalizeEternaSpeechText('MXN 1.9999.'), 'dos pesos.');
});

test('Eterna speaks percentages, surfaces, terms and dates as words', () => {
  assert.equal(
    normalizeEternaSpeechText('Con 20% de enganche, a 15 años y tasa de 10.5%.'),
    'Con veinte por ciento de enganche, a quince años y tasa de diez punto cinco por ciento.',
  );
  assert.equal(
    normalizeEternaSpeechText('Tiene 144 m² y 3 habitaciones. Corte: 31 jul 2026.'),
    'Tiene ciento cuarenta y cuatro metros cuadrados y tres habitaciones. Corte: treinta y uno de julio de dos mil veintiséis.',
  );
  assert.equal(
    normalizeEternaSpeechText('La construcción es de 154.85 metros cuadrados.'),
    'La construcción es de ciento cincuenta y cuatro punto ochenta y cinco metros cuadrados.',
  );
  assert.equal(
    normalizeEternaSpeechText('La terraza mide 42.05 m².'),
    'La terraza mide cuarenta y dos punto cero cinco metros cuadrados.',
  );
});

test('Eterna does not rewrite phone numbers as monetary or contextual amounts', () => {
  assert.equal(
    normalizeEternaSpeechText('Llama al +52 614 123 4567.'),
    'Llama al +52 614 123 4567.',
  );
});
