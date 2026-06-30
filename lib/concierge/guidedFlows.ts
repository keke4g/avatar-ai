export interface GuidedFlowDefinition {
  id: string;
  destination: string;
  completionCondition: string;
  steps?: string[];
}

export const GUIDED_FLOWS: Record<string, GuidedFlowDefinition> = {
  publish_property: {
    id: 'publish_property',
    destination: '/dashboard?tab=properties',
    completionCondition: 'property_created',
    steps: [
      'identity',
      'listing_modes',
      'basic_info',
      'features',
      'media',
      'offers'
    ]
  },

  view_properties: {
    id: 'view_properties',
    destination: '/dashboard?tab=properties',
    completionCondition: 'page_loaded'
  },

  view_messages: {
    id: 'view_messages',
    destination: '/messages',
    completionCondition: 'page_loaded'
  },

  view_trips: {
    id: 'view_trips',
    destination: '/dashboard?tab=trips',
    completionCondition: 'page_loaded'
  },

  view_swaps: {
    id: 'view_swaps',
    destination: '/dashboard?tab=swaps',
    completionCondition: 'page_loaded'
  },

  edit_profile: {
    id: 'edit_profile',
    destination: '/profile',
    completionCondition: 'profile_saved'
  },

  view_dashboard: {
    id: 'view_dashboard',
    destination: '/dashboard',
    completionCondition: 'page_loaded'
  }
};
