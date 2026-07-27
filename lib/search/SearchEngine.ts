import { Property } from '../types';
import { PropertySearchFilters, SearchSort } from './types';
import { findPropertyByReference, PROPERTY_TYPE_MAPPING } from '../searchFilters';

export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function searchProperties(properties: Property[], filters: PropertySearchFilters): Property[] {
  const referenceMatch = filters.city
    ? findPropertyByReference(properties, filters.city)
    : undefined;

  if (referenceMatch) {
    return [referenceMatch];
  }

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

    if (filters.minBudget !== undefined && filters.minBudget > 0) {
      const price = activeOffering?.priceAmount ?? (prop as any).price ?? 0;
      if (price > 0) {
        if (price >= filters.minBudget) {
          score += 2;
        } else {
          isExcluded = true; // Exclude if below minBudget
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
  
  let clean = value.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/,/g, '')
    .trim();

  // Handle special fractional expressions first
  if (clean.includes('medio millon') || clean.includes('medio m')) {
    return 500000;
  }
  if (clean.includes('3 cuartos de millon') || clean.includes('tres cuartos de millon') || clean.includes('tres cuartos de millon')) {
    return 750000;
  }
  if (clean.includes('un cuarto de millon')) {
    return 250000;
  }

  // Replace text representations of numbers at the beginning
  const textNums = {
    'un ': '1 ',
    'uno ': '1 ',
    'dos ': '2 ',
    'tres ': '3 ',
    'cuatro ': '4 ',
    'cinco ': '5 ',
    'seis ': '6 ',
    'siete ': '7 ',
    'ocho ': '8 ',
    'nueve ': '9 ',
    'diez ': '10 '
  };
  Object.keys(textNums).forEach(word => {
    if (clean.startsWith(word)) {
      clean = clean.replace(word, textNums[word]);
    }
  });
  if (clean === 'un' || clean === 'uno' || clean === 'un millon' || clean === 'un millones') {
    clean = clean.replace('un', '1');
  }

  // Translate written hundreds/thousands
  const textHundreds = {
    'quinientos mil': '500 mil',
    'quinientos': '500',
    'trescientos mil': '300 mil',
    'trescientos': '300',
    'doscientos mil': '200 mil',
    'doscientos': '200',
    'cuatrocientos mil': '400 mil',
    'cuatrocientos': '400',
    'ochocientos mil': '800 mil',
    'ochocientos': '800',
  };
  Object.keys(textHundreds).forEach(word => {
    clean = clean.replace(new RegExp(word, 'g'), textHundreds[word]);
  });

  // Check for expressions like "millon y medio" / "un millon y medio"
  if (clean.startsWith('millon y medio') || clean.startsWith('1 millon y medio') || clean.startsWith('un millon y medio') || clean === '1 y medio' || clean === 'un y medio') {
    return 1500000;
  }

  // Match: X millones Y mil
  const millionRegex = /(\d+(?:\.\d+)?)\s*(?:millones|millon|m|mdp)\s*(?:(?:y|de)\s*)?(\d+)?\s*(mil|k)?/i;
  const matchMillion = clean.match(millionRegex);
  if (matchMillion) {
    const baseMillions = parseFloat(matchMillion[1]);
    let total = baseMillions * 1000000;
    
    if (matchMillion[2]) {
      let rest = parseFloat(matchMillion[2]);
      const hasMilSuffix = !!matchMillion[3];
      if (!hasMilSuffix && rest < 1000) {
        rest *= 1000; // 300 -> 300,000
      }
      total += rest * (hasMilSuffix ? 1000 : 1);
    } else if (clean.includes('y medio') || clean.includes('y media')) {
      total += 500000;
    }
    return total;
  }

  // Handle "850 mil" or "850k" or "850000"
  const thousandsRegex = /(\d+(?:\.\d+)?)\s*(?:mil|k|thousand)/i;
  const matchThousands = clean.match(thousandsRegex);
  if (matchThousands) {
    return parseFloat(matchThousands[1]) * 1000;
  }

  // Match raw number
  const rawNumberRegex = /(\d+(?:\.\d+)?)/;
  const matchRaw = clean.match(rawNumberRegex);
  if (matchRaw) {
    let val = parseFloat(matchRaw[0]);
    if (val < 100) {
      val *= 1000000; // Assume millions
    }
    return val;
  }

  return 0;
}

export function parseBudgetRange(value: string): { min?: number, max?: number } {
  if (!value) return {};
  
  const clean = value.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .trim();

  // 1. Matches "entre X y Y", "de X a Y", "X a Y"
  const rangeRegex = /(?:entre|de)\s+([^y\s]+(?:\s+[^y\s]+)*)\s+(?:y|a)\s+([^]+)/i;
  const matchRange = clean.match(rangeRegex);
  if (matchRange) {
    const minVal = parseBudgetToNumber(matchRange[1]);
    const maxVal = parseBudgetToNumber(matchRange[2]);
    return { min: minVal, max: maxVal };
  }

  // 2. Matches "menos de X", "hasta X", "maximo X", "bajo X"
  if (clean.includes('menos de') || clean.includes('hasta') || clean.includes('maximo') || clean.includes('bajo')) {
    const maxVal = parseBudgetToNumber(clean);
    return { max: maxVal };
  }

  // 3. Matches "mas de X", "desde X", "minimo X", "sobre X"
  if (clean.includes('mas de') || clean.includes('desde') || clean.includes('minimo') || clean.includes('sobre')) {
    const minVal = parseBudgetToNumber(clean);
    return { min: minVal };
  }

  // Default: treat as max budget
  return { max: parseBudgetToNumber(clean) };
}
