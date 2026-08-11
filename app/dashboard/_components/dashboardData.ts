import type { Lead, Property, Review, SwapRequest } from '@/lib/types';

const TRAVELER_SWAP_STATUSES = new Set(['APPROVED', 'CONFIRMED', 'ACTIVE', 'COMPLETED']);

export function getFavoriteDashboardProperties(
  properties: Property[],
  favoriteIds: string[],
): Property[] {
  const favoriteIdSet = new Set(favoriteIds);
  return properties.filter((property) => favoriteIdSet.has(property.id));
}

export function getReceivedDashboardLeads(
  leads: Lead[],
  ownedProperties: Property[],
): Lead[] {
  const ownedPropertyIds = new Set(ownedProperties.map((property) => property.id));
  return leads.filter((lead) => ownedPropertyIds.has(lead.propertyId));
}

export function getDashboardSwapCollections(
  swaps: SwapRequest[],
  userId?: string,
) {
  if (!userId) {
    return {
      incoming: [] as SwapRequest[],
      outgoing: [] as SwapRequest[],
      trips: [] as SwapRequest[],
    };
  }

  return {
    incoming: swaps.filter((swap) => swap.receiverId === userId),
    outgoing: swaps.filter((swap) => swap.senderId === userId),
    trips: swaps.filter(
      (swap) => (
        (swap.senderId === userId || swap.receiverId === userId)
        && TRAVELER_SWAP_STATUSES.has(swap.status)
      ),
    ),
  };
}

export function getReceivedDashboardReviewCount(reviews: Review[], userId?: string): number {
  if (!userId) return 0;
  return reviews.filter((review) => review.reviewedUserId === userId).length;
}
