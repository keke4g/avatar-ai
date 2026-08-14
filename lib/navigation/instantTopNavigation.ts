const INSTANT_TOP_NAVIGATION_SESSION_KEY = 'towers:navigation:instant-top';

interface SessionStorageLike {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export const requestInstantTopNavigation = (storage: SessionStorageLike): void => {
  storage.setItem(INSTANT_TOP_NAVIGATION_SESSION_KEY, '1');
};

export const consumeInstantTopNavigation = (storage: SessionStorageLike): boolean => {
  if (storage.getItem(INSTANT_TOP_NAVIGATION_SESSION_KEY) !== '1') return false;
  storage.removeItem(INSTANT_TOP_NAVIGATION_SESSION_KEY);
  return true;
};
