import { CURRENT_USER, MOCK_USERS } from '../../mockData';
import type {
  ChatMessage,
  Lead,
  Notification,
  Property,
  SwapRequest,
  SwapTravelDetails,
  User,
} from '../../types';

export interface MockSwapState {
  swaps: SwapRequest[];
  messages: ChatMessage[];
  favorites: string[];
  users: User[];
  notifications: Notification[];
  leads: Lead[];
  currentUser: User | null;
  travelDetails: SwapTravelDetails[];
}

export interface SwapPersistentState {
  properties: Property[];
  myProperties: Property[];
  swaps: SwapRequest[];
  messages: ChatMessage[];
  favorites: string[];
  users: User[];
  currentUser: User | null;
  notifications: Notification[];
  archivedSwapIds: string[];
  leads: Lead[];
}

export function parseArchivedSwapIds(serialized: string | null): string[] {
  return serialized ? JSON.parse(serialized) : [];
}

export function parseStoredCurrentUser(serialized: string | null): User | null {
  return serialized ? JSON.parse(serialized) : null;
}

function restoreMockUserEmails(users: User[]): User[] {
  const hasMissingEmails = users.some(
    user => !user.email && MOCK_USERS.some(mockUser => mockUser.id === user.id),
  );

  if (!hasMissingEmails) return users;

  return users.map(user => {
    if (!user.email) {
      const match = MOCK_USERS.find(mockUser => mockUser.id === user.id);
      if (match) return { ...user, email: match.email };
    }
    return user;
  });
}

export function loadMockSwapState(storage: Pick<Storage, 'getItem'>): MockSwapState {
  const storedSwaps = storage.getItem('auraswap_swaps');
  const storedMessages = storage.getItem('auraswap_messages');
  const storedFavorites = storage.getItem('auraswap_favorites');
  const storedUsers = storage.getItem('auraswap_users');
  const storedNotifications = storage.getItem('auraswap_notifications');
  const storedLeads = storage.getItem('auraswap_leads');

  const swaps: SwapRequest[] = storedSwaps ? JSON.parse(storedSwaps) : [
    {
      id: 'swap-preload-1',
      senderId: 'host-sofia',
      senderPropertyId: 'prop-3', // CDMX Penthouse
      receiverId: 'current-user',
      receiverPropertyId: 'user-prop-1', // Shibuya Studio
      startDate: '2026-09-10',
      endDate: '2026-09-24',
      status: 'PENDING',
      message: 'Hola Mateo! I absolutely love your Shibuya micro-loft. I am planning a research trip to Tokyo in September. Would you be open to exchanging it for my Roma Norte penthouse? It has a stunning plant-filled rooftop terrace.',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const messages: ChatMessage[] = storedMessages ? JSON.parse(storedMessages) : [
    {
      id: 'msg-preload-1',
      swapRequestId: 'swap-preload-1',
      senderId: 'host-sofia',
      senderName: 'Sofia Alvarez',
      content: 'Hola Mateo! I absolutely love your Shibuya micro-loft. I am planning a research trip to Tokyo in September. Would you be open to exchanging it for my Roma Norte penthouse? It has a stunning plant-filled rooftop terrace.',
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const parsedUsers: User[] = storedUsers ? JSON.parse(storedUsers) : MOCK_USERS;
  const users = restoreMockUserEmails(parsedUsers);

  const notifications: Notification[] = storedNotifications ? JSON.parse(storedNotifications) : [
    {
      id: 'noti-preload-1',
      userId: 'current-user',
      title: 'Perfil Verificado ✨',
      content: 'Tu verificación KYC ha sido aprobada.',
      isRead: false,
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
    },
    {
      id: 'noti-preload-2',
      userId: 'current-user',
      title: 'Bienvenido a Towers México',
      content: 'Explora espacios y propone swaps sin pagar renta.',
      isRead: false,
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const storedCurrentUser = storage.getItem('auraswap_current_user');
  let currentUser: User | null;
  if (storedCurrentUser) {
    const parsed: User = JSON.parse(storedCurrentUser);
    if (!parsed.email) {
      const match = MOCK_USERS.find(mockUser => mockUser.id === parsed.id);
      currentUser = match ? { ...parsed, email: match.email } : parsed;
    } else {
      currentUser = parsed;
    }
  } else {
    const isGuest = storage.getItem('auraswap_guest_mode') === 'true';
    currentUser = isGuest ? null : CURRENT_USER;
  }

  const storedTravelDetails = storage.getItem('auraswap_swap_travel_details');

  return {
    swaps,
    messages,
    favorites: storedFavorites ? JSON.parse(storedFavorites) : CURRENT_USER.favorites,
    users,
    notifications,
    leads: storedLeads ? JSON.parse(storedLeads) : [],
    currentUser,
    travelDetails: storedTravelDetails ? JSON.parse(storedTravelDetails) : [],
  };
}

export function persistSwapContextState(
  storage: Pick<Storage, 'setItem' | 'removeItem'>,
  state: SwapPersistentState,
): void {
  storage.setItem('auraswap_properties', JSON.stringify(state.properties));
  storage.setItem('auraswap_my_properties', JSON.stringify(state.myProperties));
  storage.setItem('auraswap_swaps', JSON.stringify(state.swaps));
  storage.setItem('auraswap_messages', JSON.stringify(state.messages));
  storage.setItem('auraswap_favorites', JSON.stringify(state.favorites));
  storage.setItem('auraswap_users', JSON.stringify(state.users));
  storage.setItem('auraswap_notifications', JSON.stringify(state.notifications));
  storage.setItem('auraswap_archived_swaps', JSON.stringify(state.archivedSwapIds));
  storage.setItem('auraswap_leads', JSON.stringify(state.leads));

  if (state.currentUser) {
    storage.setItem('auraswap_current_user', JSON.stringify(state.currentUser));
  } else {
    storage.removeItem('auraswap_current_user');
  }
}
