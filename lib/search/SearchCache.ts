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
  private static readonly MAX_ENTRIES = 50;
  private static readonly TTL_MS = 30_000;

  private store = new Map<string, { result: SearchResult; expiresAt: number }>();

  get(filters: PropertySearchFilters): SearchResult | null {
    const key = getCacheKey(filters);
    const cached = this.store.get(key);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    // Refresh insertion order so the bounded map behaves as an LRU cache.
    this.store.delete(key);
    this.store.set(key, cached);
    return cached.result;
  }

  set(filters: PropertySearchFilters, result: SearchResult): void {
    const key = getCacheKey(filters);
    this.store.delete(key);
    this.store.set(key, {
      result,
      expiresAt: Date.now() + SearchCache.TTL_MS,
    });

    while (this.store.size > SearchCache.MAX_ENTRIES) {
      const oldestKey = this.store.keys().next().value as string | undefined;
      if (!oldestKey) break;
      this.store.delete(oldestKey);
    }
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
