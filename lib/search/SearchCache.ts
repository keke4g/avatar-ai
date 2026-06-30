import { PropertySearchFilters, SearchResult } from './types';

export function getCacheKey(filters: PropertySearchFilters): string {
  const cleanFilters: any = {};
  Object.keys(filters).sort().forEach(key => {
    const val = (filters as any)[key];
    if (val !== undefined && val !== null) {
      cleanFilters[key] = val;
    }
  });
  return JSON.stringify(cleanFilters);
}

export class SearchCache {
  private store = new Map<string, SearchResult>();

  get(filters: PropertySearchFilters): SearchResult | null {
    const key = getCacheKey(filters);
    return this.store.get(key) || null;
  }

  set(filters: PropertySearchFilters, result: SearchResult): void {
    const key = getCacheKey(filters);
    this.store.set(key, result);
  }

  clear(): void {
    this.store.clear();
  }

  invalidate(filters: PropertySearchFilters): void {
    const key = getCacheKey(filters);
    this.store.delete(key);
  }
}

export const searchCache = new SearchCache();
