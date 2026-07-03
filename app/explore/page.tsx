"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import React, { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useSwap } from '../../lib/context/SwapContext';
import { useTranslation } from '../../lib/context/LanguageContext';
import CategorySlider from '../../components/CategorySlider';
import PropertyCard from '../../components/PropertyCard';
import InteractiveMap from '../../components/InteractiveMap';
import { Map, List, RefreshCw, Compass, ArrowUpDown, Filter, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import { buildExploreSearchParams, filterAndSortProperties, resolveSearchDestination, PROPERTY_TYPE_MAPPING, normalizeSearchText } from '../../lib/searchFilters';
import { CalendarPicker } from '../../components/CalendarPicker';
import { AuraSearchBar } from '../../components/search/AuraSearchBar';
import { GuestPicker } from '../../components/search/GuestPicker';
import { FloatingPosition, getSmartFloatingPosition } from '../../lib/floatingPosition';
import { Property } from '../../lib/types';
import { getActiveOfferings, getOfferingsByMode } from '../../lib/propertyOfferings';
import { useLiveContext } from '../../lib/context/LiveContext';
import { ServiceFactory } from '../../lib/services/ServiceFactory';
import { PropertySearchFilters, SearchSort } from '../../lib/search/types';
import { searchLogger } from '../../lib/search/searchLogger';
import { getCacheKey } from '../../lib/search/SearchCache';

type ExploreOfferingTab = 'ALL' | 'SWAP' | 'RENT' | 'SALE';

const EXPLORE_OFFERING_TABS: Array<{
  id: ExploreOfferingTab;
  label: { es: string; en: string };
}> = [
  { id: 'ALL', label: { es: 'Todo', en: 'All' } },
  { id: 'SALE', label: { es: 'Venta', en: 'Sale' } },
  { id: 'RENT', label: { es: 'Renta', en: 'Rent' } },
  { id: 'SWAP', label: { es: 'Intercambio', en: 'Swap' } },
];

function propertyMatchesOfferingTab(property: Property, tab: ExploreOfferingTab): boolean {
  if (tab === 'ALL') {
    return getActiveOfferings(property).length > 0;
  }

  if (tab === 'RENT') {
    return (
      getOfferingsByMode(property, 'SHORT_RENT', { activeOnly: true }).length > 0 ||
      getOfferingsByMode(property, 'MONTHLY_RENT', { activeOnly: true }).length > 0
    );
  }

  return getOfferingsByMode(property, tab, { activeOnly: true }).length > 0;
}

function ExploreContent() {
  const { properties, swaps, activeSearch, setActiveSearch } = useSwap();
  const { t, language } = useTranslation();
  const router = useRouter();
  const { setExploreFilters } = useLiveContext();
  
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchBudget, setSearchBudget] = useState('');
  const [activeOfferingTab, setActiveOfferingTab] = useState<ExploreOfferingTab>('ALL');
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  
  // View states: 'split' on desktop by default; can toggle between grid/map on mobile
  const [mobileShowMap, setMobileShowMap] = useState(false);
  
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [hasFilteredGuests, setHasFilteredGuests] = useState(false);
  const [tempAdults, setTempAdults] = useState(1);
  const [tempChildren, setTempChildren] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const desktopDateButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileDateButtonRef = useRef<HTMLButtonElement | null>(null);
  const desktopGuestButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileGuestButtonRef = useRef<HTMLButtonElement | null>(null);
  const guestPickerRef = useRef<HTMLDivElement | null>(null);
  const [pickerPosition, setPickerPosition] = useState<FloatingPosition | null>(null);
  const [guestPickerPosition, setGuestPickerPosition] = useState<FloatingPosition | null>(null);
  const [selectedSwapType, setSelectedSwapType] = useState('All'); // Swap Tiers: Premium, Luxury, Exclusive, Curated
  const [selectedViewType, setSelectedViewType] = useState('All');
  const [selectedAgeRange, setSelectedAgeRange] = useState('All');
  const [selectedAmenityCategory, setSelectedAmenityCategory] = useState('All');
  const [sortBy, setSortBy] = useState('match'); // 'match' | 'capacity' | 'rating'
  const selectedDates = startDate && endDate ? { start: startDate, end: endDate } : null;
  const guestsCount = hasFilteredGuests ? adults + children : 0;
  
  // Progressive loading / pagination states
  const [pageSize, setPageSize] = useState(4); // Load 4 at a time
  const [isFiltering, setIsFiltering] = useState(false);

  // Search infrastructure refs (debouncing and race protection)
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRequestIdRef = useRef(0);
  const prevImmediateFiltersRef = useRef({ activeCategory, activeOfferingTab, sortBy, selectedSwapType });
  const lastSearchedFiltersKeyRef = useRef<string>('');

  // Sync with URL query parameter (BUG #7 & availability/capacity integration)
  const searchParams = useSearchParams();
  useEffect(() => {
    const q = searchParams.get('search');
    const startVal = searchParams.get('start');
    const endVal = searchParams.get('end');
    const guestsVal = searchParams.get('guests');
    const categoryVal = searchParams.get('category');
    const offeringVal = searchParams.get('offering');
    const tierVal = searchParams.get('tier');
    const budgetVal = searchParams.get('budget');
    const roomsVal = searchParams.get('rooms');
    
    setSearchQuery(q || '');
    setSearchBudget(budgetVal || '');
    setStartDate(startVal || '');
    setEndDate(endVal || '');
    if (guestsVal) {
      const g = parseInt(guestsVal);
      if (!isNaN(g) && g > 0) {
        setAdults(g);
        setChildren(0);
        setTempAdults(g);
        setTempChildren(0);
        setHasFilteredGuests(true);
      }
    } else {
      setAdults(1);
      setChildren(0);
      setTempAdults(1);
      setTempChildren(0);
      setHasFilteredGuests(false);
    }

    if (categoryVal) {
      const normalizedCategory = categoryVal.toLowerCase();
      const matchedCategory = ['casas', 'departamentos', 'lofts', 'terrenos', 'locales', 'oficinas'].find(
        c => c.toLowerCase() === normalizedCategory
      );
      if (matchedCategory) {
        const properCased: Record<string, string> = {
          'casas': 'Casas',
          'departamentos': 'Departamentos',
          'lofts': 'Lofts',
          'terrenos': 'Terrenos',
          'locales': 'Locales',
          'oficinas': 'Oficinas'
        };
        setActiveCategory(properCased[matchedCategory] || 'All');
      } else {
        setActiveCategory('All');
      }
    } else {
      setActiveCategory('All');
    }

    if (offeringVal) {
      const normalizedOffering = offeringVal.toUpperCase();
      if (normalizedOffering === 'SWAP') {
        setActiveOfferingTab('SWAP');
      } else if (['SHORT_RENT', 'MONTHLY_RENT', 'RENT'].includes(normalizedOffering)) {
        setActiveOfferingTab('RENT');
      } else if (normalizedOffering === 'SALE') {
        setActiveOfferingTab('SALE');
      } else {
        setActiveOfferingTab('ALL');
      }
    } else {
      setActiveOfferingTab('ALL');
    }

    if (tierVal) {
      const normalizedTier = tierVal.toLowerCase();
      const matchedTier = ['premium', 'luxury', 'exclusive', 'curated'].find(
        t => t.toLowerCase() === normalizedTier
      );
      if (matchedTier) {
        const properCasedTier: Record<string, string> = {
          'premium': 'Premium',
          'luxury': 'Luxury',
          'exclusive': 'Exclusive',
          'curated': 'Curated'
        };
        setSelectedSwapType(properCasedTier[matchedTier] || 'All');
      } else {
        setSelectedSwapType('All');
      }
    } else {
      setSelectedSwapType('All');
    }

    const amenityVal = searchParams.get('amenity');
    if (amenityVal) {
      setSelectedAmenityCategory(amenityVal);
    } else {
      setSelectedAmenityCategory('All');
    }

    const viewVal = searchParams.get('view');
    if (viewVal) {
      setSelectedViewType(viewVal);
    } else {
      setSelectedViewType('All');
    }

    const ageVal = searchParams.get('age');
    if (ageVal) {
      setSelectedAgeRange(ageVal);
    } else {
      setSelectedAgeRange('All');
    }
    
    if (q || startVal || endVal || guestsVal || categoryVal || offeringVal || tierVal || budgetVal || roomsVal || amenityVal || viewVal || ageVal) {
      setPageSize(12); // Show more results if filtered
    }
  }, [searchParams]);

  // Load and synchronize activeSearch from URL query parameters (e.g. on direct navigation or refresh)
  useEffect(() => {
    // If activeSearch is already set, let the central filter watcher (useEffect 2)
    // handle any updates to prevent competing search calls and infinite loops.
    if (activeSearch) return;

    const city = searchParams.get('search') || '';
    const offeringVal = searchParams.get('offering') || '';
    const budgetVal = searchParams.get('budget');
    const minBudgetVal = searchParams.get('minBudget');
    const roomsVal = searchParams.get('rooms');
    const categoryVal = searchParams.get('category');
    const amenityVal = searchParams.get('amenity');
    const viewVal = searchParams.get('view');
    const ageVal = searchParams.get('age');

    if (city || budgetVal || minBudgetVal || roomsVal || categoryVal || amenityVal || viewVal || ageVal) {
      const operation: 'sale' | 'rent' = offeringVal.toUpperCase() === 'SALE' ? 'sale' : 'rent';
      const parsedBudget = budgetVal ? parseFloat(budgetVal) : undefined;
      const parsedMinBudget = minBudgetVal ? parseFloat(minBudgetVal) : undefined;
      const parsedRooms = roomsVal ? parseInt(roomsVal) : undefined;

      let matchedCategory = undefined;
      if (categoryVal) {
        const properCased = {
          'casas': 'Casas',
          'departamentos': 'Departamentos',
          'lofts': 'Lofts',
          'terrenos': 'Terrenos',
          'locales': 'Locales',
          'oficinas': 'Oficinas'
        };
        matchedCategory = properCased[categoryVal.toLowerCase()];
      }

      let ageMin = undefined;
      let ageMax = undefined;
      if (ageVal === '0-2') {
        ageMin = 0; ageMax = 2;
      } else if (ageVal === '3-5') {
        ageMin = 3; ageMax = 5;
      } else if (ageVal === '6-10') {
        ageMin = 6; ageMax = 10;
      } else if (ageVal === '10+') {
        ageMin = 10;
      }

      const filters: PropertySearchFilters = {
        city: city || undefined,
        operation: operation,
        type: matchedCategory,
        budget: parsedBudget,
        minBudget: parsedMinBudget,
        rooms: parsedRooms,
        sort: 'best_match',
        amenityCategories: amenityVal ? [amenityVal] : undefined,
        viewTypeId: viewVal || undefined,
        constructionAgeMin: ageMin,
        constructionAgeMax: ageMax,
      };

      const sessionId = `ss-${Date.now()}`;
      const sessionStart = Date.now();
      const providerName = ServiceFactory.getPropertyService().getCapabilities().supportsRealtime ? 'supabase' : 'mock';

      setActiveSearch({
        id: sessionId,
        origin: "manual",
        filters,
        results: [],
        provider: providerName,
        createdAt: sessionStart,
        loading: true,
        error: null
      });

      // Clear the last searched filter key ref so useEffect 2 is guaranteed to perform the search
      lastSearchedFiltersKeyRef.current = '';
    }
  }, [searchParams, activeSearch, setActiveSearch]);

  // Central filter watcher when activeSearch is present
  useEffect(() => {
    if (!activeSearch) {
      lastSearchedFiltersKeyRef.current = '';
      return;
    }

    const type = activeCategory !== 'All' ? activeCategory : undefined;

    const operation = activeOfferingTab === 'SALE' ? 'sale' : activeOfferingTab === 'RENT' ? 'rent' : undefined;
    const budget = (activeOfferingTab !== 'SWAP' && activeOfferingTab !== 'ALL' && searchBudget) ? parseFloat(searchBudget) : undefined;

    let ageMin: number | undefined;
    let ageMax: number | undefined;
    if (selectedAgeRange === '0-2') {
      ageMin = 0; ageMax = 2;
    } else if (selectedAgeRange === '3-5') {
      ageMin = 3; ageMax = 5;
    } else if (selectedAgeRange === '6-10') {
      ageMin = 6; ageMax = 10;
    } else if (selectedAgeRange === '10+') {
      ageMin = 10;
    }

    const minBudget = activeSearch?.filters?.minBudget || (searchParams.get('minBudget') ? parseFloat(searchParams.get('minBudget')!) : undefined);

    const currentFilters: PropertySearchFilters = {
      city: searchQuery.trim() || undefined,
      operation,
      type,
      budget,
      minBudget,
      rooms: searchParams.get('rooms') ? parseInt(searchParams.get('rooms')!) : undefined,
      sort: (sortBy === 'capacity' ? 'featured' : sortBy === 'rating' ? 'featured' : 'best_match') as SearchSort,
      amenityCategories: selectedAmenityCategory !== 'All' ? [selectedAmenityCategory] : undefined,
      viewTypeId: selectedViewType !== 'All' ? selectedViewType : undefined,
      constructionAgeMin: ageMin,
      constructionAgeMax: ageMax,
    };

    const filtersKey = getCacheKey(currentFilters);
    
    // If activeSearch already has the finished results matching currentFilters,
    // mark the cache key as searched and return to avoid duplicate loading/fetch.
    if (activeSearch && !activeSearch.loading && getCacheKey(activeSearch.filters) === filtersKey) {
      lastSearchedFiltersKeyRef.current = filtersKey;
      return;
    }

    if (lastSearchedFiltersKeyRef.current === filtersKey) {
      return;
    }

    // Check if immediate filters changed
    const immediateChanged = 
      prevImmediateFiltersRef.current.activeCategory !== activeCategory ||
      prevImmediateFiltersRef.current.activeOfferingTab !== activeOfferingTab ||
      prevImmediateFiltersRef.current.sortBy !== sortBy ||
      prevImmediateFiltersRef.current.selectedSwapType !== selectedSwapType ||
      (prevImmediateFiltersRef.current as any).selectedViewType !== selectedViewType ||
      (prevImmediateFiltersRef.current as any).selectedAgeRange !== selectedAgeRange ||
      (prevImmediateFiltersRef.current as any).selectedAmenityCategory !== selectedAmenityCategory;

    prevImmediateFiltersRef.current = { 
      activeCategory, 
      activeOfferingTab, 
      sortBy, 
      selectedSwapType,
      selectedViewType,
      selectedAgeRange,
      selectedAmenityCategory
    } as any;

    const executeSearch = () => {
      const requestId = ++lastRequestIdRef.current;
      lastSearchedFiltersKeyRef.current = filtersKey;

      setActiveSearch(prev => prev ? {
        ...prev,
        filters: currentFilters,
        loading: true,
        error: null
      } : null);

      ServiceFactory.getPropertyService().search(currentFilters)
        .then((searchResult) => {
          if (requestId !== lastRequestIdRef.current) {
            searchLogger.info('[EXPLORE] Ignoring stale search results for request:', requestId);
            return;
          }
          setActiveSearch(prev => prev ? {
            ...prev,
            filters: searchResult.filters,
            results: searchResult.results,
            provider: searchResult.provider,
            loading: false,
            error: null
          } : null);
        })
        .catch((err) => {
          if (requestId !== lastRequestIdRef.current) return;
          searchLogger.error('[EXPLORE] Error performing search:', err);
          setActiveSearch(prev => prev ? {
            ...prev,
            filters: currentFilters,
            loading: false,
            error: err.message || 'Error searching properties'
          } : null);
        });
    };

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    if (immediateChanged) {
      executeSearch();
    } else {
      debounceTimeoutRef.current = setTimeout(() => {
        executeSearch();
      }, 300);
    }

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [
    activeCategory,
    activeOfferingTab,
    sortBy,
    selectedSwapType,
    selectedViewType,
    selectedAgeRange,
    selectedAmenityCategory,
    searchQuery,
    startDate,
    endDate,
    guestsCount,
    activeSearch,
    searchParams,
    setActiveSearch
  ]);

  // Sync active filters to LiveContext
  useEffect(() => {
    setExploreFilters({
      category: activeCategory,
      offeringTab: activeOfferingTab,
      query: searchQuery,
      guests: guestsCount,
      swapType: selectedSwapType,
      sortBy: sortBy,
    });
  }, [activeCategory, activeOfferingTab, searchQuery, guestsCount, selectedSwapType, sortBy, setExploreFilters]);

  // Clear all filters
  const handleClearFilters = () => {
    setActiveCategory('All');
    setActiveOfferingTab('ALL');
    setSearchQuery('');
    setStartDate('');
    setEndDate('');
    setAdults(1);
    setChildren(0);
    setTempAdults(1);
    setTempChildren(0);
    setHasFilteredGuests(false);
    setSelectedSwapType('All');
    setSelectedViewType('All');
    setSelectedAgeRange('All');
    setSelectedAmenityCategory('All');
    setSortBy('match');
    setSearchBudget('');
    setPageSize(4);
    
    if (activeSearch) {
      setActiveSearch(prev => prev ? {
        ...prev,
        filters: {},
        results: properties,
        loading: false,
        error: null
      } : null);
    } else {
      setActiveSearch(null);
    }
    router.push('/explore');
  };

  const handleExploreSearch = () => {
    const resolvedDestination = searchQuery.trim()
      ? resolveSearchDestination(searchQuery.trim(), properties)
      : '';
    const params = buildExploreSearchParams({
      searchQuery: resolvedDestination,
      selectedDates,
      guestsCount,
    });
    if (activeCategory !== 'All') {
      params.set('category', activeCategory);
    }
    if (activeOfferingTab !== 'ALL') {
      params.set('offering', activeOfferingTab);
    }
    if (selectedSwapType !== 'All') {
      params.set('tier', selectedSwapType);
    }
    if (activeOfferingTab !== 'SWAP' && activeOfferingTab !== 'ALL' && searchBudget) {
      params.set('budget', searchBudget);
    }
    setPageSize(params.toString() ? 12 : 4);
    
    const sessionId = `ss-${Date.now()}`;
    const sessionStart = Date.now();
    const providerName = ServiceFactory.getPropertyService().getCapabilities().supportsRealtime ? 'supabase' : 'mock';

    const operation = activeOfferingTab === 'SALE' ? 'sale' : activeOfferingTab === 'RENT' ? 'rent' : undefined;
    const type = activeCategory !== 'All' ? activeCategory : undefined;
    const budget = (activeOfferingTab !== 'SWAP' && activeOfferingTab !== 'ALL' && searchBudget) ? parseFloat(searchBudget) : undefined;

    const filters: PropertySearchFilters = {
      city: resolvedDestination || undefined,
      operation,
      type,
      budget,
      sort: (sortBy === 'capacity' ? 'featured' : sortBy === 'rating' ? 'featured' : 'best_match') as SearchSort,
    };

    setActiveSearch({
      id: sessionId,
      origin: "manual",
      filters,
      results: [],
      provider: providerName,
      createdAt: sessionStart,
      loading: true,
      error: null
    });
    
    router.push(params.toString() ? `/explore?${params.toString()}` : '/explore');
  };

  useEffect(() => {
    if (!showDatePicker) return;

    const updatePosition = () => {
      const isDesktop = window.innerWidth >= 1024;
      const activeEl = (isDesktop ? desktopDateButtonRef.current : mobileDateButtonRef.current) || desktopDateButtonRef.current || mobileDateButtonRef.current;
      if (activeEl) {
        setPickerPosition(getSmartFloatingPosition(activeEl.getBoundingClientRect(), {
          width: 320,
          height: 472,
          offset: 10,
          preferTop: isDesktop,
        }));
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showDatePicker]);

  useEffect(() => {
    if (!showGuestPicker) return;

    const updatePosition = () => {
      const isDesktop = window.innerWidth >= 1024;
      const activeEl = (isDesktop ? desktopGuestButtonRef.current : mobileGuestButtonRef.current) || desktopGuestButtonRef.current || mobileGuestButtonRef.current;
      if (activeEl) {
        setGuestPickerPosition(getSmartFloatingPosition(activeEl.getBoundingClientRect(), {
          width: 256,
          height: 250,
          offset: 10,
          preferTop: isDesktop,
        }));
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [showGuestPicker]);

  useEffect(() => {
    if (!showGuestPicker) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const isOutsidePicker = guestPickerRef.current && !guestPickerRef.current.contains(e.target as Node);
      const isOutsideDesktopButton = desktopGuestButtonRef.current && !desktopGuestButtonRef.current.contains(e.target as Node);
      const isOutsideMobileButton = mobileGuestButtonRef.current && !mobileGuestButtonRef.current.contains(e.target as Node);

      if (isOutsidePicker && isOutsideDesktopButton && isOutsideMobileButton) {
        setShowGuestPicker(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showGuestPicker]);

  const ageLimits = useMemo(() => {
    let ageMin: number | undefined;
    let ageMax: number | undefined;
    if (selectedAgeRange === '0-2') {
      ageMin = 0; ageMax = 2;
    } else if (selectedAgeRange === '3-5') {
      ageMin = 3; ageMax = 5;
    } else if (selectedAgeRange === '6-10') {
      ageMin = 6; ageMax = 10;
    } else if (selectedAgeRange === '10+') {
      ageMin = 10;
    }
    return { ageMin, ageMax };
  }, [selectedAgeRange]);

  // Calculate base properties matching all other filters EXCEPT category/type filter
  const basePropertiesForCategoryCounts = useMemo(() => {
    if (activeSearch) {
      if (activeSearch.loading) return [];
      return activeSearch.results;
    }
    // But since search results are already filtered by type, we should fetch base properties using filterAndSortProperties
    // which aligns in-memory filtering with database search criteria.
    const base = filterAndSortProperties({
      properties,
      swaps,
      offeringMode: 'ALL',
      activeCategory: 'All', // No category filter
      searchQuery,
      selectedSwapType,
      sortBy,
      startDate,
      endDate,
      guestsCount,
      budget: searchBudget ? parseFloat(searchBudget) : undefined,
      amenityCategories: selectedAmenityCategory !== 'All' ? [selectedAmenityCategory] : undefined,
      viewTypeId: selectedViewType !== 'All' ? selectedViewType : undefined,
      constructionAgeMin: ageLimits.ageMin,
      constructionAgeMax: ageLimits.ageMax,
    });
    return base.filter((property) => propertyMatchesOfferingTab(property, activeOfferingTab));
  }, [properties, swaps, searchQuery, selectedSwapType, sortBy, startDate, endDate, guestsCount, activeOfferingTab, searchBudget, selectedAmenityCategory, selectedViewType, ageLimits, activeSearch]);

  // Compute dynamic category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      All: basePropertiesForCategoryCounts.length
    };

    Object.keys(PROPERTY_TYPE_MAPPING).forEach((catId) => {
      const allowedTypes = PROPERTY_TYPE_MAPPING[catId];
      counts[catId] = basePropertiesForCategoryCounts.filter((p) => {
        const normType = normalizeSearchText(p.type || '');
        return allowedTypes.includes(normType);
      }).length;
    });

    return counts;
  }, [basePropertiesForCategoryCounts]);

  // Filter & Sort properties
  const allModeFilteredProperties = useMemo(() => {
    if (activeSearch) {
      if (activeSearch.loading) return [];
      return activeSearch.results;
    }
    return filterAndSortProperties({
      properties,
      swaps,
      offeringMode: 'ALL',
      activeCategory,
      searchQuery,
      selectedSwapType,
      sortBy,
      startDate,
      endDate,
      guestsCount,
      budget: searchBudget ? parseFloat(searchBudget) : undefined,
      amenityCategories: selectedAmenityCategory !== 'All' ? [selectedAmenityCategory] : undefined,
      viewTypeId: selectedViewType !== 'All' ? selectedViewType : undefined,
      constructionAgeMin: ageLimits.ageMin,
      constructionAgeMax: ageLimits.ageMax,
    });
  }, [properties, swaps, activeCategory, searchQuery, selectedSwapType, sortBy, startDate, endDate, guestsCount, searchBudget, selectedAmenityCategory, selectedViewType, ageLimits, activeSearch]);

  const filteredSortedProperties = useMemo(() => {
    if (activeSearch && activeSearch.loading) {
      return [];
    }
    return allModeFilteredProperties.filter((property) => propertyMatchesOfferingTab(property, activeOfferingTab));
  }, [allModeFilteredProperties, activeOfferingTab, activeSearch]);

  const offeringTabCounts = useMemo(() => {
    return EXPLORE_OFFERING_TABS.reduce<Record<ExploreOfferingTab, number>>((counts, tab) => {
      counts[tab.id] = allModeFilteredProperties.filter((property) => propertyMatchesOfferingTab(property, tab.id)).length;
      return counts;
    }, {
      ALL: 0,
      SWAP: 0,
      RENT: 0,
      SALE: 0,
    });
  }, [allModeFilteredProperties]);

  // Paginated properties for progressive load
  const paginatedProperties = useMemo(() => {
    return filteredSortedProperties.slice(0, pageSize);
  }, [filteredSortedProperties, pageSize]);

  const hasMore = filteredSortedProperties.length > pageSize;

  // Auto-scroll and premium highlight trigger (UX Redirection)
  useEffect(() => {
    const q = searchParams.get('search');
    const startVal = searchParams.get('start');
    const endVal = searchParams.get('end');
    const guestsVal = searchParams.get('guests');
    const hasSearchFilters = !!(q || startVal || endVal || guestsVal);

    if (!hasSearchFilters || filteredSortedProperties.length === 0) return;

    const firstProp = filteredSortedProperties[0];
    if (!firstProp) return;

    // Wait for the render batch and animations to settle
    const timer = setTimeout(() => {
      const cardEl = document.getElementById(`property-card-${firstProp.id}`);
      if (cardEl) {
        // 1. Smooth scroll to target card, centered
        cardEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });

        // 2. Apply premium purple glow & scaling pulse animation
        cardEl.classList.add('property-highlight-active');

        // 3. Clean up class after animation completes (2.2 seconds)
        const cleanupTimer = setTimeout(() => {
          cardEl.classList.remove('property-highlight-active');
        }, 2200);

        return () => clearTimeout(cleanupTimer);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [searchParams, filteredSortedProperties]);

  const handleLoadMore = () => {
    setIsFiltering(true);
    setTimeout(() => {
      setPageSize(prev => prev + 4);
      setIsFiltering(false);
    }, 450); // Elegant micro-latency loader
  };

  return (
    <div className="max-w-7xl mx-auto px-6 sm:px-12 md:px-24 min-h-screen">
      
      {/* A. Dynamic Header & Search bar */}
      <div className="flex flex-col gap-6 mb-8 mt-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-black tracking-tight flex items-center gap-2">
            <span>{t('explore.title')}</span>
            <Sparkles className="w-5 h-5 text-brand-accent animate-pulse" />
          </h1>
          <p className="text-xs text-brand-gray-500 font-medium mt-1">
            {t('explore.subtitle', { count: filteredSortedProperties.length })}
          </p>
        </div>

        <AuraSearchBar
          value={searchQuery}
          onValueChange={(value) => {
            setSearchQuery(value);
            setPageSize(4);
            if (activeSearch) setActiveSearch(null);
          }}
          selectedDates={selectedDates}
          hasFilteredGuests={hasFilteredGuests}
          guestsCount={guestsCount}
          language={language === 'es' ? 'es' : 'en'}
          onSubmit={handleExploreSearch}
          onDateClick={() => { setShowDatePicker(!showDatePicker); setShowGuestPicker(false); }}
          onGuestClick={() => {
            if (!showGuestPicker) { setTempAdults(adults); setTempChildren(children); }
            setShowGuestPicker(!showGuestPicker);
            setShowDatePicker(false);
          }}
          desktopDateButtonRef={desktopDateButtonRef}
          mobileDateButtonRef={mobileDateButtonRef}
          desktopGuestButtonRef={desktopGuestButtonRef}
          mobileGuestButtonRef={mobileGuestButtonRef}
          mobileSubmitLabel="Buscar destinos"
          operation={activeOfferingTab === 'ALL' ? 'SALE' : activeOfferingTab}
          onOperationChange={(op) => {
            setActiveOfferingTab(op);
            setPageSize(4);
            if (activeSearch) setActiveSearch(null);
            
            // Sync URL search params
            if (typeof window !== 'undefined') {
              const params = new URLSearchParams(window.location.search);
              params.set('offering', op);
              if (op === 'SWAP') {
                params.delete('budget');
              } else {
                params.delete('start');
                params.delete('end');
                params.delete('guests');
              }
              router.push(params.toString() ? `/explore?${params.toString()}` : '/explore');
            }
          }}
          propertyType={activeCategory}
          onPropertyTypeChange={(type) => {
            setActiveCategory(type);
            setPageSize(4);
            if (activeSearch) setActiveSearch(null);
            
            // Sync URL search params
            if (typeof window !== 'undefined') {
              const params = new URLSearchParams(window.location.search);
              if (type === 'All') {
                params.delete('category');
              } else {
                params.set('category', type);
              }
              router.push(params.toString() ? `/explore?${params.toString()}` : '/explore');
            }
          }}
          budget={searchBudget}
          onBudgetChange={(b) => {
            setSearchBudget(b);
            setPageSize(4);
            if (activeSearch) setActiveSearch(null);
            
            // Sync URL search params
            if (typeof window !== 'undefined') {
              const params = new URLSearchParams(window.location.search);
              if (!b) {
                params.delete('budget');
              } else {
                params.set('budget', b);
              }
              router.push(params.toString() ? `/explore?${params.toString()}` : '/explore');
            }
          }}
        />

        <div className="flex flex-col gap-4 rounded-3xl border border-brand-gray-200/70 bg-white/80 p-4 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 px-3.5 py-2.5 border border-brand-gray-200 rounded-2xl text-xs font-bold text-brand-gray-600 bg-white">
              <Filter className="w-3.5 h-3.5 text-brand-gray-400" />
              <select
                value={selectedSwapType}
                onChange={(e) => {
                  setSelectedSwapType(e.target.value);
                  setPageSize(4);
                  if (activeSearch) setActiveSearch(null);
                }}
                className="outline-none bg-transparent font-bold cursor-pointer"
              >
                <option value="All">{t('explore.tierSelector')}</option>
                <option value="Premium">Premium</option>
                <option value="Curated">Curated</option>
                <option value="Exclusive">Exclusive</option>
                <option value="Luxury">Luxury</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-3.5 py-2.5 border border-brand-gray-200 rounded-2xl text-xs font-bold text-brand-gray-600 bg-white">
              <Filter className="w-3.5 h-3.5 text-brand-gray-400" />
              <select
                value={selectedViewType}
                onChange={(e) => {
                  setSelectedViewType(e.target.value);
                  setPageSize(4);
                  if (activeSearch) setActiveSearch(null);
                }}
                className="outline-none bg-transparent font-bold cursor-pointer"
              >
                <option value="All">Cualquier Vista</option>
                <option value="Marina">Vista a la Marina</option>
                <option value="Al Mar">Vista al Mar</option>
                <option value="Al Bosque">Vista al Bosque</option>
                <option value="Golf">Vista al Campo de Golf</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-3.5 py-2.5 border border-brand-gray-200 rounded-2xl text-xs font-bold text-brand-gray-600 bg-white">
              <Filter className="w-3.5 h-3.5 text-brand-gray-400" />
              <select
                value={selectedAgeRange}
                onChange={(e) => {
                  setSelectedAgeRange(e.target.value);
                  setPageSize(4);
                  if (activeSearch) setActiveSearch(null);
                }}
                className="outline-none bg-transparent font-bold cursor-pointer"
              >
                <option value="All">Cualquier Antigüedad</option>
                <option value="0-2">Nueva (0-2 años)</option>
                <option value="3-5">3-5 años</option>
                <option value="6-10">6-10 años</option>
                <option value="10+">Más de 10 años</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-3.5 py-2.5 border border-brand-gray-200 rounded-2xl text-xs font-bold text-brand-gray-600 bg-white">
              <Filter className="w-3.5 h-3.5 text-brand-gray-400" />
              <select
                value={selectedAmenityCategory}
                onChange={(e) => {
                  setSelectedAmenityCategory(e.target.value);
                  setPageSize(4);
                  if (activeSearch) setActiveSearch(null);
                }}
                className="outline-none bg-transparent font-bold cursor-pointer"
              >
                <option value="All">Cualquier Amenidad</option>
                <option value="Alberca">Alberca</option>
                <option value="Seguridad 24/7">Seguridad 24/7</option>
                <option value="Gimnasio">Gimnasio</option>
                <option value="Domótica">Domótica</option>
                <option value="Cerradura inteligente">Cerradura inteligente</option>
                <option value="Vista al mar">Vista al mar</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 px-3.5 py-2.5 border border-brand-gray-200 rounded-2xl text-xs font-bold text-brand-gray-600 bg-white">
              <ArrowUpDown className="w-3.5 h-3.5 text-brand-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  if (activeSearch) setActiveSearch(null);
                }}
                className="outline-none bg-transparent font-bold cursor-pointer"
              >
                <option value="match">{t('explore.sortMatch')}</option>
                <option value="capacity">{t('explore.sortGuests')}</option>
                <option value="rating">{t('explore.sortRating')}</option>
              </select>
            </div>

            {(searchQuery || startDate || endDate || hasFilteredGuests || activeCategory !== 'All' || activeOfferingTab !== 'ALL' || selectedSwapType !== 'All' || sortBy !== 'match') && (
              <button
                onClick={handleClearFilters}
                className="px-4 py-2.5 text-xs font-bold text-brand-rose bg-brand-rose/5 rounded-2xl hover:bg-brand-rose/10 transition-colors cursor-pointer animate-in fade-in"
              >
                {t('explore.clearFilters')}
              </button>
            )}
          </div>

          <CategorySlider 
            activeCategory={activeCategory} 
            setActiveCategory={(cat) => {
              setActiveCategory(cat);
              setPageSize(4);
              if (activeSearch) setActiveSearch(null);
              
              // Sync URL search params
              if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                if (cat === 'All') {
                  params.delete('category');
                } else {
                  params.set('category', cat);
                }
                router.push(params.toString() ? `/explore?${params.toString()}` : '/explore');
              }
            }} 
            counts={categoryCounts}
          />

          <div className="border-t border-brand-gray-100 pt-3">
            <div className="flex w-full gap-2 overflow-x-auto pb-1">
              {EXPLORE_OFFERING_TABS.map((tab) => {
                const isActive = activeOfferingTab === tab.id;
                const label = tab.label[language === 'es' ? 'es' : 'en'];
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveOfferingTab(tab.id);
                      setPageSize(4);
                      if (activeSearch) setActiveSearch(null);

                      // Sync URL search params
                      if (typeof window !== 'undefined') {
                        const params = new URLSearchParams(window.location.search);
                        if (tab.id === 'ALL') {
                          params.delete('offering');
                        } else {
                          params.set('offering', tab.id);
                        }
                        
                        // Clear incompatible parameters
                        if (tab.id === 'SWAP') {
                          params.delete('budget');
                        } else if (tab.id === 'SALE' || tab.id === 'RENT') {
                          params.delete('start');
                          params.delete('end');
                          params.delete('guests');
                        }
                        router.push(params.toString() ? `/explore?${params.toString()}` : '/explore');
                      }
                    }}
                    className={`group flex min-w-fit items-center gap-2 rounded-full border px-4 py-2 text-xs font-black transition-all ${
                      isActive
                        ? 'border-brand-black bg-brand-black text-white shadow-sm'
                        : 'border-brand-gray-200 bg-white text-brand-gray-500 hover:border-brand-black hover:text-brand-black'
                    }`}
                  >
                    <span>{label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      isActive
                        ? 'bg-white/15 text-white'
                        : 'bg-brand-gray-100 text-brand-gray-400 group-hover:bg-brand-gray-900 group-hover:text-white'
                    }`}>
                      {offeringTabCounts[tab.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* C. Split Explorer Workspace (Grid + Dynamic Map) */}
      <div className="flex flex-col lg:flex-row gap-8 items-start w-full relative">
        
        {/* Left Side: Property Grid (Lists cards dynamically) */}
        <div className={`flex-1 flex flex-col gap-8 w-full transition-all duration-300 ${
          mobileShowMap ? 'hidden lg:flex' : 'flex'
        }`}>
          {activeSearch?.loading ? (
            <div className="py-20 text-center flex flex-col items-center justify-center bg-white border border-brand-gray-200/50 rounded-3xl shadow-sm">
              <RefreshCw className="w-10 h-10 text-brand-accent mb-3 animate-spin" />
              <h3 className="text-base font-extrabold text-brand-black">{language === 'es' ? 'Buscando propiedades...' : 'Searching properties...'}</h3>
              <p className="text-xs text-brand-gray-500 max-w-xs mt-1.5 leading-relaxed font-semibold">
                {language === 'es' ? 'Eterna está analizando el catálogo de AuraSwap...' : 'Eterna is analyzing the AuraSwap catalog...'}
              </p>
            </div>
          ) : filteredSortedProperties.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center justify-center bg-white border border-brand-gray-200/50 rounded-3xl shadow-sm">
              <Compass className="w-10 h-10 text-brand-gray-300 mb-3 animate-spin [animation-duration:8s]" />
              <h3 className="text-base font-extrabold text-brand-black">{t('explore.noMatchesTitle')}</h3>
              <p className="text-xs text-brand-gray-500 max-w-xs mt-1.5 leading-relaxed font-semibold">
                {t('explore.noMatchesDesc')}
              </p>
              <button
                onClick={handleClearFilters}
                className="mt-6 px-5 py-2.5 bg-brand-black text-white hover:bg-brand-gray-800 rounded-full text-xs font-bold transition-all cursor-pointer"
              >
                {t('explore.resetFiltersBtn')}
              </button>
            </div>
          ) : (
            <>
              {/* Dynamic list grid with micro-interactions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <AnimatePresence mode="popLayout">
                  {paginatedProperties.map((property) => (
                    <motion.div
                      key={property.id}
                      layoutId={`prop-card-${property.id}`}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.35, ease: 'easeOut' }}
                      onMouseEnter={() => setHoveredPropertyId(property.id)}
                      onMouseLeave={() => setHoveredPropertyId(null)}
                    >
                      <PropertyCard property={property} showOfferingBadges />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Progressive loading action */}
              {hasMore && (
                <div className="flex justify-center items-center py-6">
                  <button
                    onClick={handleLoadMore}
                    disabled={isFiltering}
                    className="px-6 py-3 border border-brand-gray-200 hover:border-brand-black bg-white hover:bg-brand-gray-50 text-brand-black rounded-full text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-2"
                  >
                    {isFiltering ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>{t('explore.loadingBtn')}</span>
                      </>
                    ) : (
                      <span>{t('explore.loadMoreBtn')}</span>
                    )}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Right Side: Map showcase panel (Static on scroll desktop, floating hidden on mobile) */}
        <div className={`w-full lg:w-[460px] lg:sticky lg:top-28 shrink-0 rounded-3xl overflow-hidden border border-brand-gray-200/80 shadow-premium h-[420px] lg:h-[580px] bg-white transition-all ${
          mobileShowMap ? 'block' : 'hidden lg:block'
        }`}>
          <InteractiveMap 
            properties={filteredSortedProperties} 
            hoveredPropertyId={hoveredPropertyId} 
            mobileShowMap={mobileShowMap}
          />
        </div>

      </div>

      {showDatePicker && (
        <CalendarPicker
          selectedRange={selectedDates}
          onChange={(range) => {
            setStartDate(range?.start || '');
            setEndDate(range?.end || '');
            setPageSize(4);
            if (activeSearch) setActiveSearch(null);
          }}
          onClose={() => setShowDatePicker(false)}
          position={pickerPosition}
          properties={properties}
          swaps={swaps}
          searchQuery={searchQuery}
          guestsCount={guestsCount}
          activeCategory={activeCategory}
          selectedSwapType={selectedSwapType}
          sortBy={sortBy}
        />
      )}

      {showGuestPicker && (
        <GuestPicker
          refObject={guestPickerRef}
          position={guestPickerPosition}
          tempAdults={tempAdults}
          tempChildren={tempChildren}
          setTempAdults={setTempAdults}
          setTempChildren={setTempChildren}
          language={language === 'es' ? 'es' : 'en'}
          onCancel={() => setShowGuestPicker(false)}
          onConfirm={() => {
            setAdults(tempAdults);
            setChildren(tempChildren);
            setHasFilteredGuests(true);
            setShowGuestPicker(false);
            setPageSize(4);
            if (activeSearch) setActiveSearch(null);
          }}
        />
      )}

      {/* D. Floating View Toggler pill for smaller screens */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 lg:hidden shadow-floating">
        <button
          onClick={() => setMobileShowMap(!mobileShowMap)}
          className="flex items-center gap-2 bg-brand-black hover:bg-brand-gray-800 text-white px-5 py-3 rounded-full text-xs font-bold cursor-pointer"
        >
          {mobileShowMap ? (
            <>
              <List className="w-4 h-4" />
              <span>{t('explore.showList')}</span>
            </>
          ) : (
            <>
              <Map className="w-4 h-4" />
              <span>{t('explore.showMap')}</span>
            </>
          )}
        </button>
      </div>

    </div>
  );
}

export default function ExplorePage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-xs font-bold text-brand-gray-400">Cargando exploración...</div>}>
      <ExploreContent />
    </Suspense>
  );
}
