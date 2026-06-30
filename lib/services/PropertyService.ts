import { Property } from '../types';
import { ensurePropertyOfferings } from '../propertyOfferings';

export const PropertyService = {
  create(properties: Property[], newProp: Property): Property[] {
    return [ensurePropertyOfferings(newProp), ...properties.map(ensurePropertyOfferings)];
  },

  update(properties: Property[], id: string, updatedFields: Partial<Property>): Property[] {
    return properties.map((p) => (p.id === id ? ensurePropertyOfferings({ ...p, ...updatedFields }) : ensurePropertyOfferings(p)));
  },

  delete(properties: Property[], id: string): Property[] {
    return properties.filter((p) => p.id !== id);
  },

  togglePublish(properties: Property[], id: string): Property[] {
    return properties.map((p) => {
      if (p.id === id) {
        const nextPublish = p.isPublished === undefined ? false : !p.isPublished;
        return ensurePropertyOfferings({
          ...p,
          isPublished: nextPublish,
          offerings: (p.offerings || []).map((offering) => (
            offering.mode === 'SWAP' ? { ...offering, status: nextPublish ? 'ACTIVE' : 'PAUSED' } : offering
          )),
        });
      }
      return ensurePropertyOfferings(p);
    });
  },

  toggleFeature(properties: Property[], id: string): Property[] {
    return properties.map((p) => {
      if (p.id === id) {
        const isFeatured = (p as any).isFeatured;
        return ensurePropertyOfferings({
          ...p,
          isFeatured: !isFeatured,
          offerings: (p.offerings || []).map((offering) => (
            offering.mode === 'SWAP' ? { ...offering, isFeatured: !isFeatured } : offering
          )),
        });
      }
      return ensurePropertyOfferings(p);
    });
  }
};
