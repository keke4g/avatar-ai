export type AdminTab =
  | 'overview'
  | 'propertyReviews'
  | 'properties'
  | 'users'
  | 'swaps'
  | 'reports'
  | 'moderation'
  | 'settings';

export type AdminPropertyStatusFilter = 'All' | 'Published' | 'Review' | 'Draft' | 'Hidden';

export type AdminPropertySortField = 'title' | 'type' | 'location' | 'auraScore';

export type AdminAuditStatus = 'pending' | 'success' | 'alert' | 'info';

export interface AdminAuditEntry {
  id: number;
  type: string;
  key: string;
  params: Record<string, string | number>;
  time: string;
  status: AdminAuditStatus;
}

export interface AdminDashboardStats {
  activeProperties: number;
  totalUsers: number;
  completedSwaps: number;
  pendingSwaps: number;
  verifiedHosts: number;
  growthPercent: number;
}

export interface AdminCountryMetric {
  name: string;
  value: number;
}

export interface AdminPropertyCollectionStats {
  published: number;
  review: number;
  draft: number;
  hidden: number;
}

export const ADMIN_PAGINATION_LIMIT = 12;

export const ADMIN_AMENITIES = [
  'Wifi',
  'Air Conditioning',
  'Infinity Pool',
  'Ocean Views',
  'Private Beach',
  'Chef Kitchen',
  'Tesla Charger',
  'Sonos System',
  'Workstation',
  'Coffee Station',
  'Bicycles',
  'Gym',
  'Heated Jacuzzi',
] as const;

export const INITIAL_ADMIN_AUDIT_LOG: AdminAuditEntry[] = [
  { id: 1, type: 'KYC', key: 'auditKycDesc', params: { name: 'Carlos Mendoza' }, time: '10m', status: 'pending' },
  { id: 2, type: 'PROPERTY', key: 'auditPropDesc', params: { name: 'Sofia Alvarez', title: 'Shibuya Studio' }, time: '1h', status: 'success' },
  { id: 3, type: 'DISPUTE', key: 'auditDisputeDesc', params: { id: 'swap-preload-1' }, time: '3h', status: 'alert' },
  { id: 4, type: 'USER', key: 'auditUserDesc', params: { name: 'Chloe Laurent' }, time: '5h', status: 'info' },
];
