import { Property, User, SwapRequest } from '../types';

export const AnalyticsService = {
  getDashboardMetrics(properties: Property[], users: User[], swaps: SwapRequest[]) {
    const productionProperties = properties.filter((property) => !property.isDemo && !property.is_demo);
    const activeProperties = productionProperties.filter(
      (property) => property.isPublished === true && property.folderStatus === 'PUBLISHED',
    ).length;
    const totalUsers = users.length;
    const completedSwaps = swaps.filter(s => s.status === 'COMPLETED').length;
    const pendingSwaps = swaps.filter(s => s.status === 'PENDING').length;
    const verifiedHosts = users.filter(u => u.isVerified).length;
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const currentPeriod = productionProperties.filter((property) => {
      const timestamp = Date.parse(property.publishedAt || property.createdAt || '');
      return Number.isFinite(timestamp) && timestamp >= now - thirtyDays;
    }).length;
    const previousPeriod = productionProperties.filter((property) => {
      const timestamp = Date.parse(property.publishedAt || property.createdAt || '');
      return Number.isFinite(timestamp) && timestamp >= now - (2 * thirtyDays) && timestamp < now - thirtyDays;
    }).length;
    const growthPercent = previousPeriod === 0
      ? (currentPeriod > 0 ? 100 : 0)
      : Number((((currentPeriod - previousPeriod) / previousPeriod) * 100).toFixed(1));
    
    return {
      activeProperties,
      totalUsers,
      completedSwaps,
      pendingSwaps,
      verifiedHosts,
      growthPercent
    };
  },

  getCountryListingMetrics(properties: Property[]) {
    const counts: Record<string, number> = {};
    properties
      .filter((property) => property.isPublished === true && !property.isDemo && !property.is_demo)
      .forEach((p) => {
      counts[p.country] = (counts[p.country] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  },

  getMonthlyGrowthData(properties: Property[], swaps: SwapRequest[], months = 6) {
    const formatter = new Intl.DateTimeFormat('es-MX', { month: 'short' });
    const now = new Date();

    return Array.from({ length: months }, (_, index) => {
      const cursor = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1);
      const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const start = cursor.getTime();
      const end = nextMonth.getTime();

      return {
        month: formatter.format(cursor).replace('.', ''),
        properties: properties.filter((property) => {
          if (property.isDemo || property.is_demo) return false;
          const timestamp = Date.parse(property.publishedAt || property.createdAt || '');
          return Number.isFinite(timestamp) && timestamp >= start && timestamp < end;
        }).length,
        swaps: swaps.filter((swap) => {
          const timestamp = Date.parse(swap.createdAt);
          return swap.status === 'COMPLETED' && Number.isFinite(timestamp) && timestamp >= start && timestamp < end;
        }).length,
      };
    });
  }
};
