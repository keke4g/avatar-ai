import { Property, User, SwapRequest, ChatMessage, Notification, SwapStatus, SwapTravelDetails, Review, Lead } from '../types';
import { PropertySearchFilters, SearchResult, ProviderCapabilities } from '../search/types';

export interface IPropertyService {
  getAll(): Promise<Property[]>;
  getById(id: string): Promise<Property | null>;
  create(property: Partial<Property> & { title: string; hostId: string }): Promise<Property>;
  update(id: string, property: Partial<Property>): Promise<Property>;
  delete(id: string): Promise<boolean>;
  togglePublish(id: string): Promise<Property>;
  toggleFeature(id: string): Promise<Property>;
  search(filters: PropertySearchFilters): Promise<SearchResult>;
  getFeatured(): Promise<Property[]>;
  getLatest(): Promise<Property[]>;
  getRecommendations(userId?: string): Promise<Property[]>;
  getCapabilities(): ProviderCapabilities;
}

export interface IUserService {
  getAll(): Promise<User[]>;
  getById(id: string): Promise<User | null>;
  update(id: string, user: Partial<User>): Promise<User>;
  updateVerification(id: string, isVerified: boolean, kycStatus: 'VERIFIED' | 'FAILED' | 'PENDING'): Promise<User>;
}

export interface ISwapService {
  getAll(): Promise<SwapRequest[]>;
  getById(id: string): Promise<SwapRequest | null>;
  create(swap: Omit<SwapRequest, 'id' | 'createdAt' | 'status'>): Promise<SwapRequest>;
  updateStatus(id: string, status: SwapStatus): Promise<SwapRequest>;
  confirmCompletion(id: string, userId: string): Promise<SwapRequest>;
  delete(id: string): Promise<boolean>;
  createDispute(swapId: string, reason: string): Promise<SwapRequest>;
  resolveDispute(swapId: string): Promise<SwapRequest>;
  getTravelDetails(swapId: string, travelerId: string): Promise<SwapTravelDetails | null>;
  upsertTravelDetails(details: Partial<SwapTravelDetails> & { swapId: string; travelerId: string; propertyId: string }): Promise<SwapTravelDetails>;
  getAllTravelDetails(): Promise<SwapTravelDetails[]>;
}

export interface IReviewService {
  getAll(): Promise<Review[]>;
  create(review: Omit<Review, 'id' | 'createdAt'>): Promise<Review>;
  getReviewsForUser(userId: string): Promise<Review[]>;
  getReviewsBySwap(swapId: string): Promise<Review[]>;
  delete(id: string): Promise<void>;
}

export interface ILeadService {
  getAllForUser(userId: string): Promise<Lead[]>;
  create(lead: Omit<Lead, 'id' | 'createdAt' | 'status'>): Promise<Lead>;
}

export interface IMessageService {
  getAllForUser(userId: string): Promise<ChatMessage[]>;
  send(swapRequestId: string, content: string, senderId: string): Promise<ChatMessage>;
  markAsRead(swapRequestId: string, userId: string): Promise<void>;
}

export interface INotificationService {
  getAllForUser(userId: string): Promise<Notification[]>;
  create(notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Promise<Notification>;
  markAsRead(id: string): Promise<boolean>;
  markAllAsRead(userId: string): Promise<boolean>;
}
