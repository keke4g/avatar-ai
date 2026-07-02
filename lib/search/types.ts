import { Property } from '../types';

export type SearchSort = "best_match" | "price_asc" | "price_desc" | "newest" | "featured";

export interface PropertySearchFilters {
  city?: string;
  type?: string;
  operation?: 'sale' | 'rent';
  budget?: number;
  rooms?: number;
  sort?: SearchSort;
  amenityCategories?: string[];
  viewTypeId?: string;
  constructionAgeMin?: number;
  constructionAgeMax?: number;
}

export interface SearchResult {
  results: Property[];
  total: number;
  filters: PropertySearchFilters;
  provider: string;
  executionTime: number;
}

export interface SearchSession {
  id: string;
  origin: "eterna" | "explore" | "manual";
  filters: PropertySearchFilters;
  results: Property[];
  provider: string;
  createdAt: number;
}

export interface ProviderCapabilities {
  supportsRealtime: boolean;
  supportsGeo: boolean;
  supportsFuzzy: boolean;
  supportsRecommendations: boolean;
}
