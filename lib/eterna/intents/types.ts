export interface IntentResult {
  matched: boolean;
  route?: string;
  response: string;
  action?: 'navigate' | 'data_response' | 'local_response';
}

export interface IntentPattern {
  patterns: RegExp[];
  route?: string;
  action: 'navigate' | 'data_response' | 'local_response';
  getResponse: (ctx: IntentContext, cleanPrompt?: string) => { es: string; en: string; route?: string };
}

export interface IntentContext {
  pendingSwaps: number;
  activeTrips: number;
  unreadMessages: number;
  myPropertiesCount: number;
  pendingReviews: number;
  userName: string;
  swaps: any[];
  properties: any[];
  currentUser: any;
  messages: any[];
  reviews: any[];
  travelDetails: any[];
}
