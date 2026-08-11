import type { ConversationMemory } from '@/lib/eterna/ConversationEngine';

const SWAP_PATTERN = /\b(intercambiar|intercambio|hacer swap|swap|swaps|permutar|permuta|acepto intercambio|trueque|exchange)\b/i;
const RENT_PATTERN = /\b(renta|rentar|alquilar|alquiler|busco renta|arrendar|arriendo|mensual|mensuales|mes|rent|rental|monthly|lease)\b/i;
const SALE_PATTERN = /\b(comprar|compra|adquirir|busco comprar|me interesa comprar|adquisicion|venta|buy|purchase|sale|inversion)\b/i;
const APARTMENT_PATTERN = /\b(departamento|departamentos|depa|depas|depto|deptos|condo|condominio|apartment|apartments|flat|apartamento|apartamentos)\b/i;
const HOUSE_PATTERN = /\b(casa|casas|hogar|hogares|vivienda|viviendas|residencia|residencias|residencial|home|house|houses|villa)\b/i;

export type SearchPropertyType = 'Casas' | 'Departamentos';
export type SearchOperation = 'sale' | 'rent';
export type SearchOfferingMode = 'SALE' | 'RENT' | 'SWAP';

export function determineOperation(
  memory: ConversationMemory,
  promptHistory: string,
): SearchOperation | undefined {
  if (memory.operation?.value === 'sale' || memory.operation?.value === 'rent') {
    return memory.operation.value;
  }

  if (SWAP_PATTERN.test(promptHistory)) return undefined;
  if (RENT_PATTERN.test(promptHistory)) return 'rent';
  if (SALE_PATTERN.test(promptHistory)) return 'sale';

  if (memory.budget?.value && RENT_PATTERN.test(memory.budget.value)) {
    return 'rent';
  }

  return (memory.purpose?.value || 'vivir') === 'inversion' ? 'sale' : 'rent';
}

export function determineOfferingMode(
  memory: ConversationMemory,
  promptHistory: string,
): SearchOfferingMode {
  if (memory.operation?.value === 'sale') return 'SALE';
  if (memory.operation?.value === 'rent') return 'RENT';
  if (memory.operation?.value === 'swap') return 'SWAP';
  if (SWAP_PATTERN.test(promptHistory)) return 'SWAP';
  if (RENT_PATTERN.test(promptHistory)) return 'RENT';
  if (SALE_PATTERN.test(promptHistory)) return 'SALE';
  return (memory.purpose?.value || 'vivir') === 'inversion' ? 'SALE' : 'SWAP';
}

export function determinePropertyType(
  memory: ConversationMemory,
  promptHistory: string,
): SearchPropertyType | undefined {
  if (memory.propertyType?.value === 'departamento') return 'Departamentos';
  if (memory.propertyType?.value === 'casa') return 'Casas';
  if (APARTMENT_PATTERN.test(promptHistory)) return 'Departamentos';
  if (HOUSE_PATTERN.test(promptHistory)) return 'Casas';
  return undefined;
}
