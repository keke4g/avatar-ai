export type DashboardTab = 'swaps' | 'properties' | 'leads' | 'favorites' | 'trips' | 'reviews';

export interface DashboardTabCounts {
  properties: number;
  leads: number;
  favorites: number;
  trips: number;
  reviews: number;
  pendingSwaps: number;
}
