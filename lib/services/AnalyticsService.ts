import { Property, User, SwapRequest } from '../types';

export const AnalyticsService = {
  getDashboardMetrics(properties: Property[], users: User[], swaps: SwapRequest[]) {
    const activeProperties = properties.filter(p => p.isPublished !== false).length;
    const totalUsers = users.length;
    const completedSwaps = swaps.filter(s => s.status === 'APPROVED').length;
    const pendingSwaps = swaps.filter(s => s.status === 'PENDING').length;
    const verifiedHosts = users.filter(u => u.isVerified).length;
    const growthPercent = 14.8; // Monthly mock growth
    
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
    properties.forEach((p) => {
      counts[p.country] = (counts[p.country] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  },

  getMonthlyGrowthData() {
    return [
      { month: 'Jan', properties: 6, swaps: 2 },
      { month: 'Feb', properties: 8, swaps: 3 },
      { month: 'Mar', properties: 9, swaps: 4 },
      { month: 'Apr', properties: 10, swaps: 5 },
      { month: 'May', properties: 12, swaps: 6 }
    ];
  }
};
