interface SessionStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const PROPERTY_SUMMARY_PREFIX = 'eterna_property_visit_v1';
const AUTH_GREETING_PREFIX = 'eterna_authenticated_greeting_v1';

const propertySummaryKey = (propertyId: string): string => (
  `${PROPERTY_SUMMARY_PREFIX}:${propertyId}`
);

const authenticatedGreetingKey = (userId: string): string => (
  `${AUTH_GREETING_PREFIX}:${userId}`
);

export const consumePropertySummaryPresentation = (
  storage: SessionStorageLike,
  propertyId: string,
): boolean => {
  try {
    const key = propertySummaryKey(propertyId);
    if (storage.getItem(key) !== null) return false;
    storage.setItem(key, 'seen');
    return true;
  } catch {
    // Storage may be unavailable in strict private modes. The in-memory guard
    // in Eterna still prevents duplicate playback while the page stays mounted.
    return true;
  }
};

export const consumeAuthenticatedGreeting = (
  storage: SessionStorageLike,
  userId: string,
): boolean => {
  try {
    const key = authenticatedGreetingKey(userId);
    if (storage.getItem(key) !== null) return false;
    storage.setItem(key, 'spoken');
    return true;
  } catch {
    return true;
  }
};

export const clearAuthenticatedGreeting = (
  storage: SessionStorageLike,
  userId: string,
): void => {
  try {
    storage.removeItem(authenticatedGreetingKey(userId));
  } catch {
    // A logout must never fail because sessionStorage is unavailable.
  }
};

export const getEternaFirstName = (
  name?: string | null,
  email?: string | null,
): string => {
  const normalizedName = name?.trim().replace(/\s+/g, ' ');
  if (normalizedName) return normalizedName.split(' ')[0];
  return email?.trim().split('@')[0] || '';
};
