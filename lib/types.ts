export interface PropertyReview {
  id: string;
  authorName: string;
  authorAvatar: string;
  rating: number;
  date: string;
  comment: string;
}

export type PropertyOfferingMode = 'SWAP' | 'SHORT_RENT' | 'MONTHLY_RENT' | 'SALE';

export type PropertyOfferingStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED' | 'SOLD' | 'RENTED';

export type PropertyOfferingVisibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';

export type PropertyBillingPeriod = 'NONE' | 'NIGHT' | 'WEEK' | 'MONTH' | 'TOTAL';

export interface PropertyOfferingAvailability {
  id: string;
  offeringId: string;
  startDate: string;
  endDate: string;
  isAvailable: boolean;
  note?: string | null;
  createdAt?: string;
}

export interface PropertyOfferingPricingRule {
  id: string;
  offeringId: string;
  startDate?: string | null;
  endDate?: string | null;
  priceAmount: number;
  currency: string;
  ruleType: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
}

export interface PropertyOffering {
  id: string;
  propertyId: string;
  mode: PropertyOfferingMode;
  status: PropertyOfferingStatus;
  visibility: PropertyOfferingVisibility;
  title?: string | null;
  description?: string | null;
  priceAmount?: number | null;
  currency: string;
  billingPeriod: PropertyBillingPeriod;
  securityDepositAmount?: number | null;
  cleaningFeeAmount?: number | null;
  serviceFeePercent?: number | null;
  commissionPercent?: number | null;
  minNights?: number | null;
  maxNights?: number | null;
  minMonths?: number | null;
  maxMonths?: number | null;
  isPriceNegotiable: boolean;
  acceptsOffers: boolean;
  requiresApproval: boolean;
  allowInstantRequest: boolean;
  swapPreferences: Record<string, unknown>;
  swapValueTier?: 'Premium' | 'Luxury' | 'Exclusive' | 'Curated' | string | null;
  auraScoreOverride?: number | null;
  availableFrom?: string | null;
  availableUntil?: string | null;
  isFeatured: boolean;
  featuredUntil?: string | null;
  featuredRank: number;
  metadata: Record<string, unknown>;
  availability?: PropertyOfferingAvailability[];
  pricingRules?: PropertyOfferingPricingRule[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Property {
  id: string;
  title: string;
  description: string;
  type: 'Apartment' | 'Beach House' | 'Cabin' | 'Penthouse' | 'Villa' | 'Loft';
  location: string;
  country: string;
  address?: string; // Physical location address
  valueRating: 'Premium' | 'Luxury' | 'Exclusive' | 'Curated';
  images: string[];
  amenities: string[];
  auraScore: number; // Swapping compatibility / match score (90-99%)
  bedrooms: number;
  bathrooms: number;
  maxGuests: number;
  hostId: string;
  hostName: string;
  hostAvatar: string;
  hostVerified: boolean;
  hostRating: number;
  hostReviewsCount: number;
  availableStart: string;
  availableEnd: string;
  latitude: number | null; // Real coordinates or null if not verified
  longitude: number | null; // Real coordinates or null if not verified
  placeId?: string | null;
  formattedAddress?: string | null;
  city?: string | null;
  state?: string | null;
  geometrySource?: 'google_places' | 'google_geocoding' | 'manual' | 'legacy' | null;
  rules?: string[]; // Custom house rules
  reviews?: PropertyReview[]; // Review log records
  isPublished?: boolean; // CMS active visibility flag
  isFeatured?: boolean; // CMS featured status
  featuredUntil?: string | null; // Expiration date for premium visibility
  featuredRank?: number; // Ordering precedence for premium listings
  offerings?: PropertyOffering[]; // Hybrid commercial modes while legacy swap fields remain supported
  metadata?: Record<string, any>;
}

export type SwapStatus = 'PENDING' | 'APPROVED' | 'DECLINED' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED';

export interface Review {
  id: string;
  swapId: string;
  reviewerId: string;
  reviewedUserId: string;
  rating: number; // 1-5
  comment: string;
  createdAt: string;
}

export interface SwapRequest {
  id: string;
  senderId: string;
  senderPropertyId: string;
  receiverId: string;
  receiverPropertyId: string;
  startDate: string;
  endDate: string;
  status: SwapStatus;
  message: string;
  createdAt: string;
  isDisputed?: boolean;
  disputeReason?: string;
  senderConfirmedComplete?: boolean;
  receiverConfirmedComplete?: boolean;
}

export interface SwapTravelDetails {
  id: string;
  swapId: string;
  travelerId: string;
  propertyId: string;
  wifiName?: string;
  wifiPassword?: string;
  accessCode?: string;
  checkinInstructions?: string;
  checkinTime?: string;
  checkoutTime?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  hostNotes?: string;
  createdAt?: string;
}

export type LeadType = 'SHORT_RENT' | 'MONTHLY_RENT' | 'SALE';

export type LeadStatus = 'NEW' | 'READ' | 'ARCHIVED';

export interface Lead {
  id: string;
  propertyId: string;
  offeringId: string;
  userId: string;
  leadType: LeadType;
  message: string;
  status: LeadStatus;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  swapRequestId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  isRead?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  content: string;
  isRead: boolean;
  createdAt: string;
}

export type UserRole = 'ADMIN' | 'HOST' | 'MEMBER';

export interface User {
  id: string;
  name: string;
  avatar: string;
  isVerified: boolean;
  role: UserRole; // Security access controls
  properties?: string[]; // Property IDs
  favorites: string[]; // Favorite Property IDs
  swapsCount?: number; // Total swap iterations
  kycStatus?: 'PENDING' | 'VERIFIED' | 'FAILED'; // Verification levels
  joinDate?: string;
  isSuspended?: boolean;
  bio?: string;
  email?: string;
}
