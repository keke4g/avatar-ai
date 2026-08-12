export const ETERNA_OPEN_PROPERTY_VIDEO_EVENT = 'eterna:open-property-video';
export const ETERNA_SHOW_PROPERTY_VISUAL_EVENT = 'eterna:show-property-visual';
export const ETERNA_CLOSE_PROPERTY_VISUAL_EVENT = 'eterna:close-property-visual';

export type EternaPropertyVisualSection =
  | 'summary'
  | 'gallery'
  | 'description'
  | 'amenities'
  | 'technical'
  | 'media'
  | 'location'
  | 'valuation'
  | 'financing'
  | 'legal'
  | 'contact'
  | 'commercial'
  | 'market';

export interface EternaShowPropertyVisualDetail {
  propertyId: string;
  section: EternaPropertyVisualSection;
}

export interface EternaClosePropertyVisualDetail {
  propertyId: string;
  section?: EternaPropertyVisualSection;
}

export interface EternaOpenPropertyVideoDetail {
  propertyId: string;
}
