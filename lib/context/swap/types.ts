import type { Dispatch, SetStateAction } from 'react';
import type {
  ChatMessage,
  Lead,
  Notification,
  Property,
  Review,
  SwapRequest,
  SwapStatus,
  SwapTravelDetails,
  User,
  UserRole,
} from '../../types';
import type { SearchSession } from '../../search/types';

export type NewPropertyInput = Omit<
  Property,
  | 'id'
  | 'hostId'
  | 'hostName'
  | 'hostAvatar'
  | 'hostVerified'
  | 'hostRating'
  | 'hostReviewsCount'
  | 'latitude'
  | 'longitude'
  | 'auraScore'
> & {
  latitude?: number | null;
  longitude?: number | null;
};

export type OnboardingProfileType = 'OWNER' | 'AGENT' | 'PROPERTY_MANAGER' | null;

export type TravelDetailsInput = Partial<SwapTravelDetails> & {
  swapId: string;
  travelerId: string;
  propertyId: string;
};

export type ActiveSearchState = (SearchSession & {
  loading: boolean;
  error: string | null;
}) | null;

export interface SwapContextType {
  properties: Property[];
  myProperties: Property[];
  swaps: SwapRequest[];
  messages: ChatMessage[];
  favorites: string[];
  currentUser: User | null;
  users: User[];
  notifications: Notification[];
  reviews: Review[];
  leads: Lead[];
  createLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'status' | 'userId'>) => Promise<Lead>;
  createReview: (review: Omit<Review, 'id' | 'createdAt'>) => Promise<Review>;
  confirmSwapCompletion: (swapId: string) => Promise<void>;
  addProperty: (prop: NewPropertyInput) => Promise<Property>;
  updateProperty: (id: string, updatedFields: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  togglePublish: (id: string) => Promise<void>;
  toggleFeature: (id: string) => Promise<void>;
  requestSwap: (request: Omit<SwapRequest, 'id' | 'senderId' | 'status' | 'createdAt'>) => Promise<SwapRequest>;
  updateSwapStatus: (swapId: string, status: SwapStatus) => Promise<void>;
  deleteSwap: (swapId: string) => Promise<void>;
  createSwapDispute: (swapId: string, reason: string) => Promise<void>;
  resolveSwapDispute: (swapId: string) => Promise<void>;
  sendChatMessage: (swapRequestId: string, content: string, senderId?: string) => Promise<ChatMessage>;
  toggleFavorite: (propertyId: string) => void;
  getSwapMessages: (swapRequestId: string) => ChatMessage[];
  updateUserKyc: (userId: string, kycStatus: 'PENDING' | 'VERIFIED' | 'FAILED') => void;
  toggleHostVerified: (userId: string) => void;
  updateUserRole: (userId: string, role: UserRole) => void;
  toggleUserSuspension: (userId: string) => void;
  loginMock: (email: string, password: string) => Promise<boolean>;
  registerMock: (email: string, name: string, password?: string, redirectAfterVerification?: string) => Promise<User>;
  logoutMock: () => void;
  updateProfileMock: (updatedFields: Partial<User>) => Promise<void>;
  completeOnboardingMock: (
    selectedCities: string[],
    bio: string,
    avatarUrl: string,
    profileType?: OnboardingProfileType,
  ) => Promise<void>;
  resetPasswordMock: (email: string) => Promise<void>;
  resendVerificationEmail: (email: string, redirectAfterVerification?: string) => Promise<boolean>;
  markMessagesAsRead: (swapRequestId: string) => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  isLoggingOut: boolean;
  logoutToast: boolean;
  setLogoutToast: (val: boolean) => void;
  archivedSwapIds: string[];
  archiveConversation: (swapId: string) => Promise<void>;
  unarchiveConversation: (swapId: string) => Promise<void>;
  travelDetails: SwapTravelDetails[];
  loadTravelDetails: (swapId: string, travelerId: string) => Promise<SwapTravelDetails | null>;
  updateTravelDetails: (details: TravelDetailsInput) => Promise<SwapTravelDetails>;
  loading: boolean;
  error: string | null;
  activeSearch: ActiveSearchState;
  setActiveSearch: Dispatch<SetStateAction<ActiveSearchState>>;
}
