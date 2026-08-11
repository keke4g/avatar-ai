import type { Property, SwapRequest, User } from '@/lib/types';
import type { PropertyWizardDraft } from '@/lib/propertyWizardDraft';
import type {
  AdminPropertyCollectionStats,
  AdminPropertySortField,
  AdminPropertyStatusFilter,
} from './adminTypes';

export interface AdminPropertyFilters {
  search: string;
  type: string;
  tier: string;
  status: AdminPropertyStatusFilter;
  sortField: AdminPropertySortField;
  sortAscending: boolean;
}

export function filterAndSortAdminProperties(
  properties: Property[],
  filters: AdminPropertyFilters,
): Property[] {
  const normalizedSearch = filters.search.trim().toLowerCase();
  const filtered = properties.filter((property) => {
    const matchesSearch = !normalizedSearch
      || property.title.toLowerCase().includes(normalizedSearch)
      || property.location.toLowerCase().includes(normalizedSearch)
      || property.country.toLowerCase().includes(normalizedSearch)
      || property.internalCode?.toLowerCase().includes(normalizedSearch)
      || property.shortCode?.toLowerCase().includes(normalizedSearch)
      || property.id.toLowerCase().includes(normalizedSearch);
    const matchesType = filters.type === 'All' || property.type === filters.type;
    const matchesTier = filters.tier === 'All' || property.valueRating === filters.tier;
    const matchesStatus = filters.status === 'All'
      || (filters.status === 'Published' && property.isPublished === true)
      || (filters.status === 'Review' && property.folderStatus === 'UNDER_REVIEW')
      || (filters.status === 'Draft' && property.folderStatus === 'DRAFT')
      || (
        filters.status === 'Hidden'
        && property.isPublished !== true
        && property.folderStatus !== 'UNDER_REVIEW'
        && property.folderStatus !== 'DRAFT'
      );

    return matchesSearch && matchesType && matchesTier && matchesStatus;
  });

  return [...filtered].sort((left, right) => {
    let comparison = 0;
    if (filters.sortField === 'title') comparison = left.title.localeCompare(right.title);
    else if (filters.sortField === 'type') comparison = left.type.localeCompare(right.type);
    else if (filters.sortField === 'location') comparison = left.location.localeCompare(right.location);
    else if (filters.sortField === 'auraScore') comparison = left.auraScore - right.auraScore;
    return filters.sortAscending ? comparison : -comparison;
  });
}

export function wizardDraftMatchesAdminFilters(
  draft: PropertyWizardDraft | null,
  filters: Pick<AdminPropertyFilters, 'search' | 'type' | 'tier' | 'status'>,
): boolean {
  if (!draft) return false;
  if (!['All', 'Draft'].includes(filters.status)) return false;
  if (filters.type !== 'All' || filters.tier !== 'All') return false;

  const normalizedSearch = filters.search.trim().toLowerCase();
  if (!normalizedSearch) return true;

  return [draft.title, draft.location, draft.country, 'borrador']
    .some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
}

export function getAdminPropertyCollectionStats(
  properties: Property[],
  hasWizardDraft: boolean,
): AdminPropertyCollectionStats {
  return {
    published: properties.filter((property) => property.isPublished === true).length,
    review: properties.filter((property) => property.folderStatus === 'UNDER_REVIEW').length,
    draft: properties.filter((property) => property.folderStatus === 'DRAFT').length + (hasWizardDraft ? 1 : 0),
    hidden: properties.filter(
      (property) => property.isPublished !== true
        && property.folderStatus !== 'UNDER_REVIEW'
        && property.folderStatus !== 'DRAFT',
    ).length,
  };
}

export function getPendingAdminPropertyReviews(properties: Property[]): Property[] {
  return properties
    .filter((property) => property.folderStatus === 'UNDER_REVIEW' && property.isPublished !== true)
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
}

export function filterAdminUsers(
  users: User[],
  search: string,
  role: string,
  kycStatus: string,
): User[] {
  const normalizedSearch = search.toLowerCase();
  return users.filter((user) => (
    user.name.toLowerCase().includes(normalizedSearch)
    && (role === 'All' || user.role === role)
    && (kycStatus === 'All' || user.kycStatus === kycStatus)
  ));
}

export function filterAdminSwaps(
  swaps: SwapRequest[],
  users: User[],
  search: string,
  status: string,
): SwapRequest[] {
  const normalizedSearch = search.toLowerCase();
  return swaps.filter((swap) => {
    const sender = users.find((user) => user.id === swap.senderId);
    const receiver = users.find((user) => user.id === swap.receiverId);
    const matchesSearch = swap.message.toLowerCase().includes(normalizedSearch)
      || Boolean(sender?.name.toLowerCase().includes(normalizedSearch))
      || Boolean(receiver?.name.toLowerCase().includes(normalizedSearch));
    return matchesSearch && (status === 'All' || swap.status === status);
  });
}

export function paginateAdminItems<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function getSelectedAdminUserDetails(
  selectedUserId: string | null,
  users: User[],
  properties: Property[],
  swaps: SwapRequest[],
) {
  if (!selectedUserId) return null;
  const user = users.find((candidate) => candidate.id === selectedUserId);
  if (!user) return null;

  return {
    user,
    properties: properties.filter((property) => property.hostId === selectedUserId),
    swaps: swaps.filter((swap) => swap.senderId === selectedUserId || swap.receiverId === selectedUserId),
  };
}

export type SelectedAdminUserDetails = NonNullable<
  ReturnType<typeof getSelectedAdminUserDetails>
>;
