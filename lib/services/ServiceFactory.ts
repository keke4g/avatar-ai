import { IPropertyService, IUserService, ISwapService, IMessageService, INotificationService, IReviewService, ILeadService } from './types';
import { InMemoryPropertyService, InMemoryUserService, InMemorySwapService, InMemoryMessageService, InMemoryNotificationService, InMemoryLeadService } from './InMemoryServices';
import { SupabasePropertyService, SupabaseUserService, SupabaseSwapService, SupabaseMessageService, SupabaseNotificationService, SupabaseLeadService } from './SupabaseServices';
import { IStorageService, SupabaseStorageService, InMemoryStorageService } from './StorageService';
import { InMemoryReviewService, SupabaseReviewService } from './ReviewService';

// Dynamically select backend persistence model
export const useSupabase = process.env.NEXT_PUBLIC_PROPERTY_PROVIDER === 'supabase' || 
  (process.env.NEXT_PUBLIC_PROPERTY_PROVIDER === undefined && process.env.NODE_ENV === 'production');

export class ServiceFactory {
  private static _propertyService: IPropertyService;
  private static _userService: IUserService;
  private static _swapService: ISwapService;
  private static _storageService: IStorageService;
  private static _messageService: IMessageService;
  private static _notificationService: INotificationService;
  private static _reviewService: IReviewService;
  private static _leadService: ILeadService;

  public static getPropertyService(): IPropertyService {
    if (!this._propertyService) {
      this._propertyService = useSupabase
        ? new SupabasePropertyService()
        : new InMemoryPropertyService();
    }
    return this._propertyService;
  }

  public static getUserService(): IUserService {
    if (!this._userService) {
      this._userService = useSupabase
        ? new SupabaseUserService()
        : new InMemoryUserService();
    }
    return this._userService;
  }

  public static getSwapService(): ISwapService {
    if (!this._swapService) {
      this._swapService = useSupabase
        ? new SupabaseSwapService()
        : new InMemorySwapService();
    }
    return this._swapService;
  }

  public static getStorageService(): IStorageService {
    if (!this._storageService) {
      this._storageService = useSupabase
        ? new SupabaseStorageService()
        : new InMemoryStorageService();
    }
    return this._storageService;
  }

  public static getMessageService(): IMessageService {
    if (!this._messageService) {
      this._messageService = useSupabase
        ? new SupabaseMessageService()
        : new InMemoryMessageService();
    }
    return this._messageService;
  }

  public static getNotificationService(): INotificationService {
    if (!this._notificationService) {
      this._notificationService = useSupabase
        ? new SupabaseNotificationService()
        : new InMemoryNotificationService();
    }
    return this._notificationService;
  }

  public static getReviewService(): IReviewService {
    if (!this._reviewService) {
      this._reviewService = useSupabase
        ? new SupabaseReviewService()
        : new InMemoryReviewService();
    }
    return this._reviewService;
  }

  public static getLeadService(): ILeadService {
    if (!this._leadService) {
      this._leadService = useSupabase
        ? new SupabaseLeadService()
        : new InMemoryLeadService();
    }
    return this._leadService;
  }
}
