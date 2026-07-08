import { Property, User, SwapRequest, ChatMessage, Notification, SwapStatus, SwapTravelDetails, Lead } from '../types';
import { IPropertyService, IUserService, ISwapService, IMessageService, INotificationService, ILeadService } from './types';
import { MOCK_PROPERTIES, USER_PROPERTIES, MOCK_USERS } from '../mockData';
import { ensurePropertyOfferings, syncPropertyOfferings } from '../propertyOfferings';
import { searchProperties } from '../search/SearchEngine';
import { PropertySearchFilters, SearchResult, ProviderCapabilities } from '../search/types';
import { searchCache } from '../search/SearchCache';
import { measureExecution } from '../search/measureExecution';
import { searchLogger } from '../search/searchLogger';

// Helper to handle localStorage caching
const getStorageItem = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify(defaultValue));
    return defaultValue;
  }
  try {
    return JSON.parse(stored) as T;
  } catch (e) {
    return defaultValue;
  }
};

const setStorageItem = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
};

function enrichMockPropertiesWithLegalInfo(p: Property): Property {
  p.legalJuridicalResponsible = p.legalJuridicalResponsible || 'Lic. Alejandro Ruiz';
  p.legalLastUpdate = p.legalLastUpdate || '2026-06-25';

  if (p.id === 'prop-1' || p.id === 'user-prop-1') {
    p.legalDebtFree = p.legalDebtFree ?? true;
    p.legalPublicDeed = p.legalPublicDeed ?? true;
    p.legalTaxCurrent = p.legalTaxCurrent ?? true;
    p.legalServicesPaid = p.legalServicesPaid ?? true;
    p.legalDocumentationComplete = p.legalDocumentationComplete ?? true;
    p.legalRegime = p.legalRegime || 'Propiedad Privada';
    p.legalLandUse = p.legalLandUse || 'Residencial';
    p.legalRestrictions = p.legalRestrictions || 'Ninguna. Libre de afectaciones viales.';
    p.appraisalAmount = p.appraisalAmount || 8900000;
    p.appraisalDate = p.appraisalDate || '2026-05-12';
    p.appraisalExpert = p.appraisalExpert || 'Ing. Carlos Mendoza (Reg. 3942)';
    p.appraisalValidity = p.appraisalValidity || '2026-11-12';
    p.appreciationLevel = p.appreciationLevel || 'Alta';
    p.commercialStatus = p.commercialStatus || 'Disponible';
    p.priceHistory = p.priceHistory || {
      initialPrice: 9200000,
      currentPrice: 8900000,
      lastModificationDate: '2026-06-19',
      trend: 'DOWN'
    };
  } else if (p.id === 'prop-2') {
    p.legalDebtFree = p.legalDebtFree ?? false;
    p.legalLienType = p.legalLienType || 'Banco';
    p.legalLienObservations = p.legalLienObservations || 'Crédito hipotecario activo con saldo pendiente por liquidar de $1,200,000 MXN.';
    p.legalPublicDeed = p.legalPublicDeed ?? true;
    p.legalTaxCurrent = p.legalTaxCurrent ?? true;
    p.legalServicesPaid = p.legalServicesPaid ?? true;
    p.legalDocumentationComplete = p.legalDocumentationComplete ?? true;
    p.legalRegime = p.legalRegime || 'Condominal';
    p.legalLandUse = p.legalLandUse || 'Residencial';
    p.legalRestrictions = p.legalRestrictions || 'Sujeto a reglamento del condominio histórico.';
    p.appraisalAmount = p.appraisalAmount || 6500000;
    p.appraisalDate = p.appraisalDate || '2026-04-18';
    p.appraisalExpert = p.appraisalExpert || 'Arq. Marie Dubois';
    p.appraisalValidity = p.appraisalValidity || '2026-10-18';
    p.appreciationLevel = p.appreciationLevel || 'Media';
    p.commercialStatus = p.commercialStatus || 'En negociación';
    p.priceHistory = p.priceHistory || {
      initialPrice: 6500000,
      currentPrice: 6500000,
      lastModificationDate: '2026-04-18',
      trend: 'STABLE'
    };
  } else if (p.id === 'prop-3') {
    p.legalDebtFree = p.legalDebtFree ?? false;
    p.legalLienType = p.legalLienType || 'Infonavit';
    p.legalLienObservations = p.legalLienObservations || 'Saldo de crédito Infonavit por liquidar de $340,000 MXN en la firma.';
    p.legalPublicDeed = p.legalPublicDeed ?? true;
    p.legalTaxCurrent = p.legalTaxCurrent ?? true;
    p.legalServicesPaid = p.legalServicesPaid ?? true;
    p.legalDocumentationComplete = p.legalDocumentationComplete ?? true;
    p.legalRegime = p.legalRegime || 'Condominal';
    p.legalLandUse = p.legalLandUse || 'Residencial';
    p.legalRestrictions = p.legalRestrictions || 'Ninguna.';
    p.appraisalAmount = p.appraisalAmount || 3800000;
    p.appraisalDate = p.appraisalDate || '2026-05-30';
    p.appraisalExpert = p.appraisalExpert || 'Lic. Jaime Soto';
    p.appraisalValidity = p.appraisalValidity || '2026-11-30';
    p.appreciationLevel = p.appreciationLevel || 'Alta';
    p.commercialStatus = p.commercialStatus || 'Bajo Oferta';
    p.priceHistory = p.priceHistory || {
      initialPrice: 3600000,
      currentPrice: 3800000,
      lastModificationDate: '2026-05-30',
      trend: 'UP'
    };
  } else if (p.id === 'prop-4' || p.id === 'user-prop-2') {
    p.legalDebtFree = p.legalDebtFree ?? false;
    p.legalLienType = p.legalLienType || 'Particular';
    p.legalLienObservations = p.legalLienObservations || 'Hipoteca privada con acreedor particular activa por $150,000 USD.';
    p.legalPublicDeed = p.legalPublicDeed ?? false;
    p.legalTaxCurrent = p.legalTaxCurrent ?? false;
    p.legalServicesPaid = p.legalServicesPaid ?? false;
    p.legalDocumentationComplete = p.legalDocumentationComplete ?? false;
    p.legalRegime = p.legalRegime || 'Ejidal';
    p.legalLandUse = p.legalLandUse || 'Residencial';
    p.legalRestrictions = p.legalRestrictions || 'Derechos ejidales sujetos a la asamblea ejidal de Ubud. Sin título de propiedad inscrito en registro público.';
    p.appraisalAmount = p.appraisalAmount || 1800000;
    p.appraisalDate = p.appraisalDate || '2026-01-10';
    p.appraisalExpert = p.appraisalExpert || 'Ing. Made Sukra';
    p.appraisalValidity = p.appraisalValidity || '2026-07-10';
    p.appreciationLevel = p.appreciationLevel || 'En desarrollo';
    p.commercialStatus = p.commercialStatus || 'Bajo Oferta';
    p.priceHistory = p.priceHistory || {
      initialPrice: 1950000,
      currentPrice: 1800000,
      lastModificationDate: '2026-06-01',
      trend: 'DOWN'
    };
  } else {
    p.legalDebtFree = p.legalDebtFree ?? true;
    p.legalPublicDeed = p.legalPublicDeed ?? true;
    p.legalTaxCurrent = p.legalTaxCurrent ?? true;
    p.legalServicesPaid = p.legalServicesPaid ?? true;
    p.legalDocumentationComplete = p.legalDocumentationComplete ?? true;
    p.legalRegime = p.legalRegime || 'Propiedad Privada';
    p.legalLandUse = p.legalLandUse || 'Residencial';
    p.legalRestrictions = p.legalRestrictions || 'Ninguna.';
    p.appraisalAmount = p.appraisalAmount || 4500000;
    p.appraisalDate = p.appraisalDate || '2026-06-01';
    p.appraisalExpert = p.appraisalExpert || 'Perito Valuador Autorizado';
    p.appraisalValidity = p.appraisalValidity || '2026-12-01';
    p.appreciationLevel = p.appreciationLevel || 'Media';
    p.commercialStatus = p.commercialStatus || 'Disponible';
  }

  if (!p.brokerProfile) {
    p.brokerProfile = {
      photo: p.hostAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      name: p.hostName || 'Agente Responsable',
      company: 'AuraSwap Elite Estates',
      position: p.id === 'prop-1' ? 'Directora Comercial Premium' : 'Asesor Inmobiliario Senior',
      responseTime: 'Menos de 15 minutos',
      phone: '+52 667 392 4829',
      whatsapp: '526673924829',
      email: 'contacto@auraswap.com'
    };
  }

  return p;
}

export class InMemoryPropertyService implements IPropertyService {
  private properties: Property[] = [...USER_PROPERTIES, ...MOCK_PROPERTIES].map(ensurePropertyOfferings).map(enrichMockPropertiesWithLegalInfo);

  async getAll(): Promise<Property[]> {
    searchLogger.debug('[InMemoryPropertyService] getAll() called, returning', this.properties.length, 'properties');
    return this.properties;
  }

  async getById(id: string): Promise<Property | null> {
    const matched = this.properties.find(p => p.id === id);
    return matched || null;
  }

  async create(property: Partial<Property> & { title: string; hostId: string }): Promise<Property> {
    const media = property.media || [];
    const imagesFromMedia = media
      .filter((m: any) => m.mediaType === 'IMAGE')
      .map((m: any) => m.url);
    const finalImages = imagesFromMedia.length > 0 
      ? imagesFromMedia 
      : (property.images && property.images.length > 0 ? property.images : ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80']);

    const newProperty: Property = {
      ...property,
      id: `prop-${Date.now()}`,
      title: property.title,
      description: property.description || '',
      type: property.type || 'Apartment',
      location: property.location || '',
      country: property.country || '',
      address: property.address || '',
      valueRating: property.valueRating || 'Premium',
      media: media,
      images: finalImages,
      amenities: property.amenities || [],
      auraScore: Math.floor(Math.random() * 10) + 90, // Random premium compatibility score (90-99%)
      bedrooms: Number(property.bedrooms) || 1,
      bathrooms: Number(property.bathrooms) || 1,
      maxGuests: Number(property.maxGuests) || 2,
      hostId: property.hostId,
      hostName: property.hostName || 'Mateo Valenzuela',
      hostAvatar: property.hostAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      hostVerified: property.hostVerified ?? true,
      hostRating: property.hostRating ?? 4.95,
      hostReviewsCount: property.hostReviewsCount ?? 1,
      availableStart: property.availableStart || '2026-06-01',
      availableEnd: property.availableEnd || '2026-12-31',
      latitude: property.latitude !== undefined && property.latitude !== null ? Number(property.latitude) : null,
      longitude: property.longitude !== undefined && property.longitude !== null ? Number(property.longitude) : null,
      placeId: property.placeId ?? null,
      formattedAddress: property.formattedAddress ?? null,
      city: property.city ?? null,
      state: property.state ?? null,
      geometrySource: property.geometrySource ?? null,
      rules: property.rules || ['Be respectful of our domestic space.', 'Quiet hours after 10:00 PM.'],
      reviews: [],
      isPublished: property.isPublished ?? true,
      offerings: property.offerings || []
    };

    const hydratedProperty = ensurePropertyOfferings(newProperty);
    this.properties.unshift(hydratedProperty);
    searchCache.clear();
    return hydratedProperty;
  }

  async update(id: string, propertyData: Partial<Property>): Promise<Property> {
    const index = this.properties.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Property not found');

    const existingOfferings = this.properties[index].offerings || [];
    const newOfferingsPayload = propertyData.offerings !== undefined ? propertyData.offerings : existingOfferings;
    const syncedOfferings = syncPropertyOfferings(existingOfferings, newOfferingsPayload);

    const existingMedia = this.properties[index].media || [];
    const media = propertyData.media !== undefined ? propertyData.media : existingMedia;
    const imagesFromMedia = media
      .filter((m: any) => m.mediaType === 'IMAGE')
      .map((m: any) => m.url);
    const finalImages = imagesFromMedia.length > 0
      ? imagesFromMedia
      : (propertyData.images !== undefined ? propertyData.images : this.properties[index].images);

    const updatedProperty: Property = ensurePropertyOfferings({
      ...this.properties[index],
      ...propertyData,
      media,
      images: finalImages,
      offerings: syncedOfferings,
      // Enforce numerical conversions for form bindings
      bedrooms: propertyData.bedrooms !== undefined ? Number(propertyData.bedrooms) : this.properties[index].bedrooms,
      bathrooms: propertyData.bathrooms !== undefined ? Number(propertyData.bathrooms) : this.properties[index].bathrooms,
      maxGuests: propertyData.maxGuests !== undefined ? Number(propertyData.maxGuests) : this.properties[index].maxGuests,
    });

    this.properties[index] = updatedProperty;
    searchCache.clear();
    return updatedProperty;
  }

  async delete(id: string): Promise<boolean> {
    const initialLength = this.properties.length;
    this.properties = this.properties.filter(p => p.id !== id);
    searchCache.clear();
    return this.properties.length < initialLength;
  }

  async togglePublish(id: string): Promise<Property> {
    const index = this.properties.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Property not found');

    const nextPublished = this.properties[index].isPublished === undefined ? false : !this.properties[index].isPublished;
    this.properties[index] = ensurePropertyOfferings({
      ...this.properties[index],
      isPublished: nextPublished,
      offerings: (this.properties[index].offerings || []).map((offering) => (
        offering.mode === 'SWAP' ? { ...offering, status: nextPublished ? 'ACTIVE' : 'PAUSED' } : offering
      )),
    });
    searchCache.clear();
    return this.properties[index];
  }

  async toggleFeature(id: string): Promise<Property> {
    const index = this.properties.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Property not found');

    const isFeatured = (this.properties[index] as any).isFeatured ?? false;
    this.properties[index] = ensurePropertyOfferings({
      ...this.properties[index],
      isFeatured: !isFeatured,
      offerings: (this.properties[index].offerings || []).map((offering) => (
        offering.mode === 'SWAP' ? { ...offering, isFeatured: !isFeatured } : offering
      )),
    });
    searchCache.clear();
    return this.properties[index];
  }

  async search(filters: PropertySearchFilters): Promise<SearchResult> {
    searchLogger.debug('[InMemoryPropertyService] search() called with filters:', filters);

    const cachedResult = searchCache.get(filters);
    if (cachedResult) {
      searchLogger.debug('[InMemoryPropertyService] Returning cached SearchResult');
      return cachedResult;
    }

    const { result: filtered, executionTime } = await measureExecution(async () => {
      return searchProperties(this.properties, filters);
    });

    const searchResult: SearchResult = {
      results: filtered,
      total: filtered.length,
      filters,
      provider: 'mock',
      executionTime
    };

    searchCache.set(filters, searchResult);
    return searchResult;
  }

  async getFeatured(): Promise<Property[]> {
    return this.properties.filter(p => p.offerings?.some(o => o.isFeatured) || (p as any).isFeatured);
  }

  async getLatest(): Promise<Property[]> {
    return this.properties.slice(0, 4);
  }

  async getRecommendations(userId?: string): Promise<Property[]> {
    return this.properties.filter(p => p.hostId !== userId).slice(0, 4);
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportsRealtime: false,
      supportsGeo: false,
      supportsFuzzy: true,
      supportsRecommendations: true
    };
  }
}

export class InMemoryUserService implements IUserService {
  private key = 'auraswap_users';

  private getUsers(): User[] {
    return getStorageItem<User[]>(this.key, MOCK_USERS);
  }

  async getAll(): Promise<User[]> {
    return this.getUsers();
  }

  async getById(id: string): Promise<User | null> {
    const matched = this.getUsers().find(u => u.id === id);
    return matched || null;
  }

  async update(id: string, userData: Partial<User>): Promise<User> {
    const list = this.getUsers();
    const index = list.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');

    list[index] = { ...list[index], ...userData };
    setStorageItem(this.key, list);
    return list[index];
  }

  async updateVerification(id: string, isVerified: boolean, kycStatus: 'VERIFIED' | 'FAILED' | 'PENDING'): Promise<User> {
    const list = this.getUsers();
    const index = list.findIndex(u => u.id === id);
    if (index === -1) throw new Error('User not found');

    list[index].isVerified = isVerified;
    list[index].kycStatus = kycStatus;
    setStorageItem(this.key, list);
    return list[index];
  }
}

export class InMemorySwapService implements ISwapService {
  private key = 'auraswap_swaps';

  private getSwaps(): SwapRequest[] {
    const defaultData: SwapRequest[] = [
      {
        id: 'swap-1',
        senderId: 'host-sofia',
        senderPropertyId: 'prop-1',
        receiverId: 'current-user',
        receiverPropertyId: 'user-prop-1',
        startDate: '2026-09-10',
        endDate: '2026-09-24',
        status: 'PENDING',
        message: '¡Hola Mateo! Me encanta tu estudio en Shibuya. Ofrezco mi villa Brutalista de Cancún para esas fechas. Estaría encantada de coordinar.',
        createdAt: new Date(Date.now() - 3600000 * 24).toISOString()
      },
      {
        id: 'swap-2',
        senderId: 'current-user',
        senderPropertyId: 'user-prop-2',
        receiverId: 'host-chloe',
        receiverPropertyId: 'prop-2',
        startDate: '2026-10-05',
        endDate: '2026-10-18',
        status: 'APPROVED',
        message: 'Hello Chloé! I would love to exchange my forest cabin in Karuizawa for your historic Marais flat.',
        createdAt: new Date(Date.now() - 3600000 * 48).toISOString()
      }
    ];
    return getStorageItem<SwapRequest[]>(this.key, defaultData);
  }

  async getAll(): Promise<SwapRequest[]> {
    return this.getSwaps();
  }

  async getById(id: string): Promise<SwapRequest | null> {
    const matched = this.getSwaps().find(s => s.id === id);
    return matched || null;
  }

  async create(swap: Omit<SwapRequest, 'id' | 'createdAt' | 'status'>): Promise<SwapRequest> {
    const list = this.getSwaps();
    
    const newSwap: SwapRequest = {
      ...swap,
      id: `swap-${Date.now()}`,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };

    list.unshift(newSwap);
    setStorageItem(this.key, list);
    return newSwap;
  }

  async updateStatus(id: string, status: SwapStatus): Promise<SwapRequest> {
    const list = this.getSwaps();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Swap request not found');

    list[index].status = status;
    setStorageItem(this.key, list);
    return list[index];
  }

  async confirmCompletion(id: string, userId: string): Promise<SwapRequest> {
    const list = this.getSwaps();
    const index = list.findIndex(s => s.id === id);
    if (index === -1) throw new Error('Swap request not found');

    const swap = list[index];
    if (swap.senderId === userId) {
      swap.senderConfirmedComplete = true;
    } else if (swap.receiverId === userId) {
      swap.receiverConfirmedComplete = true;
    } else {
      throw new Error('No estás autorizado para finalizar este intercambio.');
    }

    if (swap.senderConfirmedComplete && swap.receiverConfirmedComplete) {
      swap.status = 'COMPLETED';
    }

    setStorageItem(this.key, list);
    return swap;
  }

  async delete(id: string): Promise<boolean> {
    const list = this.getSwaps();
    const filtered = list.filter(s => s.id !== id);
    setStorageItem(this.key, filtered);
    return true;
  }

  async createDispute(swapId: string, reason: string): Promise<SwapRequest> {
    const list = this.getSwaps();
    const index = list.findIndex(s => s.id === swapId);
    if (index === -1) throw new Error('Swap request not found');
    list[index].isDisputed = true;
    list[index].disputeReason = reason;
    setStorageItem(this.key, list);
    return list[index];
  }

  async resolveDispute(swapId: string): Promise<SwapRequest> {
    const list = this.getSwaps();
    const index = list.findIndex(s => s.id === swapId);
    if (index === -1) throw new Error('Swap request not found');
    list[index].isDisputed = false;
    list[index].disputeReason = undefined;
    setStorageItem(this.key, list);
    return list[index];
  }

  private travelKey = 'auraswap_swap_travel_details';

  private getTravelDetailsList(): SwapTravelDetails[] {
    return getStorageItem<SwapTravelDetails[]>(this.travelKey, []);
  }

  async getTravelDetails(swapId: string, travelerId: string): Promise<SwapTravelDetails | null> {
    const list = this.getTravelDetailsList();
    const matched = list.find(d => d.swapId === swapId && d.travelerId === travelerId);
    return matched || null;
  }

  async upsertTravelDetails(details: Partial<SwapTravelDetails> & { swapId: string; travelerId: string; propertyId: string }): Promise<SwapTravelDetails> {
    const list = this.getTravelDetailsList();
    const index = list.findIndex(d => d.swapId === details.swapId && d.travelerId === details.travelerId);
    
    let result: SwapTravelDetails;
    if (index === -1) {
      result = {
        ...details,
        id: `td-${Date.now()}`,
        checkinTime: details.checkinTime || '15:00',
        checkoutTime: details.checkoutTime || '11:00',
      } as SwapTravelDetails;
      list.push(result);
    } else {
      result = {
        ...list[index],
        ...details,
      } as SwapTravelDetails;
      list[index] = result;
    }
    
    setStorageItem(this.travelKey, list);
    return result;
  }

  async getAllTravelDetails(): Promise<SwapTravelDetails[]> {
    return this.getTravelDetailsList();
  }
}

export class InMemoryMessageService implements IMessageService {
  private key = 'auraswap_messages';

  private getMessages(): ChatMessage[] {
    return getStorageItem<ChatMessage[]>(this.key, [
      {
        id: 'msg-preload-1',
        swapRequestId: 'swap-preload-1',
        senderId: 'host-sofia',
        senderName: 'Sofia Alvarez',
        content: 'Hola Mateo! I absolutely love your Shibuya micro-loft. I am planning a research trip to Tokyo in September. Would you be open to exchanging it for my Roma Norte penthouse? It has a stunning plant-filled rooftop terrace.',
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        isRead: true
      }
    ]);
  }

  async getAllForUser(userId: string): Promise<ChatMessage[]> {
    return this.getMessages();
  }

  async send(swapRequestId: string, content: string, senderId: string): Promise<ChatMessage> {
    const list = this.getMessages();
    let senderName = 'AuraSwap';
    if (senderId === 'host-sofia') {
      senderName = 'Sofia Alvarez';
    } else if (senderId !== 'system') {
      const users = getStorageItem<User[]>('auraswap_users', MOCK_USERS);
      const matched = users.find(u => u.id === senderId);
      senderName = matched ? matched.name : 'Host';
    }

    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      swapRequestId,
      senderId,
      senderName,
      content,
      createdAt: new Date().toISOString(),
      isRead: false
    };

    list.push(newMsg);
    setStorageItem(this.key, list);
    return newMsg;
  }

  async markAsRead(swapRequestId: string, userId: string): Promise<void> {
    const list = this.getMessages();
    let updated = false;
    const updatedList = list.map(m => {
      if (m.swapRequestId === swapRequestId && m.senderId !== userId && !m.isRead) {
        updated = true;
        return { ...m, isRead: true };
      }
      return m;
    });
    if (updated) {
      setStorageItem(this.key, updatedList);
    }
  }
}

export class InMemoryLeadService implements ILeadService {
  private key = 'auraswap_leads';

  private getLeads(): Lead[] {
    return getStorageItem<Lead[]>(this.key, []);
  }

  async getAllForUser(userId: string): Promise<Lead[]> {
    return this.getLeads();
  }

  async create(lead: Omit<Lead, 'id' | 'createdAt' | 'status'>): Promise<Lead> {
    const list = this.getLeads();
    const newLead: Lead = {
      ...lead,
      id: `lead-${Date.now()}`,
      status: 'NEW',
      createdAt: new Date().toISOString(),
    };

    list.unshift(newLead);
    setStorageItem(this.key, list);
    return newLead;
  }
}

export class InMemoryNotificationService implements INotificationService {
  private key = 'auraswap_notifications';

  private getNotifications(userId: string): Notification[] {
    const defaultNotis: Notification[] = [
      {
        id: 'noti-preload-1',
        userId,
        title: 'Perfil Verificado ✨',
        content: 'Tu verificación KYC ha sido aprobada.',
        isRead: false,
        createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString()
      },
      {
        id: 'noti-preload-2',
        userId,
        title: 'Bienvenido a AuraSwap',
        content: 'Explora espacios y propone swaps sin pagar renta.',
        isRead: false,
        createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    return getStorageItem<Notification[]>(`${this.key}_${userId}`, defaultNotis);
  }

  async getAllForUser(userId: string): Promise<Notification[]> {
    return this.getNotifications(userId);
  }

  async create(notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Promise<Notification> {
    const list = this.getNotifications(notification.userId);
    const newNoti: Notification = {
      ...notification,
      id: `noti-${Date.now()}`,
      isRead: false,
      createdAt: new Date().toISOString()
    };
    list.unshift(newNoti);
    setStorageItem(`${this.key}_${notification.userId}`, list);
    return newNoti;
  }

  async markAsRead(id: string): Promise<boolean> {
    // Search notifications for all local user keys to mark
    if (typeof window === 'undefined') return false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.key)) {
        const list = JSON.parse(localStorage.getItem(key) || '[]') as Notification[];
        const index = list.findIndex(n => n.id === id);
        if (index !== -1) {
          list[index].isRead = true;
          localStorage.setItem(key, JSON.stringify(list));
          return true;
        }
      }
    }
    return false;
  }

  async markAllAsRead(userId: string): Promise<boolean> {
    const list = this.getNotifications(userId);
    const updated = list.map(n => ({ ...n, isRead: true }));
    setStorageItem(`${this.key}_${userId}`, updated);
    return true;
  }
}
