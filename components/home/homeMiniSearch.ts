import type { Property } from '../../lib/types';
import { searchProperties } from '../../lib/search/SearchEngine';
import {
  BUDGET_RENT_OPTIONS,
  BUDGET_SALE_OPTIONS,
  type DropdownOption,
  type OperationMode,
} from '../../lib/search/searchConfig';
import type { PropertySearchFilters } from '../../lib/search/types';

export interface HomeMiniSearchSelection {
  operation: OperationMode;
  zone: string;
  propertyType: string;
  budget: string;
}

export interface HomeMiniBudgetRange {
  minBudget?: number;
  maxBudget?: number;
}

const isPublicInventoryProperty = (property: Property): boolean => (
  property.isPublished !== false
  && property.isDemo !== true
  && property.is_demo !== true
);

export const getHomeMiniBudgetOptions = (operation: OperationMode): DropdownOption[] => {
  if (operation === 'SALE') return BUDGET_SALE_OPTIONS;
  if (operation === 'RENT') return BUDGET_RENT_OPTIONS;
  return [];
};

export const resolveHomeMiniBudgetRange = (
  operation: OperationMode,
  selectedBudget: string,
): HomeMiniBudgetRange => {
  const options = getHomeMiniBudgetOptions(operation);
  const selectedIndex = options.findIndex((option) => option.value === selectedBudget);
  if (selectedIndex <= 0) return {};

  const maxBudget = Number(options[selectedIndex].value);
  const previousValue = Number(options[selectedIndex - 1]?.value);
  return {
    minBudget: Number.isFinite(previousValue) && previousValue > 0 ? previousValue : undefined,
    maxBudget: Number.isFinite(maxBudget) && maxBudget > 0 ? maxBudget : undefined,
  };
};

export const buildHomeMiniSearchFilters = (
  selection: HomeMiniSearchSelection,
): PropertySearchFilters => {
  const budgetRange = resolveHomeMiniBudgetRange(selection.operation, selection.budget);
  return {
    city: selection.zone.trim() || undefined,
    type: selection.propertyType !== 'All' ? selection.propertyType : undefined,
    operation: selection.operation === 'SALE'
      ? 'sale'
      : selection.operation === 'RENT'
        ? 'rent'
        : undefined,
    budget: budgetRange.maxBudget,
    minBudget: budgetRange.minBudget,
    sort: 'best_match',
  };
};

export const buildHomeMiniSearchUrl = (
  selection: HomeMiniSearchSelection,
): string => {
  const filters = buildHomeMiniSearchFilters(selection);
  const params = new URLSearchParams();
  if (filters.city) params.set('search', filters.city);
  if (selection.operation !== 'ALL') params.set('offering', selection.operation);
  if (filters.type) params.set('category', filters.type.toLocaleLowerCase('es-MX'));
  if (filters.budget !== undefined) params.set('budget', String(filters.budget));
  if (filters.minBudget !== undefined) params.set('minBudget', String(filters.minBudget));
  const query = params.toString();
  return query ? `/explore?${query}` : '/explore';
};

export const searchHomeMiniInventory = (
  properties: Property[],
  selection: HomeMiniSearchSelection,
): Property[] => {
  const publicProperties = properties.filter(isPublicInventoryProperty);
  const filters = buildHomeMiniSearchFilters(selection);
  const filtered = searchProperties(publicProperties, filters);

  if (selection.operation !== 'SWAP') return filtered;
  return filtered.filter((property) => (
    (property.offerings || []).some((offering) => (
      offering.status === 'ACTIVE'
      && offering.visibility === 'PUBLIC'
      && offering.mode === 'SWAP'
    ))
  ));
};

export const findHomeMiniBudgetSelection = (
  operation: OperationMode,
  budget: number | undefined,
): string => {
  if (!budget || budget <= 0) return '';
  const options = getHomeMiniBudgetOptions(operation).filter((option) => option.value);
  return options.find((option) => Number(option.value) >= budget)?.value
    || options.at(-1)?.value
    || '';
};

export const normalizeHomeMiniPropertyType = (value: string | undefined): string => {
  const normalized = (value || '')
    .toLocaleLowerCase('es-MX')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (!normalized) return 'All';
  if (['casa', 'casas', 'house', 'villa'].includes(normalized)) return 'Casas';
  if (['departamento', 'departamentos', 'apartamento', 'apartment', 'depa'].includes(normalized)) return 'Departamentos';
  if (['loft', 'lofts'].includes(normalized)) return 'Lofts';
  if (['terreno', 'terrenos', 'land'].includes(normalized)) return 'Terrenos';
  if (['local', 'locales', 'local comercial'].includes(normalized)) return 'Locales';
  if (['oficina', 'oficinas', 'office'].includes(normalized)) return 'Oficinas';
  return 'All';
};

export const normalizeHomeMiniOperation = (
  value: 'sale' | 'rent' | 'swap' | undefined,
): OperationMode => {
  if (value === 'sale') return 'SALE';
  if (value === 'rent') return 'RENT';
  if (value === 'swap') return 'SWAP';
  return 'SALE';
};
