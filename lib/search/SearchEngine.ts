import { Property } from '../types';
import { PropertySearchFilters, SearchSort } from './types';
import { PROPERTY_TYPE_MAPPING } from '../searchFilters';

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function searchProperties(properties: Property[], filters: PropertySearchFilters): Property[] {
  const results = properties.map(prop => {
    let score = 0;
    let isExcluded = false;

    // 1. City / Location Filter (case-insensitive NFD normalized)
    if (filters.city) {
      const cleanFilterCity = normalizeSearchText(filters.city);
      const cleanPropLocation = normalizeSearchText(prop.location || '');
      const cleanPropCity = normalizeSearchText(prop.city || '');
      
      const isCityMatch = 
        (cleanPropLocation && cleanPropLocation.includes(cleanFilterCity)) || 
        (cleanPropCity && cleanPropCity.includes(cleanFilterCity)) || 
        (cleanPropCity && cleanFilterCity.includes(cleanPropCity)) ||
        (cleanPropLocation && cleanFilterCity.includes(cleanPropLocation));

      if (isCityMatch) {
        score += 10;
      } else {
        isExcluded = true;
      }
    }

    // 2. Type Filter
    if (filters.type) {
      const allowedTypes = PROPERTY_TYPE_MAPPING[filters.type] || [filters.type];
      const matchesType = allowedTypes.includes(normalizeSearchText(prop.type || ''));

      if (matchesType) {
        score += 5;
      } else {
        isExcluded = true;
      }
    }

    // 3. Operation Filter (sale -> offering SALE, rent -> offering MONTHLY_RENT / SHORT_RENT)
    let activeOffering = (prop.offerings || []).find(o => o.status === 'ACTIVE');
    if (filters.operation) {
      const hasSaleOffering = (prop.offerings || []).some(o => o.mode === 'SALE' && o.status === 'ACTIVE');
      const hasRentOffering = (prop.offerings || []).some(o => (o.mode === 'MONTHLY_RENT' || o.mode === 'SHORT_RENT') && o.status === 'ACTIVE');
      
      const matchesOperation = (filters.operation === 'sale' && hasSaleOffering) ||
                               (filters.operation === 'rent' && hasRentOffering);

      if (matchesOperation) {
        score += 5;
        // set active offering for budget matching
        activeOffering = (prop.offerings || []).find(o => 
          o.status === 'ACTIVE' && 
          ((filters.operation === 'sale' && o.mode === 'SALE') || 
           (filters.operation === 'rent' && (o.mode === 'MONTHLY_RENT' || o.mode === 'SHORT_RENT')))
        );
      } else {
        isExcluded = true;
      }
    }

    // 4. Rooms / Bedrooms Filter
    if (filters.rooms !== undefined && filters.rooms > 0) {
      if (prop.bedrooms >= filters.rooms) {
        score += 3;
        if (prop.bedrooms === filters.rooms) {
          score += 2; // Exact match bonus
        }
      } else {
        score -= 3; // Penalty for fewer rooms
        isExcluded = true; // Strict exclusion for fewer rooms
      }
    }

    // 5. Budget / Price Filter
    if (filters.budget !== undefined && filters.budget > 0) {
      const price = activeOffering?.priceAmount ?? (prop as any).price ?? 0;
      if (price > 0) {
        if (price <= filters.budget) {
          score += 5;
          // Scale bonus: closer to budget is better
          const ratio = price / filters.budget;
          score += Math.round(ratio * 3);
        } else if (price <= filters.budget * 1.25) {
          // Within 25% margin
          score += 1;
        } else {
          score -= 10; // Penalty
          isExcluded = true; // Exclude if exceeds 25% margin
        }
      }
    }
    // 6. Amenities Filter
    if (filters.amenityCategories && filters.amenityCategories.length > 0) {
      const propAmenities = prop.amenities || [];
      const hasAll = filters.amenityCategories.every(a => 
        propAmenities.some(pa => pa.toLowerCase() === a.toLowerCase())
      );
      if (hasAll) {
        score += 3;
      } else {
        isExcluded = true;
      }
    }

    // 7. View Type Filter
    if (filters.viewTypeId) {
      const pView = prop.viewTypeId || (prop as any).viewType || '';
      if (pView.toLowerCase() === filters.viewTypeId.toLowerCase()) {
        score += 3;
      } else {
        isExcluded = true;
      }
    }

    // 8. Construction Age Filter
    if (filters.constructionAgeMin !== undefined && filters.constructionAgeMin !== null) {
      const age = prop.constructionAge || 0;
      if (age < filters.constructionAgeMin) {
        isExcluded = true;
      }
    }
    if (filters.constructionAgeMax !== undefined && filters.constructionAgeMax !== null) {
      const age = prop.constructionAge || 0;
      if (age > filters.constructionAgeMax) {
        isExcluded = true;
      }
    }

    return { prop, score, isExcluded };
  });

  // Filter candidates
  const candidates = results.filter(r => !r.isExcluded && r.score >= 0);

  // Apply sorting options
  const sort: SearchSort = filters.sort || 'best_match';

  if (sort === 'price_asc') {
    candidates.sort((a, b) => {
      const priceA = (a.prop.offerings || []).find(o => o.status === 'ACTIVE')?.priceAmount ?? (a.prop as any).price ?? 0;
      const priceB = (b.prop.offerings || []).find(o => o.status === 'ACTIVE')?.priceAmount ?? (b.prop as any).price ?? 0;
      return priceA - priceB;
    });
  } else if (sort === 'price_desc') {
    candidates.sort((a, b) => {
      const priceA = (a.prop.offerings || []).find(o => o.status === 'ACTIVE')?.priceAmount ?? (a.prop as any).price ?? 0;
      const priceB = (b.prop.offerings || []).find(o => o.status === 'ACTIVE')?.priceAmount ?? (b.prop as any).price ?? 0;
      return priceB - priceA;
    });
  } else if (sort === 'newest') {
    candidates.sort((a, b) => {
      const dateA = a.prop.availableStart || '';
      const dateB = b.prop.availableStart || '';
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      return b.prop.id.localeCompare(a.prop.id);
    });
  } else if (sort === 'featured') {
    candidates.sort((a, b) => {
      const featA = a.prop.offerings?.some(o => o.isFeatured) || (a.prop as any).isFeatured ? 1 : 0;
      const featB = b.prop.offerings?.some(o => o.isFeatured) || (b.prop as any).isFeatured ? 1 : 0;
      return featB - featA;
    });
  } else {
    // best_match (score descending)
    candidates.sort((a, b) => b.score - a.score);
  }

  return candidates.map(r => r.prop);
}

export function parseBudgetToNumber(value: string, operation?: 'sale' | 'rent'): number {
  if (!value) return 0;
  
  // Remove commas
  const clean = value.toLowerCase().replace(/,/g, '');
  
  // Extract all numbers (including decimals)
  const matches = clean.match(/[\d\.]+/);
  if (!matches) return 0;
  
  let num = parseFloat(matches[0]);
  if (isNaN(num)) return 0;
  
  // Apply multipliers
  if (clean.includes('million') || clean.includes('millón') || clean.includes('millon') || clean.includes('millones')) {
    num *= 1000000;
  } else if (clean.includes('k') || clean.includes('mil') || clean.includes('thousand')) {
    num *= 1000;
  }
  
  return num;
}
