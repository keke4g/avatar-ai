'use client';

import type { FormEventHandler } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, X } from 'lucide-react';

import { useTranslation } from '@/lib/context/LanguageContext';
import { ADMIN_AMENITIES } from './adminTypes';

type AdminPropertyFormType =
  | 'Apartment'
  | 'Beach House'
  | 'Cabin'
  | 'Penthouse'
  | 'Villa'
  | 'Loft';

type AdminPropertyTier = 'Premium' | 'Luxury' | 'Exclusive' | 'Curated';

interface AdminPropertyDrawerProps {
  isOpen: boolean;
  editingPropertyId: string | null;
  title: string;
  description: string;
  type: AdminPropertyFormType;
  location: string;
  country: string;
  address: string;
  tier: AdminPropertyTier;
  imageUrls: string;
  rules: string;
  bedrooms: number;
  bathrooms: number;
  guests: number;
  amenities: string[];
  onClose: () => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onTypeChange: (value: AdminPropertyFormType) => void;
  onLocationChange: (value: string) => void;
  onCountryChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onTierChange: (value: AdminPropertyTier) => void;
  onImageUrlsChange: (value: string) => void;
  onRulesChange: (value: string) => void;
  onBedroomsChange: (value: number) => void;
  onBathroomsChange: (value: number) => void;
  onGuestsChange: (value: number) => void;
  onToggleAmenity: (amenity: string) => void;
}

export function AdminPropertyDrawer({
  isOpen,
  editingPropertyId,
  title,
  description,
  type,
  location,
  country,
  address,
  tier,
  imageUrls,
  rules,
  bedrooms,
  bathrooms,
  guests,
  amenities,
  onClose,
  onSubmit,
  onTitleChange,
  onDescriptionChange,
  onTypeChange,
  onLocationChange,
  onCountryChange,
  onAddressChange,
  onTierChange,
  onImageUrlsChange,
  onRulesChange,
  onBedroomsChange,
  onBathroomsChange,
  onGuestsChange,
  onToggleAmenity,
}: AdminPropertyDrawerProps) {
  const { t } = useTranslation();

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-brand-black z-50 cursor-pointer"
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:max-w-xl bg-white shadow-floating z-50 overflow-y-auto border-l border-brand-gray-200 flex flex-col"
          >
            <div className="p-6 border-b border-brand-gray-200/60 bg-brand-gray-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-brand-black tracking-tight">
                  {editingPropertyId ? t('admin.editPropTitle') : t('admin.addPropTitle')}
                </h3>
                <p className="text-[10px] text-brand-gray-400 font-semibold mt-0.5">
                  {t('admin.drawerDesc')}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('admin.drawerClose')}
                className="p-1.5 rounded-full hover:bg-brand-gray-200 transition-colors text-brand-gray-500 hover:text-brand-black cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="p-6 flex flex-col gap-5 overflow-y-auto flex-1">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propNameLabel')}</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(event) => onTitleChange(event.target.value)}
                  placeholder={t('admin.propNamePlaceholder')}
                  className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propTypeLabel')}</label>
                  <select
                    value={type}
                    onChange={(event) => onTypeChange(event.target.value as AdminPropertyFormType)}
                    className="w-full px-3 py-2 rounded-xl border border-brand-gray-200 text-xs font-bold"
                  >
                    <option value="Apartment">Apartment</option>
                    <option value="Beach House">Beach House</option>
                    <option value="Cabin">Cabin</option>
                    <option value="Penthouse">Penthouse</option>
                    <option value="Villa">Villa</option>
                    <option value="Loft">Loft</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propTierLabel')}</label>
                  <select
                    value={tier}
                    onChange={(event) => onTierChange(event.target.value as AdminPropertyTier)}
                    className="w-full px-3 py-2 rounded-xl border border-brand-gray-200 text-xs font-bold"
                  >
                    <option value="Premium">Premium</option>
                    <option value="Luxury">Luxury</option>
                    <option value="Exclusive">Exclusive</option>
                    <option value="Curated">Curated</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propCityLabel')}</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(event) => onLocationChange(event.target.value)}
                    placeholder={t('admin.propCityPlaceholder')}
                    className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-semibold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propCountryLabel')}</label>
                  <input
                    type="text"
                    required
                    value={country}
                    onChange={(event) => onCountryChange(event.target.value)}
                    placeholder={t('admin.propCountryPlaceholder')}
                    className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propAddressLabel')}</label>
                <input
                  type="text"
                  value={address}
                  onChange={(event) => onAddressChange(event.target.value)}
                  placeholder={t('admin.propAddressPlaceholder')}
                  className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-semibold"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propCapacityLabel')}</label>
                  <input
                    type="number"
                    min="1"
                    value={guests}
                    onChange={(event) => onGuestsChange(Number(event.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propBedsLabel')}</label>
                  <input
                    type="number"
                    min="1"
                    value={bedrooms}
                    onChange={(event) => onBedroomsChange(Number(event.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-bold"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propBathsLabel')}</label>
                  <input
                    type="number"
                    min="1"
                    value={bathrooms}
                    onChange={(event) => onBathroomsChange(Number(event.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-bold"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propDescLabel')}</label>
                <textarea
                  rows={4}
                  required
                  value={description}
                  onChange={(event) => onDescriptionChange(event.target.value)}
                  placeholder={t('admin.propDescPlaceholder')}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-xs font-medium leading-relaxed resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propImagesLabel')}</label>
                <textarea
                  rows={3}
                  value={imageUrls}
                  onChange={(event) => onImageUrlsChange(event.target.value)}
                  placeholder="https://images.unsplash.com/... (one image URL per line)"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-[10px] font-bold leading-normal resize-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">{t('admin.propRulesLabel')}</label>
                <textarea
                  rows={2}
                  value={rules}
                  onChange={(event) => onRulesChange(event.target.value)}
                  placeholder="e.g. No smoking inside..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-gray-200 focus:outline-none focus:border-brand-accent text-[10px] font-semibold leading-normal resize-none"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black text-brand-black uppercase tracking-wider">
                  {t('admin.propAmenitiesLabel')}
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {ADMIN_AMENITIES.map((amenity) => {
                    const isChecked = amenities.includes(amenity);
                    return (
                      <button
                        key={amenity}
                        type="button"
                        onClick={() => onToggleAmenity(amenity)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-[10px] font-bold text-left transition-colors cursor-pointer ${isChecked
                          ? 'bg-brand-accent/5 border-brand-accent text-brand-accent'
                          : 'bg-white border-brand-gray-200 text-brand-gray-600 hover:bg-brand-gray-50'}`}
                      >
                        <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${isChecked ? 'bg-brand-accent border-brand-accent text-white' : 'border-brand-gray-300'}`}>
                          {isChecked ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : null}
                        </div>
                        <span>{amenity}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-6 mt-4 border-t border-brand-gray-100 flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-1/3 py-3 border border-brand-gray-200 rounded-full hover:bg-brand-gray-50 text-xs font-bold text-brand-black select-none cursor-pointer"
                >
                  {t('admin.drawerClose')}
                </button>
                <button
                  type="submit"
                  className="w-2/3 py-3 rounded-full bg-brand-black hover:bg-brand-black/90 text-white font-bold text-xs tracking-wider uppercase transition-colors shadow-sm select-none cursor-pointer"
                >
                  {t('admin.propSaveBtn')}
                </button>
              </div>
            </form>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
