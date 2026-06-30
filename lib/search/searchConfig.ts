export type OperationMode = 'SWAP' | 'SALE' | 'RENT';

export interface DropdownOption {
  value: string;
  label: string;
}

export interface OperationSearchConfig {
  placeholder: string;
  submitLabel: string;
  budgetOptions: DropdownOption[];
}

export const PROPERTY_TYPE_OPTIONS: DropdownOption[] = [
  { value: 'All', label: 'Todas' },
  { value: 'Casas', label: 'Casa' },
  { value: 'Departamentos', label: 'Departamento' },
  { value: 'Lofts', label: 'Loft' },
  { value: 'Terrenos', label: 'Terreno' },
  { value: 'Locales', label: 'Local Comercial' },
  { value: 'Oficinas', label: 'Oficina' }
];

export const BUDGET_SALE_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Cualquier presupuesto' },
  { value: '500000', label: 'Menos de $500,000 MXN' },
  { value: '1000000', label: '$500,000 – $1 millón' },
  { value: '2000000', label: '$1 – $2 millones' },
  { value: '3000000', label: '$2 – $3 millones' },
  { value: '5000000', label: '$3 – $5 millones' },
  { value: '7000000', label: '$5 – $7 millones' },
  { value: '10000000', label: '$7 – $10 millones' },
  { value: '999999999', label: 'Más de $10 millones' }
];

export const BUDGET_RENT_OPTIONS: DropdownOption[] = [
  { value: '', label: 'Cualquier presupuesto' },
  { value: '5000', label: 'Hasta $5,000 MXN' },
  { value: '10000', label: '$5,000 – $10,000' },
  { value: '15000', label: '$10,000 – $15,000' },
  { value: '20000', label: '$15,000 – $20,000' },
  { value: '30000', label: '$20,000 – $30,000' },
  { value: '50000', label: '$30,000 – $50,000' },
  { value: '999999999', label: 'Más de $50,000' }
];

export const SEARCH_CONFIG: Record<OperationMode, OperationSearchConfig> = {
  SWAP: {
    placeholder: '¿A dónde te gustaría viajar?',
    submitLabel: 'Buscar Swaps',
    budgetOptions: []
  },
  SALE: {
    placeholder: '¿En qué ciudad quieres comprar?',
    submitLabel: 'Buscar Propiedades',
    budgetOptions: BUDGET_SALE_OPTIONS
  },
  RENT: {
    placeholder: '¿Dónde quieres rentar?',
    submitLabel: 'Buscar Rentas',
    budgetOptions: BUDGET_RENT_OPTIONS
  }
};
