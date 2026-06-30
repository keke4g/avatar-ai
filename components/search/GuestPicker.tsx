"use client";

import React from 'react';
import { FloatingPosition } from '../../lib/floatingPosition';

type GuestPickerProps = {
  position: FloatingPosition | null;
  tempAdults: number;
  tempChildren: number;
  setTempAdults: React.Dispatch<React.SetStateAction<number>>;
  setTempChildren: React.Dispatch<React.SetStateAction<number>>;
  onCancel: () => void;
  onConfirm: () => void;
  language: 'es' | 'en';
  refObject: React.RefObject<HTMLDivElement | null>;
};

export function GuestPicker({
  position,
  tempAdults,
  tempChildren,
  setTempAdults,
  setTempChildren,
  onCancel,
  onConfirm,
  language,
  refObject,
}: GuestPickerProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const guestPickerCard = (
    <div
      ref={refObject}
      style={{
        position: isMobile ? 'relative' : 'fixed',
        zIndex: 9999,
        top: isMobile ? undefined : (position ? position.top : '20%'),
        left: isMobile ? undefined : (position ? position.left : '50%'),
        transform: isMobile ? undefined : (position ? 'none' : 'translateX(-50%)'),
        width: isMobile ? 'calc(100% - 32px)' : '256px',
        maxWidth: '384px'
      }}
      className="bg-white border border-brand-gray-200/80 rounded-[24px] shadow-2xl p-4 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 text-left select-none"
    >
      <h4 className="text-[11px] font-extrabold text-brand-black mb-4 uppercase tracking-wider">Huéspedes</h4>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-brand-black">Adultos</div>
            <div className="text-[9px] text-brand-gray-400 font-medium">Edad 13 o más</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTempAdults(prev => Math.max(1, prev - 1))}
              className="w-7 h-7 rounded-full border border-brand-gray-200 flex items-center justify-center text-brand-gray-500 hover:border-brand-accent hover:text-brand-accent transition-colors cursor-pointer text-sm font-extrabold"
            >
              -
            </button>
            <span className="text-xs font-bold text-brand-black w-4 text-center">{tempAdults}</span>
            <button
              type="button"
              onClick={() => setTempAdults(prev => prev + 1)}
              className="w-7 h-7 rounded-full border border-brand-gray-200 flex items-center justify-center text-brand-gray-500 hover:border-brand-accent hover:text-brand-accent transition-colors cursor-pointer text-sm font-extrabold"
            >
              +
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-brand-black">Niños</div>
            <div className="text-[9px] text-brand-gray-400 font-medium">Edades 2 - 12</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTempChildren(prev => Math.max(0, prev - 1))}
              className="w-7 h-7 rounded-full border border-brand-gray-200 flex items-center justify-center text-brand-gray-500 hover:border-brand-accent hover:text-brand-accent transition-colors cursor-pointer text-sm font-extrabold"
            >
              -
            </button>
            <span className="text-xs font-bold text-brand-black w-4 text-center">{tempChildren}</span>
            <button
              type="button"
              onClick={() => setTempChildren(prev => prev + 1)}
              className="w-7 h-7 rounded-full border border-brand-gray-200 flex items-center justify-center text-brand-gray-500 hover:border-brand-accent hover:text-brand-accent transition-colors cursor-pointer text-sm font-extrabold"
            >
              +
            </button>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-brand-gray-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-xl border border-brand-gray-200 hover:bg-brand-gray-50 text-[10px] font-bold text-brand-gray-500 cursor-pointer transition-colors"
          >
            {language === 'es' ? 'Cancelar' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3.5 py-1.5 rounded-xl text-[10px] font-bold text-white bg-brand-accent hover:bg-brand-accent/90 active:scale-98 shadow-sm cursor-pointer transition-colors"
          >
            {language === 'es' ? 'Confirmar' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/15 backdrop-blur-[2px] animate-in fade-in duration-200">
        {guestPickerCard}
      </div>
    );
  }

  return guestPickerCard;
}
