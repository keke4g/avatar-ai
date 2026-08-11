'use client';

import type { FormEventHandler } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Star, X } from 'lucide-react';

import { useTranslation } from '@/lib/context/LanguageContext';

interface DashboardReviewModalProps {
  isOpen: boolean;
  rating: number;
  comment: string;
  isSubmitting: boolean;
  onClose: () => void;
  onRatingChange: (rating: number) => void;
  onCommentChange: (comment: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}

export function DashboardReviewModal({
  isOpen,
  rating,
  comment,
  isSubmitting,
  onClose,
  onRatingChange,
  onCommentChange,
  onSubmit,
}: DashboardReviewModalProps) {
  const { t, language } = useTranslation();
  const ratingLabel = rating === 5
    ? language === 'es' ? '¡Excelente! 🌟' : 'Excellent! 🌟'
    : rating === 4
      ? language === 'es' ? 'Muy Bueno 👍' : 'Very Good 👍'
      : rating === 3
        ? language === 'es' ? 'Aceptable 👌' : 'Good 👌'
        : rating === 2
          ? language === 'es' ? 'Regular 😐' : 'Fair 😐'
          : language === 'es' ? 'Insatisfactorio 👎' : 'Unsatisfactory 👎';

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
        >
          <div
            className="absolute inset-0 bg-brand-black/40 backdrop-blur-sm"
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
          />
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            className="relative z-10 w-full max-w-md bg-white rounded-3xl p-6 shadow-floating border border-brand-gray-200/60 overflow-hidden flex flex-col"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-4 border-b border-brand-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                  <Star className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-brand-black tracking-tight">
                    {language === 'es' ? 'Valorar Intercambio' : 'Rate Exchange'}
                  </h3>
                  <p className="text-[10px] text-brand-gray-500 font-semibold tracking-tight uppercase">
                    {language === 'es' ? 'Reseña Inmutable' : 'Immutable Review'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                aria-label={language === 'es' ? 'Cerrar reseña' : 'Close review'}
                className="p-1.5 hover:bg-brand-gray-50 text-brand-gray-400 hover:text-brand-black rounded-xl transition-all duration-200 cursor-pointer disabled:opacity-50 bg-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="flex flex-col gap-5 pt-4">
              <div className="flex flex-col items-center gap-2">
                <span className="text-xs font-bold text-brand-gray-400 uppercase tracking-wide text-center">
                  {language === 'es' ? '¿Cómo calificarías tu experiencia?' : 'How would you rate your experience?'}
                </span>
                <div className="flex items-center gap-1.5 text-amber-400 py-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => onRatingChange(star)}
                      disabled={isSubmitting}
                      aria-label={language === 'es' ? `Calificar con ${star}` : `Rate ${star}`}
                      className="p-1 hover:scale-110 transition-transform cursor-pointer focus:outline-none"
                    >
                      <Star
                        className={`w-8 h-8 transition-colors ${star <= rating ? 'fill-current text-amber-400' : 'text-brand-gray-200 hover:text-amber-300'}`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs font-black text-brand-black">{ratingLabel}</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-brand-gray-500">
                  {language === 'es' ? 'Tu comentario verificado' : 'Your verified feedback'}
                </label>
                <textarea
                  required
                  placeholder={language === 'es'
                    ? 'Describe cómo fue la estancia, la comunicación y el intercambio. Tu reseña permanecerá fija como pilar de reputación...'
                    : 'Describe how the stay, communication, and exchange went. Your feedback will remain fixed as a pillar of reputation...'}
                  value={comment}
                  onChange={(event) => onCommentChange(event.target.value)}
                  disabled={isSubmitting}
                  className="w-full h-28 p-3 bg-white border border-brand-gray-200 rounded-xl font-medium outline-none focus:border-brand-accent transition-colors resize-none leading-relaxed text-xs cursor-text"
                  style={{ cursor: 'text', caretColor: '#6366f1', color: '#09090b' }}
                />
              </div>

              <div className="bg-brand-gray-50/80 p-3 rounded-2xl border border-brand-gray-200/40 text-[10px] text-brand-gray-500 font-medium leading-relaxed flex gap-2">
                <span className="text-lg shrink-0">🔒</span>
                <span>
                  {language === 'es'
                    ? 'Nota de Integridad: Una vez publicada, no podrás editar, modificar ni eliminar esta valoración. Únicamente administradores de Towers México podrán intervenir en disputas graves.'
                    : 'Integrity Note: Once posted, you will not be able to edit, modify, or delete this review. Only Towers México administrators can intervene under severe disputes.'}
                </span>
              </div>

              <div className="flex items-center justify-end border-t border-brand-gray-100 pt-4 shrink-0 gap-3 bg-white z-10">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-brand-gray-200 hover:bg-brand-gray-50 text-brand-gray-500 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50 bg-white"
                >
                  {t('details.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !comment.trim()}
                  className={`px-5 py-2 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 ${isSubmitting || !comment.trim() ? 'bg-brand-gray-300 cursor-not-allowed' : ''}`}
                >
                  {isSubmitting ? (
                    <span>{language === 'es' ? 'Publicando...' : 'Posting...'}</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{language === 'es' ? 'Publicar Reseña' : 'Post Review'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
