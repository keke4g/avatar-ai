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
  commercialCode?: string;
  mode: PropertyOfferingMode;
  status: PropertyOfferingStatus;
  visibility: PropertyOfferingVisibility;
  title?: string | null;
  description?: string | null;
  priceAmount?: number | null;
  currency: string;
  billingPeriod: PropertyBillingPeriod;
  
  // Financial specifics
  acceptsBankCredit?: boolean;
  acceptsInfonavit?: boolean;
  acceptsFovissste?: boolean;
  acceptsCash?: boolean;
  developerFinancing?: boolean;

  // Rental specifics
  depositAmount?: number | null;
  advanceMonths?: number;
  requiresGuarantor?: boolean;
  requiresLegalPolicy?: boolean;

  // Swap specifics
  swapEstimatedValue?: number | null;
  desiredExchange?: string | null;
  swapMinValue?: number | null;
  swapMaxValue?: number | null;
  swapCashDifferenceAllowed?: boolean;

  // Maintenance and average costs
  annualPropertyTax?: number;
  waterMonthlyAvg?: number;
  electricityMonthlyAvg?: number;
  gasMonthlyAvg?: number;

  // Broker details
  commissionTotalPct?: number | null;
  commissionSharedPct?: number | null;
  agentResponsibleId?: string | null;
  estimatedDeliveryDate?: string | null;

  // Legacy compatibility fields
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

export interface PropertyDocument {
  id: string;
  propertyId: string;
  documentType: 'DEED' | 'TAX_RECIPET' | 'APPRAISAL' | 'CONDO_REGIME' | 'PLAN' | 'CONTRACT' | 'ID_PROPRIETOR';
  fileUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface CustomField {
  id: string;
  name: string;
  fieldType: 'text' | 'number' | 'boolean' | 'select';
  options?: string[];
  defaultValue?: string;
}

export interface CustomFieldValue {
  propertyId: string;
  fieldId: string;
  value: string;
}

export interface Property {
  id: string;
  internalCode?: string;
  primaryOperation?: 'SALE' | 'RENT' | 'SWAP';
  ownerProfileId?: string | null;
  companyId?: string | null;
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
  isDemo?: boolean;
  is_demo?: boolean;

  // Development info
  developmentName?: string | null;
  subdivisionName?: string | null;
  privateNeighborhood?: string | null;
  phaseStage?: string | null;
  lotNumber?: string | null;
  blockNumber?: string | null;
  condominiumRegime?: boolean;
  maintenanceFeeAmount?: number;

  // Detailed Location
  neighborhood?: string | null;
  postalCode?: string | null;
  streetName?: string | null;
  streetNumber?: string | null;
  locationReference?: string | null;
  showPublicAddress?: boolean;

  // Extra features
  halfBathrooms?: number;
  parkingSpaces?: number;
  levelsCount?: number;
  constructionAge?: number | null;
  conservationStateId?: string | null;
  constructionTypeId?: string | null;

  // Surfaces
  surfaceTotal?: number | null;
  surfaceBuilt?: number | null;
  surfaceFront?: number | null;
  surfaceDepth?: number | null;
  surfaceGarden?: number;
  surfaceTerrace?: number;
  surfaceRoofGarden?: number;
  surfacePatio?: number;

  // Legal
  legalDebtFree?: boolean;
  legalPublicDeed?: boolean;
  legalTaxCurrent?: boolean;
  legalServicesPaid?: boolean;
  legalOwnerType?: string | null;
  legalIsMortgaged?: boolean;

  // Services
  servicesWater?: boolean;
  servicesElectricity?: boolean;
  servicesSewerage?: boolean;
  servicesNatGas?: boolean;
  servicesLpGas?: boolean;
  servicesInternet?: string;
  servicesGarbage?: boolean;

  // Security
  securityCctv?: boolean;
  securityGuardhouse?: boolean;
  security24_7?: boolean;
  securityBiometric?: boolean;

  // View and Orientation
  viewTypeId?: string | null;
  orientationId?: string | null;

  // IA
  aiSummary?: string | null;
  aiDescription?: string | null;
  aiTags?: string[];
  aiKeywords?: string[];
  aiScoreOverride?: number | null;
  aiRecommendations?: string[];

  // Workflow Folder Status
  folderStatus?: 'DRAFT' | 'PENDING_DOCUMENTS' | 'UNDER_REVIEW' | 'PUBLISHED' | 'PAUSED' | 'SOLD' | 'RENTED' | 'ARCHIVED';

  // Owner private info
  ownerPrivateName?: string | null;
  ownerPrivatePhone?: string | null;
  ownerPrivateEmail?: string | null;
  ownerContactTime?: string | null;

  // SEO
  metaTitle?: string | null;
  metaDescription?: string | null;
  metaKeywords?: string[];

  // IDs Aux
  qrCodeUrl?: string | null;
  shortCode?: string | null;
  shortLink?: string | null;
  updatedAt?: string;
  desiredExchange?: string | null;

  // Expediente Jurídico & Avalúo & Comercial
  legalLienType?: 'Banco' | 'Infonavit' | 'FOVISSSTE' | 'Particular' | 'Hipoteca privada' | 'Embargo' | 'Otro';
  legalLienObservations?: string;
  legalRegime?: 'Condominal' | 'Propiedad Privada' | 'Ejidal' | 'Fideicomiso' | 'Otro';
  legalLandUse?: 'Residencial' | 'Comercial' | 'Mixto' | 'Industrial' | 'Otro';
  legalRestrictions?: string;
  legalDocumentationComplete?: boolean;
  legalJuridicalResponsible?: string;
  legalLastUpdate?: string;
  
  appraisalAmount?: number;
  appraisalDate?: string;
  appraisalExpert?: string;
  appraisalValidity?: string;
  
  appreciationLevel?: 'Alta' | 'Media' | 'Baja' | 'En desarrollo';
  commercialStatus?: 'Disponible' | 'Apartada' | 'Promesa de Compra' | 'En Escrituración' | 'Vendida' | 'Rentada' | 'Suspendida' | 'Bajo Oferta' | 'En negociación';
  
  priceHistory?: {
    initialPrice: number;
    currentPrice: number;
    lastModificationDate: string;
    trend: 'UP' | 'DOWN' | 'STABLE';
  };
  
  brokerProfile?: {
    photo: string;
    name: string;
    company: string;
    position: string;
    responseTime: string;
    phone: string;
    whatsapp: string;
    email: string;
  };

  // Relations
  documents?: PropertyDocument[];
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

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'REAL_ESTATE_COMPANY' | 'DEVELOPER' | 'PROPERTY_MANAGER' | 'BROKER' | 'AGENT' | 'OWNER' | 'MARKETING' | 'ASSISTANT' | 'MEMBER' | 'HOST';

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
  companyId?: string | null;
  officeId?: string | null;
  profileType?: 'OWNER' | 'AGENT' | 'PROPERTY_MANAGER' | null;
}
