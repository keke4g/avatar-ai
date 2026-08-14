"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Property, SwapRequest, ChatMessage, User, SwapStatus, UserRole, Notification, SwapTravelDetails, Review, Lead } from '../types';
import { CURRENT_USER, MOCK_USERS } from '../mockData';
import { PropertyService } from '../services/PropertyService';
import { UserService } from '../services/UserService';
import { SwapService } from '../services/SwapService';
import { ServiceFactory, useSupabase } from '../services/ServiceFactory';
import { supabase } from '../supabaseClient';
import { searchCache } from '../search/SearchCache';
import { getAuthRedirectUrl } from '../authUrls';
import type { NewPropertyInput, OnboardingProfileType, SwapContextType, TravelDetailsInput } from './swap/types';
import {
  loadMockSwapState,
  parseArchivedSwapIds,
  persistSwapContextState,
} from './swap/storage';
import { useLatestRef } from './swap/useLatestRef';

const SwapContext = createContext<SwapContextType | undefined>(undefined);

type SupabaseAuthUserSnapshot = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

const createSessionUser = (authUser: SupabaseAuthUserSnapshot): User => {
  const metadata = authUser.user_metadata || {};
  const metadataName = [metadata.name, metadata.full_name, metadata.display_name]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
  const email = authUser.email?.trim() || '';
  const name = metadataName?.trim() || email.split('@')[0] || 'Usuario';
  const metadataAvatar = [metadata.avatar_url, metadata.picture]
    .find((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return {
    id: authUser.id,
    name,
    email,
    avatar: metadataAvatar?.trim() || '',
    role: 'MEMBER',
    isVerified: false,
    kycStatus: 'PENDING',
    joinDate: new Date().toLocaleDateString('es-ES'),
    swapsCount: 0,
    isSuspended: false,
    favorites: [],
  };
};

export const SwapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSearch, setActiveSearch] = useState<SwapContextType['activeSearch']>(null);
  const [myProperties, setMyProperties] = useState<Property[]>([]);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!useSupabase);
  const [authProfileReady, setAuthProfileReady] = useState(!useSupabase);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutToast, setLogoutToast] = useState(false);
  const [archivedSwapIds, setArchivedSwapIds] = useState<string[]>([]);
  const [travelDetails, setTravelDetails] = useState<SwapTravelDetails[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  const router = useRouter();
  const pathname = usePathname();

  // Reset isLoggingOut when user navigates to public routes
  useEffect(() => {
    if (pathname === '/' || pathname === '/explore' || pathname === '/login') {
      queueMicrotask(() => setIsLoggingOut(false));
    }
  }, [pathname]);

  // Auto-dismiss logout toast after 3 seconds
  useEffect(() => {
    if (logoutToast) {
      const timer = setTimeout(() => {
        setLogoutToast(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [logoutToast]);

  // Initialize state from localStorage or mock data
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedArchived = localStorage.getItem('auraswap_archived_swaps');
      queueMicrotask(() => setArchivedSwapIds(parseArchivedSwapIds(storedArchived)));

      if (useSupabase) {
        // Load only public/shared state here. Private user collections hydrate
        // once the authenticated session has been verified below, avoiding a
        // duplicate request burst based on potentially stale local storage.
        const propertiesRequest = ServiceFactory.getPropertyService().getAll().then(liveProps => {
          setProperties(liveProps);
          setLoading(false);
          return liveProps;
        });

        Promise.all([
          propertiesRequest,
          ServiceFactory.getUserService().getAll(),
          ServiceFactory.getReviewService().getAll(),
        ]).then(([, liveUsers, liveReviews]) => {
          setUsers(liveUsers);
          setReviews(liveReviews);
          setIsLoaded(true);
        }).catch(err => {
          console.error('[SwapContext] Live Supabase initial fetch failed:', err);
          setError(err instanceof Error ? err.message : 'Failed to fetch live Supabase data');
          setIsLoaded(true);
        }).finally(() => {
          setLoading(false);
        });
      } else {
        queueMicrotask(() => {
          const mockState = loadMockSwapState(localStorage);
          const initialUser = mockState.currentUser;

          setSwaps(mockState.swaps);
          setMessages(mockState.messages);
          setFavorites(mockState.favorites);
          setUsers(mockState.users);
          setNotifications(mockState.notifications);
          setLeads(mockState.leads);
          setCurrentUser(initialUser);
          setTravelDetails(mockState.travelDetails);
          setAuthReady(true);
          setAuthProfileReady(true);

          ServiceFactory.getReviewService().getAll().then(r => setReviews(r));

          setLoading(true);
          ServiceFactory.getPropertyService().getAll()
            .then(liveProps => {
              setProperties(liveProps);
              if (initialUser) {
                setMyProperties(liveProps.filter(p => p.hostId === initialUser.id));
              }
              setLoading(false);
              setIsLoaded(true);
            })
            .catch(err => {
              console.error('[SwapContext] Fetching mock properties failed:', err);
              setError(err.message || 'Failed to fetch properties');
              setLoading(false);
              setIsLoaded(true);
            });
        });
      }
    }
  }, []);

  // Synchronize Live Supabase Auth Session & Profiles
  useEffect(() => {
    if (useSupabase && typeof window !== 'undefined') {
      let authVersion = 0;

      const syncSupabaseProfile = async (userId: string, version: number) => {
        try {
          const fetchConfirmedProfile = async (): Promise<User | null> => {
            const retryDelays = [0, 200, 500];
            for (const delayMs of retryDelays) {
              if (delayMs > 0) {
                await new Promise((resolve) => window.setTimeout(resolve, delayMs));
              }
              if (version !== authVersion) return null;
              const profile = await ServiceFactory.getUserService().getById(userId);
              if (profile) return profile;
            }
            return null;
          };

          const [profile, favoritesResult, archivedResult] = await Promise.all([
            fetchConfirmedProfile(),
            supabase
              .from('favorites')
              .select('property_id')
              .eq('user_id', userId),
            supabase
              .from('archived_conversations')
              .select('swap_id')
              .eq('user_id', userId),
          ]);

          if (version !== authVersion) return;

          if (profile) {
            setCurrentUser(profile);
            setAuthProfileReady(true);
            localStorage.setItem('auraswap_current_user', JSON.stringify(profile));

            if (!favoritesResult.error && favoritesResult.data) {
              const favIds = favoritesResult.data.map((favorite: { property_id: string }) => favorite.property_id);
              setFavorites(favIds);
              localStorage.setItem('auraswap_favorites', JSON.stringify(favIds));
            }

            if (!archivedResult.error && archivedResult.data) {
              const archIds = archivedResult.data.map((archive: { swap_id: string }) => archive.swap_id);
              setArchivedSwapIds(archIds);
              localStorage.setItem('auraswap_archived_swaps', JSON.stringify(archIds));
            }
          }
        } catch (err) {
          console.error('[SwapContext] Failed to sync Supabase profile:', err);
        }
      };

      let lastSyncedUserId: string | null = null;

      // onAuthStateChange emits INITIAL_SESSION, so a separate getSession()
      // call would duplicate profile hydration. Keep async Supabase calls out
      // of the auth callback itself to avoid holding the auth client lock.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
          const sessionUser = createSessionUser(session.user);
          setCurrentUser((current) => current?.id === session.user.id ? current : sessionUser);
          setAuthReady(true);

          if (lastSyncedUserId === session.user.id && event !== 'USER_UPDATED') return;
          setAuthProfileReady(false);
          lastSyncedUserId = session.user.id;
          const version = ++authVersion;
          window.setTimeout(() => {
            void syncSupabaseProfile(session.user.id, version);
          }, 0);
        } else {
          authVersion += 1;
          lastSyncedUserId = null;
          setCurrentUser(null);
          setFavorites([]);
          setArchivedSwapIds([]);
          setSwaps([]);
          setMessages([]);
          setNotifications([]);
          setTravelDetails([]);
          setLeads([]);
          localStorage.removeItem('auraswap_current_user');
          setAuthReady(true);
          setAuthProfileReady(true);
        }
      });

      return () => {
        authVersion += 1;
        subscription.unsubscribe();
      };
    }
  }, []);

  // Create refs to prevent connection churn in real-time WebSockets
  const currentUserRef = useLatestRef(currentUser);
  const swapsRef = useLatestRef(swaps);
  const messagesRef = useLatestRef(messages);
  const notificationsRef = useLatestRef(notifications);
  const usersRef = useLatestRef(users);

  // Hydrate swaps, messages & notifications reactively when active user changes
  useEffect(() => {
    if (useSupabase && currentUser?.id) {
      Promise.all([
        ServiceFactory.getSwapService().getAll(),
        ServiceFactory.getMessageService().getAllForUser(currentUser.id),
        ServiceFactory.getNotificationService().getAllForUser(currentUser.id),
        ServiceFactory.getSwapService().getAllTravelDetails(),
        ServiceFactory.getLeadService().getAllForUser(currentUser.id)
      ]).then(([liveSwaps, liveMessages, liveNotifications, liveTravelDetails, liveLeads]) => {
        setSwaps(liveSwaps);
        setMessages(liveMessages);
        setNotifications(liveNotifications);
        setTravelDetails(liveTravelDetails);
        setLeads(liveLeads);
      }).catch(err => {
        console.error('[SwapContext] Live user swaps/messages/notifications sync failed:', err);
      });
    }
  }, [currentUser?.id]);

  // Realtime swaps subscription
  useEffect(() => {
    if (!useSupabase || !currentUser?.id) return;

    const channel = supabase
      .channel(`realtime:swaps:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'swaps'
        },
        (payload) => {
          const user = currentUserRef.current;
          if (!user) return;

          if (payload.eventType === 'INSERT') {
            const row = payload.new;
            // Client-side whitelisting: propagate only if user is participant
            if (row.sender_id !== user.id && row.receiver_id !== user.id) {
              return;
            }

            const newSwap: SwapRequest = {
              id: row.id,
              senderId: row.sender_id,
              senderPropertyId: row.sender_property_id,
              receiverId: row.receiver_id,
              receiverPropertyId: row.receiver_property_id,
              startDate: row.start_date,
              endDate: row.end_date,
              status: row.status,
              message: row.message || '',
              createdAt: row.created_at
            };

            setSwaps(prev => prev.some(s => s.id === newSwap.id) ? prev : [newSwap, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            // Client-side whitelisting: propagate only if user is participant
            if (row.sender_id !== user.id && row.receiver_id !== user.id) {
              return;
            }

            const updatedSwap: SwapRequest = {
              id: row.id,
              senderId: row.sender_id,
              senderPropertyId: row.sender_property_id,
              receiverId: row.receiver_id,
              receiverPropertyId: row.receiver_property_id,
              startDate: row.start_date,
              endDate: row.end_date,
              status: row.status,
              message: row.message || '',
              createdAt: row.created_at
            };

            setSwaps(prev => prev.map(s => s.id === updatedSwap.id ? { ...s, ...updatedSwap } : s));
          } else if (payload.eventType === 'DELETE') {
            const rowId = payload.old.id;
            // Client-side whitelisting: check if existing swap is ours
            const existingSwap = swapsRef.current.find(s => s.id === rowId);
            if (existingSwap) {
              if (existingSwap.senderId !== user.id && existingSwap.receiverId !== user.id) {
                return;
              }
            }

            setSwaps(prev => prev.filter(s => s.id !== rowId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUserRef, swapsRef]);

  // Realtime messages subscription
  useEffect(() => {
    if (!useSupabase || !currentUser?.id) return;

    const channel = supabase
      .channel(`realtime:messages:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          const user = currentUserRef.current;
          if (!user) return;

          if (payload.eventType === 'INSERT') {
            const row = payload.new;
            // Client-side whitelisting: propagate only if user is participant in the swap
            const swap = swapsRef.current.find(s => s.id === row.swap_id);
            if (!swap || (swap.senderId !== user.id && swap.receiverId !== user.id)) {
              return;
            }

            // Hydrate senderName instantly using users ref lookup in memory
            const senderId = row.sender_id;
            let senderName = 'Towers México';
            if (senderId) {
              if (senderId === user.id) {
                senderName = user.name;
              } else {
                const match = usersRef.current.find(u => u.id === senderId);
                senderName = match ? match.name : 'Host';
              }
            }

            const newMsg: ChatMessage = {
              id: row.id,
              swapRequestId: row.swap_id,
              senderId: row.sender_id || 'system',
              senderName,
              content: row.content,
              createdAt: row.created_at,
              isRead: row.is_read ?? false
            };

            setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            // Client-side whitelisting: propagate only if user is participant in the swap
            const swap = swapsRef.current.find(s => s.id === row.swap_id);
            if (!swap || (swap.senderId !== user.id && swap.receiverId !== user.id)) {
              return;
            }

            setMessages(prev => prev.map(m => m.id === row.id ? {
              ...m,
              isRead: row.is_read ?? m.isRead,
              content: row.content ?? m.content
            } : m));
          } else if (payload.eventType === 'DELETE') {
            const rowId = payload.old.id;
            // Client-side whitelisting: check if existing message belongs to a swap of ours
            const existingMsg = messagesRef.current.find(m => m.id === rowId);
            if (existingMsg) {
              const swap = swapsRef.current.find(s => s.id === existingMsg.swapRequestId);
              if (swap) {
                if (swap.senderId !== user.id && swap.receiverId !== user.id) {
                  return;
                }
              }
            }

            setMessages(prev => prev.filter(m => m.id !== rowId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUserRef, messagesRef, swapsRef, usersRef]);

  // Realtime notifications subscription
  useEffect(() => {
    if (!useSupabase || !currentUser?.id) return;

    const channel = supabase
      .channel(`realtime:notifications:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${currentUser.id}`
        },
        (payload) => {
          const user = currentUserRef.current;
          if (!user) return;

          if (payload.eventType === 'INSERT') {
            const row = payload.new;
            // Client-side whitelisting double-check
            if (row.user_id !== user.id) {
              return;
            }

            const newNoti: Notification = {
              id: row.id,
              userId: row.user_id,
              title: row.title,
              content: row.content,
              isRead: row.is_read ?? false,
              createdAt: row.created_at
            };

            setNotifications(prev => prev.some(n => n.id === newNoti.id) ? prev : [newNoti, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const row = payload.new;
            // Client-side whitelisting double-check
            if (row.user_id !== user.id) {
              return;
            }

            const updatedNoti: Notification = {
              id: row.id,
              userId: row.user_id,
              title: row.title,
              content: row.content,
              isRead: row.is_read ?? false,
              createdAt: row.created_at
            };

            setNotifications(prev => prev.map(n => n.id === updatedNoti.id ? { ...n, ...updatedNoti } : n));
          } else if (payload.eventType === 'DELETE') {
            const rowId = payload.old.id;
            // Client-side whitelisting double check on local ref
            const existingNoti = notificationsRef.current.find(n => n.id === rowId);
            if (existingNoti) {
              if (existingNoti.userId !== user.id) {
                return;
              }
            }

            setNotifications(prev => prev.filter(n => n.id !== rowId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUserRef, notificationsRef]);

  // Realtime travel_details subscription
  useEffect(() => {
    if (!useSupabase || !currentUser?.id) return;

    const channel = supabase
      .channel(`realtime:swap_travel_details:${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'swap_travel_details'
        },
        (payload) => {
          const user = currentUserRef.current;
          const activeSwaps = swapsRef.current;
          if (!user) return;

          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new;
            // Client-side whitelisting whitelists based on swap participancy
            const matchedSwap = activeSwaps.find(s => s.id === row.swap_id);
            if (!matchedSwap) return; // not involved in this swap

            const isParticipant = matchedSwap.senderId === user.id || matchedSwap.receiverId === user.id;
            if (!isParticipant) return;

            const newDetails: SwapTravelDetails = {
              id: row.id,
              swapId: row.swap_id,
              travelerId: row.traveler_id,
              propertyId: row.property_id,
              wifiName: row.wifi_name || '',
              wifiPassword: row.wifi_password || '',
              accessCode: row.access_code || '',
              checkinInstructions: row.checkin_instructions || '',
              checkinTime: row.checkin_time || '15:00',
              checkoutTime: row.checkout_time || '11:00',
              emergencyContactName: row.emergency_contact_name || '',
              emergencyContactPhone: row.emergency_contact_phone || '',
              hostNotes: row.host_notes || '',
              createdAt: row.created_at
            };

            setTravelDetails(prev => {
              const filtered = prev.filter(d => d.id !== newDetails.id);
              return [...filtered, newDetails];
            });
          } else if (payload.eventType === 'DELETE') {
            const rowId = payload.old.id;
            setTravelDetails(prev => prev.filter(d => d.id !== rowId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, currentUserRef, swapsRef]);

  // Synchronize myProperties reactively whenever properties or currentUser changes
  useEffect(() => {
    queueMicrotask(() => {
      if (currentUser) {
        setMyProperties(properties.filter(p => p.hostId === currentUser.id));
      } else {
        setMyProperties([]);
      }
    });
  }, [properties, currentUser]);

  // Save changes to localStorage
  useEffect(() => {
    if (isLoaded) {
      persistSwapContextState(localStorage, {
        properties,
        myProperties,
        swaps,
        messages,
        favorites,
        users,
        currentUser,
        notifications,
        archivedSwapIds,
        leads,
      });
    }
  }, [properties, myProperties, swaps, messages, favorites, users, currentUser, notifications, archivedSwapIds, leads, isLoaded]);

  // Actions delegating to concrete services
  const addProperty = async (prop: NewPropertyInput) => {
    console.log('[Publish] SwapContext.addProperty recibido:', prop);
    console.log('[GeoTrace] [Fase E] Recibido en SwapContext.addProperty:', { latitude: prop.latitude, longitude: prop.longitude });

    if (useSupabase && currentUser) {
      try {
        const canPublishDirectly = currentUser.role === 'ADMIN';
        const payload = {
          ...prop,
          hostId: currentUser.id,
          hostName: currentUser.name,
          hostAvatar: currentUser.avatar,
          hostVerified: currentUser.isVerified,
          isPublished: canPublishDirectly,
          folderStatus: canPublishDirectly ? 'PUBLISHED' as const : 'UNDER_REVIEW' as const,
          auraScore: 95 + Math.floor(Math.random() * 5),
          latitude: prop.latitude !== undefined && prop.latitude !== null ? Number(prop.latitude) : 0.0,
          longitude: prop.longitude !== undefined && prop.longitude !== null ? Number(prop.longitude) : 0.0
        };
        console.log('[Publish] Enviando payload final al servicio de creación:', payload);

        const liveProp = await ServiceFactory.getPropertyService().create(payload);
        console.log('[Publish] SupabasePropertyService.create exitoso! Propiedad creada:', liveProp);

        setProperties(prev => [liveProp, ...prev]);
        setMyProperties(prev => [liveProp, ...prev]);
        return liveProp;
      } catch (err) {
        console.error('[SwapContext] Supabase addProperty failed:', err);
        throw err;
      }
    }

    const newProp: Property = {
      ...prop,
      id: `user-prop-${Date.now()}`,
      hostId: currentUser?.id || CURRENT_USER.id,
      hostName: currentUser?.name || CURRENT_USER.name,
      hostAvatar: currentUser?.avatar || CURRENT_USER.avatar,
      hostVerified: currentUser?.isVerified || CURRENT_USER.isVerified,
      hostRating: 5.0,
      hostReviewsCount: 0,
      auraScore: 95 + Math.floor(Math.random() * 5),
      latitude: prop.latitude !== undefined && prop.latitude !== null ? Number(prop.latitude) : 0.0,
      longitude: prop.longitude !== undefined && prop.longitude !== null ? Number(prop.longitude) : 0.0,
      isPublished: currentUser?.role === 'ADMIN',
      folderStatus: currentUser?.role === 'ADMIN' ? 'PUBLISHED' : 'UNDER_REVIEW',
      rules: prop.rules || [],
      reviews: []
    };

    setProperties(prev => PropertyService.create(prev, newProp));
    setMyProperties(prev => PropertyService.create(prev, newProp));
    return newProp;
  };

  const updateProperty = async (id: string, updatedFields: Partial<Property>) => {
    console.log('[Publish] SwapContext.updateProperty recibido para id:', id, updatedFields);
    if (useSupabase) {
      try {
        const liveProp = await ServiceFactory.getPropertyService().update(id, updatedFields);
        console.log('[Publish] SupabasePropertyService.update exitoso! Propiedad actualizada:', liveProp);
        setProperties(prev => prev.map(p => p.id === id ? liveProp : p));
        setMyProperties(prev => prev.map(p => p.id === id ? liveProp : p));
        return;
      } catch (err) {
        console.error('[SwapContext] Supabase updateProperty failed:', err);
        throw err;
      }
    }

    setProperties(prev => PropertyService.update(prev, id, updatedFields));
    setMyProperties(prev => PropertyService.update(prev, id, updatedFields));
  };

  const deleteProperty = async (id: string) => {
    if (useSupabase) {
      try {
        const success = await ServiceFactory.getPropertyService().delete(id);
        if (success) {
          setProperties(prev => prev.filter(p => p.id !== id));
          setMyProperties(prev => prev.filter(p => p.id !== id));
        }
        return;
      } catch (err) {
        console.error('[SwapContext] Supabase deleteProperty failed:', err);
        throw err;
      }
    }

    setProperties(prev => PropertyService.delete(prev, id));
    setMyProperties(prev => PropertyService.delete(prev, id));
  };

  const togglePublish = async (id: string) => {
    if (useSupabase) {
      try {
        const liveProp = await ServiceFactory.getPropertyService().togglePublish(id);
        setProperties(prev => prev.map(p => p.id === id ? liveProp : p));
        setMyProperties(prev => prev.map(p => p.id === id ? liveProp : p));
        return;
      } catch (err) {
        console.error('[SwapContext] Supabase togglePublish failed:', err);
        throw err;
      }
    }

    setProperties(prev => PropertyService.togglePublish(prev, id));
    setMyProperties(prev => PropertyService.togglePublish(prev, id));
  };

  const toggleFeature = async (id: string) => {
    if (useSupabase) {
      try {
        const liveProp = await ServiceFactory.getPropertyService().toggleFeature(id);
        setProperties(prev => prev.map(p => p.id === id ? liveProp : p));
        setMyProperties(prev => prev.map(p => p.id === id ? liveProp : p));
        return;
      } catch (err) {
        console.error('[SwapContext] Supabase toggleFeature failed:', err);
        throw err;
      }
    }

    setProperties(prev => PropertyService.toggleFeature(prev, id));
    setMyProperties(prev => PropertyService.toggleFeature(prev, id));
  };

  const requestSwap = async (request: Omit<SwapRequest, 'id' | 'senderId' | 'status' | 'createdAt'>): Promise<SwapRequest> => {
    const activeSenderId = currentUser?.id || CURRENT_USER.id;
    const activeSenderName = currentUser?.name || CURRENT_USER.name;

    // 1. Prevention of self-swap (prevent user from swapping with themselves)
    if (activeSenderId === request.receiverId) {
      throw new Error('No puedes proponer un intercambio con tu propia cuenta o propiedad.');
    }

    // 2. Dates Overlap Blocking Validation
    const hasOverlap = swaps.some(s => 
      ['APPROVED', 'CONFIRMED', 'ACTIVE'].includes(s.status) &&
      (s.senderPropertyId === request.senderPropertyId || s.receiverPropertyId === request.senderPropertyId || s.senderPropertyId === request.receiverPropertyId || s.receiverPropertyId === request.receiverPropertyId) &&
      ((request.startDate >= s.startDate && request.startDate <= s.endDate) ||
       (request.endDate >= s.startDate && request.endDate <= s.endDate) ||
       (request.startDate <= s.startDate && request.endDate >= s.endDate))
    );

    if (hasOverlap) {
      throw new Error('Colisión de fechas detectada. Las fechas seleccionadas ya se encuentran reservadas.');
    }

    if (useSupabase) {
      try {
        const liveSwap = await ServiceFactory.getSwapService().create({
          ...request,
          senderId: activeSenderId,
        });

        // Add to swaps state with duplicate check
        setSwaps(prev => prev.some(s => s.id === liveSwap.id) ? prev : [liveSwap, ...prev]);

        // Send welcome chat message
        const welcomeContent = request.message || `Hola, me encantaría intercambiar mi propiedad por la tuya.`;
        const liveMsg = await ServiceFactory.getMessageService().send(
          liveSwap.id,
          welcomeContent,
          activeSenderId
        );
        setMessages(prev => prev.some(m => m.id === liveMsg.id) ? prev : [...prev, liveMsg]);

        // Create persistent notification for receiver
        try {
          await ServiceFactory.getNotificationService().create({
            userId: request.receiverId,
            title: 'Nueva propuesta de intercambio 🤝',
            content: `${activeSenderName} te ha enviado una propuesta de intercambio.`
          });
        } catch (notiErr) {
          console.error('[SwapContext] Failed to send swap proposal notification:', notiErr);
        }

        return liveSwap;
      } catch (err) {
        console.error('[SwapContext] Supabase requestSwap failed:', err);
        throw err;
      }
    }

    const newRequest: SwapRequest = {
      ...request,
      id: `swap-${crypto.randomUUID()}`,
      senderId: activeSenderId,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    setSwaps(prev => [newRequest, ...prev]);

    await sendChatMessage(
      newRequest.id,
      request.message || `Hi, I'd love to swap my property "${myProperties.find(p => p.id === request.senderPropertyId)?.title || 'Shibuya Studio'}" for your "${properties.find(p => p.id === request.receiverPropertyId)?.title}"!`,
      activeSenderId
    );

    // Create local notification for receiver
    const newNoti = await ServiceFactory.getNotificationService().create({
      userId: request.receiverId,
      title: 'Nueva propuesta de intercambio 🤝',
      content: `${activeSenderName} te ha enviado una propuesta de intercambio.`
    });
    setNotifications(prev => [newNoti, ...prev]);

    return newRequest;
  };

  const updateSwapStatus = async (swapId: string, status: SwapStatus): Promise<void> => {
    const activeUserName = currentUser?.name || CURRENT_USER.name;

    if (useSupabase) {
      try {
        const liveSwap = await ServiceFactory.getSwapService().updateStatus(swapId, status);
        setSwaps(prev => prev.map(s => s.id === swapId ? liveSwap : s));

        // Send system alert chat message
        const sysMsg = await ServiceFactory.getMessageService().send(
          swapId,
          `[System Alert] This swap request has been ${status.toLowerCase()} by the host.`,
          'system'
        );
        setMessages(prev => prev.some(m => m.id === sysMsg.id) ? prev : [...prev, sysMsg]);

        // Create persistent notification for swap sender
        try {
          await ServiceFactory.getNotificationService().create({
            userId: liveSwap.senderId,
            title: `Propuesta ${status === 'APPROVED' ? 'Aceptada ✅' : 'Declinada ❌'}`,
            content: `${activeUserName} ha ${status === 'APPROVED' ? 'aceptado' : 'declinado'} tu propuesta de intercambio.`
          });
        } catch (notiErr) {
          console.error('[SwapContext] Failed to send swap status notification:', notiErr);
        }

        // Automatic approval reply message if APPROVED
        if (status === 'APPROVED') {
          setTimeout(async () => {
            try {
              const replyMsg = await ServiceFactory.getMessageService().send(
                swapId,
                `¡Fantástico! He aprobado la solicitud de intercambio. Coordinemos los detalles de entrega de llaves y recomendaciones locales pronto.`,
                liveSwap.receiverId
              );
              setMessages(prev => prev.some(m => m.id === replyMsg.id) ? prev : [...prev, replyMsg]);
            } catch (replyErr) {
              console.error('[SwapContext] Failed to send auto approval reply:', replyErr);
            }
          }, 1200);
        }
        return;
      } catch (err) {
        console.error('[SwapContext] Supabase updateSwapStatus failed:', err);
        throw err;
      }
    }

    setSwaps(prev => SwapService.updateStatus(prev, swapId, status));

    const matchedSwap = swaps.find((s) => s.id === swapId);
    if (matchedSwap) {
      await sendChatMessage(
        swapId,
        `[System Alert] This swap request has been ${status.toLowerCase()} by the host.`,
        'system'
      );

      // Create in-memory notification
      const newNoti = await ServiceFactory.getNotificationService().create({
        userId: matchedSwap.senderId,
        title: `Propuesta ${status === 'APPROVED' ? 'Aceptada ✅' : 'Declinada ❌'}`,
        content: `${activeUserName} ha ${status === 'APPROVED' ? 'aceptado' : 'declinado'} tu propuesta de intercambio.`
      });
      setNotifications(prev => [newNoti, ...prev]);

      if (status === 'APPROVED') {
        setTimeout(async () => {
          await sendChatMessage(
            swapId,
            `¡Fantástico! He aprobado la solicitud de intercambio. Coordinemos los detalles de entrega de llaves y recomendaciones locales pronto.`,
            matchedSwap.receiverId
          );
        }, 1200);
      }
    }
  };

  const deleteSwap = async (swapId: string): Promise<void> => {
    if (useSupabase) {
      try {
        const success = await ServiceFactory.getSwapService().delete(swapId);
        if (success) {
          setSwaps(prev => prev.filter(s => s.id !== swapId));
        }
        return;
      } catch (err) {
        console.error('[SwapContext] Supabase deleteSwap failed:', err);
        throw err;
      }
    }

    setSwaps(prev => SwapService.deleteSwap(prev, swapId));
  };

  const createSwapDispute = async (swapId: string, reason: string): Promise<void> => {
    if (useSupabase) {
      try {
        const liveSwap = await ServiceFactory.getSwapService().createDispute(swapId, reason);
        setSwaps(prev => prev.map(s => s.id === swapId ? liveSwap : s));

        const sysMsg = await ServiceFactory.getMessageService().send(
          swapId,
          `[Moderation Incident] A dispute has been filed for this swap request: "${reason}". Towers México administrators are reviewing the case.`,
          'system'
        );
        setMessages(prev => prev.some(m => m.id === sysMsg.id) ? prev : [...prev, sysMsg]);
        return;
      } catch (err) {
        console.error('[SwapContext] Supabase createSwapDispute failed:', err);
        throw err;
      }
    }

    setSwaps(prev => SwapService.createDispute(prev, swapId, reason));
    await sendChatMessage(
      swapId,
      `[Moderation Incident] A dispute has been filed for this swap request: "${reason}". Towers México administrators are reviewing the case.`,
      'system'
    );
  };

  const resolveSwapDispute = async (swapId: string): Promise<void> => {
    if (useSupabase) {
      try {
        const liveSwap = await ServiceFactory.getSwapService().resolveDispute(swapId);
        setSwaps(prev => prev.map(s => s.id === swapId ? liveSwap : s));

        const sysMsg = await ServiceFactory.getMessageService().send(
          swapId,
          `[Moderation Incident] The dispute for this swap request has been successfully resolved.`,
          'system'
        );
        setMessages(prev => prev.some(m => m.id === sysMsg.id) ? prev : [...prev, sysMsg]);
        return;
      } catch (err) {
        console.error('[SwapContext] Supabase resolveSwapDispute failed:', err);
        throw err;
      }
    }

    setSwaps(prev => SwapService.resolveDispute(prev, swapId));
    await sendChatMessage(
      swapId,
      `[Moderation Incident] The dispute for this swap request has been successfully resolved.`,
      'system'
    );
  };

  const sendChatMessage = async (swapRequestId: string, content: string, senderId?: string): Promise<ChatMessage> => {
    const activeSenderId = senderId || currentUser?.id || CURRENT_USER.id;
    
    if (useSupabase) {
      try {
        const liveMsg = await ServiceFactory.getMessageService().send(swapRequestId, content, activeSenderId);
        setMessages(prev => prev.some(m => m.id === liveMsg.id) ? prev : [...prev, liveMsg]);

        // Push persistent notification to the partner
        const matchedSwap = swaps.find(s => s.id === swapRequestId);
        if (matchedSwap && activeSenderId !== 'system') {
          const partnerId = matchedSwap.senderId === activeSenderId ? matchedSwap.receiverId : matchedSwap.senderId;
          const senderName = currentUser?.name || 'Otro anfitrión';
          try {
            await ServiceFactory.getNotificationService().create({
              userId: partnerId,
              title: `Nuevo mensaje de ${senderName} 💬`,
              content: content.length > 50 ? `${content.substring(0, 47)}...` : content
            });
          } catch (notiErr) {
            console.error('[SwapContext] Failed to send chat message notification:', notiErr);
          }
        }
        return liveMsg;
      } catch (err) {
        console.error('[SwapContext] Supabase sendChatMessage failed:', err);
        throw err;
      }
    }

    let senderName = 'System';
    if (activeSenderId === (currentUser?.id || CURRENT_USER.id)) {
      senderName = currentUser?.name || CURRENT_USER.name;
    } else if (activeSenderId === 'system') {
      senderName = 'Towers México';
    } else {
      const match = users.find((u) => u.id === activeSenderId) || MOCK_USERS.find((u) => u.id === activeSenderId);
      senderName = match ? match.name : 'Host';
    }

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      swapRequestId,
      senderId: activeSenderId,
      senderName,
      content,
      createdAt: new Date().toISOString(),
      isRead: false
    };

    setMessages((prev) => [...prev, newMsg]);

    // Send mock notification
    const matchedSwap = swaps.find(s => s.id === swapRequestId);
    if (matchedSwap && activeSenderId !== 'system') {
      const partnerId = matchedSwap.senderId === activeSenderId ? matchedSwap.receiverId : matchedSwap.senderId;
      const newNoti = await ServiceFactory.getNotificationService().create({
        userId: partnerId,
        title: `Nuevo mensaje de ${senderName} 💬`,
        content: content.length > 50 ? `${content.substring(0, 47)}...` : content
      });
      setNotifications(prev => [newNoti, ...prev]);
    }

    return newMsg;
  };


  const toggleFavorite = async (propertyId: string) => {
    if (useSupabase && currentUser) {
      const isFav = favorites.includes(propertyId);
      if (isFav) {
        // Remove from Supabase favorites table
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('property_id', propertyId);
        
        if (error) {
          console.error('[SwapContext] Error removing favorite from Supabase:', error.message);
          return;
        }
      } else {
        // Add to Supabase favorites table
        const { error } = await supabase
          .from('favorites')
          .insert({
            user_id: currentUser.id,
            property_id: propertyId
          });

        if (error) {
          console.error('[SwapContext] Error adding favorite to Supabase:', error.message);
          return;
        }
      }
    }

    setFavorites((prev) =>
      prev.includes(propertyId)
        ? prev.filter((id) => id !== propertyId)
        : [...prev, propertyId]
    );
  };

  const getSwapMessages = (swapRequestId: string) => {
    return messages.filter((m) => m.swapRequestId === swapRequestId);
  };

  const updateUserKyc = async (userId: string, kycStatus: 'PENDING' | 'VERIFIED' | 'FAILED') => {
    if (useSupabase) {
      try {
        const updated = await ServiceFactory.getUserService().updateVerification(userId, kycStatus === 'VERIFIED', kycStatus);
        setUsers(prev => prev.map(u => u.id === userId ? updated : u));
        if (currentUser && currentUser.id === userId) {
          setCurrentUser(updated);
        }
        return;
      } catch (err) {
        console.error('[SwapContext] Supabase kyc update failed:', err);
      }
    }
    setUsers(prev => UserService.verifyKyc(prev, userId, kycStatus));
  };

  const toggleHostVerified = async (userId: string) => {
    // 1. Mutate user verification
    if (useSupabase) {
      try {
        const targetUser = users.find(u => u.id === userId);
        if (targetUser) {
          const nextVerified = !targetUser.isVerified;
          const nextStatus = nextVerified ? 'VERIFIED' as const : 'PENDING' as const;
          const updated = await ServiceFactory.getUserService().updateVerification(userId, nextVerified, nextStatus);
          setUsers(prev => prev.map(u => u.id === userId ? updated : u));
          
          setProperties(prev => prev.map(p => p.hostId === userId ? { ...p, hostVerified: nextVerified } : p));
          setMyProperties(prev => prev.map(p => p.hostId === userId ? { ...p, hostVerified: nextVerified } : p));
          
          if (currentUser && currentUser.id === userId) {
            setCurrentUser(updated);
          }
        }
        return;
      } catch (err) {
        console.error('[SwapContext] Supabase host verification failed:', err);
      }
    }

    setUsers(prev => UserService.toggleHostVerified(prev, userId));

    // 2. Reactively find and update verified host badges across all property grids
    const targetUser = users.find(u => u.id === userId);
    if (targetUser) {
      const nextVerified = !targetUser.isVerified;
      setProperties(prev => prev.map(p => p.hostId === userId ? { ...p, hostVerified: nextVerified } : p));
      setMyProperties(prev => prev.map(p => p.hostId === userId ? { ...p, hostVerified: nextVerified } : p));
    }
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    if (useSupabase) {
      try {
        const updated = await ServiceFactory.getUserService().update(userId, { role });
        setUsers(prev => prev.map(u => u.id === userId ? updated : u));
        if (currentUser && currentUser.id === userId) {
          setCurrentUser(updated);
        }
        return;
      } catch (err) {
        console.error('[SwapContext] Supabase role update failed:', err);
      }
    }
    setUsers(prev => UserService.updateRole(prev, userId, role));
  };

  const toggleUserSuspension = (userId: string) => {
    setUsers(prev => UserService.toggleSuspension(prev, userId));
  };

  // MOCK & LIVE AUTHENTICATION ACTIONS
  const loginMock = async (email: string, password: string): Promise<boolean> => {
    searchCache.clear();
    if (useSupabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) {
        console.error('[Supabase Auth] Login error:', error.message);
        throw error; // Throw the error so the UI can catch it!
      }
      if (data.user) {
        // Fetch the auto-mirrored public profile
        const { data: profile, error: profError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profError) {
          console.error('[Supabase Auth] Profile fetch error:', profError.message);
          throw profError;
        }

        if (profile) {
          const sessionUser: User = {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            avatar: profile.avatar_url || '',
            role: profile.role || 'MEMBER',
            isVerified: profile.is_verified,
            kycStatus: profile.kyc_status || 'PENDING',
            joinDate: profile.created_at?.split('T')[0] || new Date().toLocaleDateString('es-ES'),
            swapsCount: 0,
            isSuspended: false,
            favorites: [],
            bio: profile.bio || '',
            location: profile.location || '',
          };
          setCurrentUser(sessionUser);
          setAuthReady(true);
          setAuthProfileReady(true);
          localStorage.setItem('auraswap_current_user', JSON.stringify(sessionUser));
          return true;
        }
      }
      return false;
    }

    // 1. Check in public users state
    let found = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    // 2. If not found, check pre-loaded accounts in MOCK_USERS
    if (!found) {
      found = MOCK_USERS.find(u => u.email?.toLowerCase() === email.toLowerCase());
    }

    if (found) {
      setCurrentUser(found);
      localStorage.setItem('auraswap_current_user', JSON.stringify(found));
      return true;
    }
    
    // Simulate generic logins for test emails if they don't exist yet
    if (email === 'admin@auraswap.com') {
      const adminAcc = MOCK_USERS.find(u => u.role === 'ADMIN') || CURRENT_USER;
      setCurrentUser(adminAcc);
      return true;
    } else if (email === 'host@auraswap.com') {
      const hostAcc = MOCK_USERS.find(u => u.role === 'HOST') || MOCK_USERS[0];
      setCurrentUser(hostAcc);
      return true;
    } else if (email === 'member@auraswap.com') {
      const memberAcc = MOCK_USERS.find(u => u.role === 'MEMBER') || MOCK_USERS[1];
      setCurrentUser(memberAcc);
      return true;
    }
    
    throw new Error('Invalid credentials');
  };

  const registerMock = async (
    email: string,
    name: string,
    password?: string,
    _redirectAfterVerification?: string,
  ): Promise<User> => {
    if (useSupabase) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: password || 'password', // Standard password parameter with fallback
        options: {
          data: {
            name,
            avatar_url: null,
          }
        }
      });

      if (error) {
        throw new Error(`[Supabase Auth] SignUp failed: ${error.message}`);
      }

      if (data.user) {
        // Email confirmation is disabled for this project, so a successful
        // registration must also create the authenticated session. Supabase
        // intentionally returns no session when the address already exists.
        if (!data.session) {
          setCurrentUser(null);
          localStorage.removeItem('auraswap_current_user');
          throw new Error('Ya existe una cuenta con este correo. Inicia sesión para continuar.');
        }

        // Mirrored public profiles row is auto-inserted by trigger handle_new_user
        const registeredUser: User = {
          id: data.user.id,
          name,
          email,
          avatar: '',
          role: 'MEMBER',
          isVerified: false,
          kycStatus: 'PENDING',
          joinDate: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long' }),
          swapsCount: 0,
          isSuspended: false,
          favorites: []
        };
        setCurrentUser(registeredUser);
        setAuthReady(true);
        setAuthProfileReady(true);
        localStorage.setItem('auraswap_current_user', JSON.stringify(registeredUser));
        return registeredUser;
      }
      throw new Error('[Supabase Auth] Registered user reference is undefined.');
    }

    const newUser: User = {
      id: `user-${Date.now()}`,
      name,
      email,
      avatar: '',
      role: 'MEMBER',
      isVerified: false,
      kycStatus: 'PENDING',
      joinDate: new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long' }),
      swapsCount: 0,
      isSuspended: false,
      favorites: []
    };
    
    // Add to users catalog
    setUsers(prev => {
      const updated = [...prev, newUser];
      localStorage.setItem('auraswap_users', JSON.stringify(updated));
      return updated;
    });
    
    // Set as active session
    setCurrentUser(newUser);
    setAuthReady(true);
    setAuthProfileReady(true);
    localStorage.setItem('auraswap_current_user', JSON.stringify(newUser));
    return newUser;
  };

  const logoutMock = () => {
    searchCache.clear();
    setIsLoggingOut(true);
    setLogoutToast(true);

    if (useSupabase) {
      supabase.auth.signOut().then(() => {
        setCurrentUser(null);
        localStorage.removeItem('auraswap_current_user');
        router.replace('/');
      }).catch(err => {
        console.error('[Supabase Auth] SignOut error:', err);
        setIsLoggingOut(false);
        setLogoutToast(false);
      });
      return;
    }

    setCurrentUser(null);
    localStorage.removeItem('auraswap_current_user');
    router.replace('/');
  };

  const updateProfileMock = async (updatedFields: Partial<User>) => {
    if (!currentUser) return;

    let persistedFields = updatedFields;
    if (useSupabase) {
      const persistedUser = await ServiceFactory.getUserService().update(currentUser.id, updatedFields);
      persistedFields = {
        ...updatedFields,
        name: persistedUser.name,
        avatar: persistedUser.avatar,
        bio: persistedUser.bio,
        location: persistedUser.location,
      };
    }

    const updatedUser = {
      ...currentUser,
      ...persistedFields,
    };

    setCurrentUser(updatedUser);
    localStorage.setItem('auraswap_current_user', JSON.stringify(updatedUser));

    // Sincronizar en la lista general de usuarios
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
  };

  const completeOnboardingMock = async (selectedCities: string[], bio: string, avatarUrl: string, profileType?: OnboardingProfileType) => {
    if (!currentUser) return;

    // Verification state is server-authoritative. Completing a profile never
    // turns a pending KYC submission into an approved identity.
    const wasAlreadyVerified = currentUser.kycStatus === 'VERIFIED' && currentUser.isVerified;
    const updatedUser: User = {
      ...currentUser,
      avatar: avatarUrl || currentUser.avatar,
      kycStatus: wasAlreadyVerified ? 'VERIFIED' : 'PENDING',
      isVerified: wasAlreadyVerified,
      favorites: selectedCities, // Save selected target destinations as favorites or profile metadata
      profileType: profileType || currentUser.profileType
    };

    if (useSupabase) {
      try {
        await ServiceFactory.getUserService().update(currentUser.id, {
          avatar: avatarUrl || currentUser.avatar,
          profileType: profileType || currentUser.profileType
        });
      } catch (err) {
        console.error('[SwapContext] Supabase onboarding save failed:', err);
        throw err;
      }
    }

    setCurrentUser(updatedUser);
    localStorage.setItem('auraswap_current_user', JSON.stringify(updatedUser));

    // Sync users list
    setUsers(prev => prev.map(u => u.id === currentUser.id ? updatedUser : u));
  };

  const resetPasswordMock = async (email: string): Promise<void> => {
    if (useSupabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: getAuthRedirectUrl('/reset-password')
      });
      if (error) throw error;
      return;
    }

    console.log(`[Mock Password Reset Request]: Sent recovery link to ${email}`);
    return new Promise(resolve => setTimeout(resolve, 800)); // Simulate networking
  };

  const resendVerificationEmail = async (
    email: string,
    redirectAfterVerification?: string,
  ): Promise<boolean> => {
    if (useSupabase) {
      const verifiedPath = redirectAfterVerification
        ? `/login?verified=true&intent=publish&next=${encodeURIComponent(redirectAfterVerification)}`
        : '/login?verified=true';
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: getAuthRedirectUrl(verifiedPath)
        }
      });
      if (error) {
        console.error('[Supabase Auth] Resend verification failed:', error.message);
        throw error;
      }
      return true;
    }
    console.log('[Mock Resend Verification Email]: Resending to', email);
    return true;
  };

  const markMessagesAsRead = async (swapRequestId: string): Promise<void> => {
    const activeUserId = currentUser?.id || CURRENT_USER.id;
    try {
      await ServiceFactory.getMessageService().markAsRead(swapRequestId, activeUserId);
      setMessages(prev => prev.map(m => {
        if (m.swapRequestId === swapRequestId && m.senderId !== activeUserId && !m.isRead) {
          return { ...m, isRead: true };
        }
        return m;
      }));
    } catch (err) {
      console.error('[SwapContext] Failed to mark messages as read:', err);
    }
  };

  const markNotificationAsRead = async (id: string): Promise<void> => {
    try {
      await ServiceFactory.getNotificationService().markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (err) {
      console.error('[SwapContext] Failed to mark notification as read:', err);
    }
  };

  const markAllNotificationsAsRead = async (): Promise<void> => {
    const activeUserId = currentUser?.id || CURRENT_USER.id;
    try {
      await ServiceFactory.getNotificationService().markAllAsRead(activeUserId);
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error('[SwapContext] Failed to mark all notifications as read:', err);
    }
  };

  const archiveConversation = async (swapId: string): Promise<void> => {
    if (!currentUser) return;
    try {
      if (useSupabase) {
        const { error } = await supabase
          .from('archived_conversations')
          .insert({ user_id: currentUser.id, swap_id: swapId });
        if (error) {
          console.error('[SwapContext] Supabase archive failed:', error.message);
          return;
        }
      }
      setArchivedSwapIds(prev => prev.includes(swapId) ? prev : [...prev, swapId]);
    } catch (err) {
      console.error('[SwapContext] archiveConversation failed:', err);
    }
  };

  const unarchiveConversation = async (swapId: string): Promise<void> => {
    if (!currentUser) return;
    try {
      if (useSupabase) {
        const { error } = await supabase
          .from('archived_conversations')
          .delete()
          .eq('user_id', currentUser.id)
          .eq('swap_id', swapId);
        if (error) {
          console.error('[SwapContext] Supabase unarchive failed:', error.message);
          return;
        }
      }
      setArchivedSwapIds(prev => prev.filter(id => id !== swapId));
    } catch (err) {
      console.error('[SwapContext] unarchiveConversation failed:', err);
    }
  };

  const loadTravelDetails = async (swapId: string, travelerId: string): Promise<SwapTravelDetails | null> => {
    try {
      const details = await ServiceFactory.getSwapService().getTravelDetails(swapId, travelerId);
      if (details) {
        setTravelDetails(prev => {
          const filtered = prev.filter(d => !(d.swapId === swapId && d.travelerId === travelerId));
          return [...filtered, details];
        });
      }
      return details;
    } catch (err) {
      console.error('[SwapContext] loadTravelDetails failed:', err);
      return null;
    }
  };

  const updateTravelDetails = async (details: TravelDetailsInput): Promise<SwapTravelDetails> => {
    try {
      const result = await ServiceFactory.getSwapService().upsertTravelDetails(details);
      setTravelDetails(prev => {
        const filtered = prev.filter(d => !(d.swapId === details.swapId && d.travelerId === details.travelerId));
        const next = [...filtered, result];
        if (!useSupabase) {
          localStorage.setItem('auraswap_swap_travel_details', JSON.stringify(next));
        }
        return next;
      });
      return result;
    } catch (err) {
      console.error('[SwapContext] updateTravelDetails failed:', err);
      throw err;
    }
  };

  const createLead = async (lead: Omit<Lead, 'id' | 'createdAt' | 'status' | 'userId'>): Promise<Lead> => {
    const activeUserId = currentUser?.id;
    if (!activeUserId) {
      throw new Error('Debes iniciar sesión para enviar una solicitud.');
    }

    try {
      const newLead = await ServiceFactory.getLeadService().create({
        ...lead,
        userId: activeUserId,
      });
      setLeads(prev => prev.some(existing => existing.id === newLead.id) ? prev : [newLead, ...prev]);
      return newLead;
    } catch (err) {
      console.error('[SwapContext] createLead failed:', err);
      throw err;
    }
  };

  const createReview = async (review: Omit<Review, 'id' | 'createdAt'>): Promise<Review> => {
    try {
      const liveReview = await ServiceFactory.getReviewService().create(review);
      setReviews(prev => prev.some(r => r.id === liveReview.id) ? prev : [liveReview, ...prev]);

      // Notify the reviewed user
      const reviewerName = currentUser?.name || 'Otro anfitrión';
      try {
        await ServiceFactory.getNotificationService().create({
          userId: review.reviewedUserId,
          title: `Nueva Reseña Recibida ✍️`,
          content: `${reviewerName} ha dejado una valoración de ${review.rating} estrellas sobre ti.`
        });
      } catch (notiErr) {
        console.error('[SwapContext] Failed to send review notification:', notiErr);
      }

      return liveReview;
    } catch (err) {
      console.error('[SwapContext] createReview failed:', err);
      throw err;
    }
  };

  const confirmSwapCompletion = async (swapId: string): Promise<void> => {
    const activeUserId = currentUser?.id || CURRENT_USER.id;
    const activeUserName = currentUser?.name || CURRENT_USER.name;

    try {
      const updatedSwap = await ServiceFactory.getSwapService().confirmCompletion(swapId, activeUserId);
      setSwaps(prev => prev.map(s => s.id === swapId ? updatedSwap : s));

      const partnerId = updatedSwap.senderId === activeUserId ? updatedSwap.receiverId : updatedSwap.senderId;

      if (updatedSwap.status === 'COMPLETED') {
        const sysMsg = await ServiceFactory.getMessageService().send(
          swapId,
          `[System Alert] ¡Intercambio Finalizado con éxito! Ambos anfitriones han confirmado la finalización del viaje. Las valoraciones mutuas ya están desbloqueadas.`,
          'system'
        );
        setMessages(prev => prev.some(m => m.id === sysMsg.id) ? prev : [...prev, sysMsg]);

        setTimeout(async () => {
          try {
            const promptMsg = await ServiceFactory.getMessageService().send(
              swapId,
              `¡Felicidades por completar tu intercambio! Por favor comparte tu valoración en la pestaña "Mis Reseñas" del panel para seguir construyendo una comunidad de confianza real.`,
              'system'
            );
            setMessages(prev => prev.some(m => m.id === promptMsg.id) ? prev : [...prev, promptMsg]);
          } catch (promptErr) {
            console.error('[SwapContext] Failed to send review prompt message:', promptErr);
          }
        }, 1500);

        try {
          await ServiceFactory.getNotificationService().create({
            userId: partnerId,
            title: `Intercambio Completado 🎉`,
            content: `${activeUserName} ha finalizado el viaje. ¡Las valoraciones ya están desbloqueadas!`
          });
        } catch (notiErr) {
          console.error('[SwapContext] Failed to send completion notification:', notiErr);
        }
      } else {
        try {
          await ServiceFactory.getNotificationService().create({
            userId: partnerId,
            title: `Confirmación de Finalización ⏳`,
            content: `${activeUserName} ha marcado el intercambio como finalizado. Confirma para completarlo mutuamente.`
          });
        } catch (notiErr) {
          console.error('[SwapContext] Failed to send checkout confirmation notification:', notiErr);
        }
      }
    } catch (err) {
      console.error('[SwapContext] confirmSwapCompletion failed:', err);
      throw err;
    }
  };

  return (
    <SwapContext.Provider
      value={{
        properties,
        myProperties,
        swaps,
        messages,
        favorites,
        currentUser,
        users,
        notifications,
        leads,
        createLead,
        addProperty,
        updateProperty,
        deleteProperty,
        togglePublish,
        toggleFeature,
        requestSwap,
        updateSwapStatus,
        deleteSwap,
        createSwapDispute,
        resolveSwapDispute,
        sendChatMessage,
        toggleFavorite,
        getSwapMessages,
        updateUserKyc,
        toggleHostVerified,
        updateUserRole,
        toggleUserSuspension,
        loginMock,
        registerMock,
        logoutMock,
        updateProfileMock,
        completeOnboardingMock,
        resetPasswordMock,
        resendVerificationEmail,
        markMessagesAsRead,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        isLoggingOut,
        authReady,
        authProfileReady,
        logoutToast,
        setLogoutToast,
        archivedSwapIds,
        archiveConversation,
        unarchiveConversation,
        travelDetails,
        loadTravelDetails,
        updateTravelDetails,
        reviews,
        createReview,
        confirmSwapCompletion,
        loading,
        error,
        activeSearch,
        setActiveSearch
      }}
    >
      {children}
    </SwapContext.Provider>
  );
};

export const useSwap = () => {
  const context = useContext(SwapContext);
  if (context === undefined) {
    throw new Error('useSwap must be used within a SwapProvider');
  }
  return context;
};
