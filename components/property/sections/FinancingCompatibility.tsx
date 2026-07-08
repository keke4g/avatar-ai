'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Award, 
  Coins, 
  Building, 
  CheckCircle, 
  HelpCircle, 
  XCircle, 
  X, 
  Info,
  ChevronRight,
  TrendingUp,
  Percent,
  Users
} from 'lucide-react';
import { Property } from '../../../lib/types';
import { PropertyEligibilityEngine } from '../../../lib/services/PropertyEligibilityEngine';

interface FinancingCompatibilityProps {
  property: Property;
  language: 'es' | 'en';
}

export const FinancingCompatibility: React.FC<FinancingCompatibilityProps> = ({
  property,
  language
}) => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const credits = PropertyEligibilityEngine.calculateEligibleCredits(property);

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDrawerOpen(false);
      }
    };
    if (isDrawerOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen]);

  // Credit Tooltip Descriptions mapping
  const creditDetailsEs: Record<string, { desc: string; icon: any }> = {
    'Contado': {
      desc: 'Adquisición inmediata mediante transferencia electrónica, cheque de caja o recursos propios.',
      icon: Coins
    },
    'Crédito Bancario': {
      desc: 'Financiamiento hipotecario tradicional con cualquier institución bancaria comercial de tu elección.',
      icon: Building
    },
    'Crédito Hipotecario Bancario': {
      desc: 'Financiamiento hipotecario tradicional con cualquier institución bancaria comercial de tu elección.',
      icon: Building
    },
    'Unamos Créditos': {
      desc: 'Permite juntar el monto de tu crédito Infonavit con el de un familiar, pareja o amigo para mayor capacidad.',
      icon: Users
    },
    'Cofinavit': {
      desc: 'Esquema cofinanciado que une un crédito de Infonavit con un crédito de un banco comercial.',
      icon: Percent
    },
    'Infonavit Individual': {
      desc: 'Crédito tradicional otorgado de forma individual por el Infonavit.',
      icon: Award
    },
    'Infonavit Conyugal': {
      desc: 'Permite unir tu capacidad crediticia de Infonavit con la de tu cónyuge legalmente casado.',
      icon: Users
    },
    'FOVISSSTE': {
      desc: 'Esquema tradicional para trabajadores del Estado, sujeto a precalificación y convocatorias anuales.',
      icon: Award
    },
    'FOVISSSTE para Todos': {
      desc: 'Crédito cofinanciado entre FOVISSSTE y una institución bancaria comercial.',
      icon: Building
    },
    'Crédito Mixto': {
      desc: 'Financiamiento que combina recursos de la subcuenta de vivienda y préstamos bancarios.',
      icon: TrendingUp
    },
    'Crédito mixto Banco + Infonavit': {
      desc: 'Financiamiento que combina recursos de la subcuenta de vivienda de Infonavit y préstamos bancarios.',
      icon: TrendingUp
    },
    'Crédito mixto Banco + FOVISSSTE': {
      desc: 'Financiamiento que combina recursos de la subcuenta de vivienda de FOVISSSTE y préstamos bancarios.',
      icon: TrendingUp
    }
  };

  const creditDetailsEn: Record<string, { desc: string; icon: any }> = {
    'Contado': {
      desc: 'Immediate purchase through electronic transfer, cashier check, or personal funds.',
      icon: Coins
    },
    'Crédito Bancario': {
      desc: 'Standard mortgage financing with any commercial banking institution of your choice.',
      icon: Building
    },
    'Crédito Hipotecario Bancario': {
      desc: 'Standard mortgage financing with any commercial banking institution of your choice.',
      icon: Building
    },
    'Unamos Créditos': {
      desc: 'Allows combining your Infonavit credit capacity with a relative, partner, or friend for higher capacity.',
      icon: Users
    },
    'Cofinavit': {
      desc: 'Co-financed scheme combining an Infonavit credit with a commercial bank mortgage credit.',
      icon: Percent
    },
    'Infonavit Individual': {
      desc: 'Traditional individual mortgage credit granted directly by Infonavit.',
      icon: Award
    },
    'Infonavit Conyugal': {
      desc: 'Allows combining your Infonavit credit capacity with your legally married spouse.',
      icon: Users
    },
    'FOVISSSTE': {
      desc: 'Traditional scheme for state workers, subject to pre-qualification and annual fund calls.',
      icon: Award
    },
    'FOVISSSTE para Todos': {
      desc: 'Co-financed credit between FOVISSSTE and a commercial banking institution.',
      icon: Building
    },
    'Crédito Mixto': {
      desc: 'Financing combining housing subaccount funds and bank loans.',
      icon: TrendingUp
    },
    'Crédito mixto Banco + Infonavit': {
      desc: 'Financing combining housing subaccount funds of Infonavit and bank loans.',
      icon: TrendingUp
    },
    'Crédito mixto Banco + FOVISSSTE': {
      desc: 'Financing combining housing subaccount funds of FOVISSSTE and bank loans.',
      icon: TrendingUp
    }
  };

  const getCreditDetails = (creditName: string) => {
    const dict = language === 'es' ? creditDetailsEs : creditDetailsEn;
    return dict[creditName] || {
      desc: language === 'es' 
        ? 'Financiamiento sujeto a precalificación y políticas internas de la institución.'
        : 'Financing subject to pre-qualification and internal policies of the institution.',
      icon: Award
    };
  };

  // Animations configuration
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.08 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } }
  };

  return (
    <div className="border-b border-neutral-100 pb-8 flex flex-col gap-6 animate-in fade-in duration-300">
      {/* Title & Subtitle block */}
      <div>
        <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
          <Award className="w-5 h-5 text-neutral-800 shrink-0" />
          <span>{language === 'es' ? 'Financiamiento Compatible' : 'Compatible Financing'}</span>
        </h3>
        <p className="text-xs text-neutral-450 mt-1.5 leading-relaxed font-medium max-w-xl">
          {language === 'es'
            ? 'Eterna analizó automáticamente el expediente jurídico para determinar los métodos de adquisición compatibles.'
            : 'Eterna automatically analyzed the legal dossier to determine eligible acquisition and financing methods.'}
        </p>
      </div>

      {/* Grid of Compatible Cards (Green status only) */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-50px' }}
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4"
      >
        {credits.compatibles.map((c) => {
          const details = getCreditDetails(c);
          const Icon = details.icon;

          return (
            <motion.div
              key={c}
              variants={itemVariants}
              whileHover={{ y: -4, scale: 1.01, boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.03)' }}
              className="p-5 bg-white/50 backdrop-blur-xs border border-neutral-100/80 rounded-2xl flex flex-col gap-3 transition-shadow duration-300 group"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-neutral-50 text-neutral-600 group-hover:text-emerald-600 group-hover:bg-emerald-50/50 transition-colors shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[9px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100/40">
                  {language === 'es' ? 'Listo' : 'Eligible'}
                </span>
              </div>
              
              <div>
                <h4 className="text-xs font-black text-neutral-900 tracking-tight">
                  {c}
                </h4>
                <p className="text-[10px] text-neutral-400 font-semibold leading-normal mt-1">
                  {details.desc}
                </p>
              </div>

              <div className="mt-auto pt-2 border-t border-neutral-50 flex items-center gap-1.5 text-[9px] font-extrabold text-emerald-700">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>{language === 'es' ? 'Compatible' : 'Compatible'}</span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Elegant Drawer Trigger Button */}
      <button
        type="button"
        onClick={() => setIsDrawerOpen(true)}
        className="flex items-center gap-2 self-start py-2.5 px-4 rounded-xl border border-neutral-200 text-xs font-extrabold text-neutral-600 hover:text-neutral-950 hover:bg-neutral-50/50 hover:border-neutral-350 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-neutral-950 transition-all cursor-pointer"
      >
        <span>
          {language === 'es' 
            ? 'Ver todos los métodos de financiamiento' 
            : 'View all financing methods'}
        </span>
        <ChevronRight className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" />
      </button>

      {/* Info Footnote */}
      <span className="text-[10px] text-neutral-400 font-semibold leading-normal flex items-start gap-2 border-t border-neutral-100 pt-4">
        <Info className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
        <span>
          {language === 'es'
            ? 'La aprobación final de cualquier crédito dependerá de la institución financiera y del perfil del comprador.'
            : 'Final approval of any credit will depend on the financial institution and the buyer\'s credit profile.'}
        </span>
      </span>

      {/* Sliding Glassmorphic Slide-over Drawer (Sheet) */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-neutral-950/20 backdrop-blur-xs z-100 cursor-pointer"
            />

            {/* Slide-over Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="drawer-title"
              className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white/80 backdrop-blur-xl shadow-2xl z-101 border-l border-neutral-100 flex flex-col h-full overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-neutral-100 flex items-center justify-between">
                <div>
                  <h4 id="drawer-title" className="text-sm font-black text-neutral-900">
                    {language === 'es' ? 'Análisis de Financiamiento' : 'Financing Analysis'}
                  </h4>
                  <p className="text-[10px] text-neutral-450 font-semibold mt-1">
                    {language === 'es' ? 'Corrida de elegibilidad automática' : 'Automatic eligibility run'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 rounded-xl hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-neutral-950 cursor-pointer"
                  aria-label={language === 'es' ? 'Cerrar panel' : 'Close panel'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                
                {/* 1. Compatibles (Green) */}
                <div className="flex flex-col gap-3.5">
                  <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider block">
                    {language === 'es' ? 'Compatibles (Listos para uso)' : 'Compatible (Ready for use)'}
                  </span>
                  
                  <div className="flex flex-col gap-3">
                    {credits.compatibles.map((c) => {
                      const details = getCreditDetails(c);
                      const Icon = details.icon;
                      return (
                        <div key={c} className="p-4 bg-emerald-50/15 border border-emerald-100 rounded-2xl flex gap-3">
                          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0 h-fit">
                            <Icon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="text-xs font-black text-neutral-900 block">{c}</span>
                            <p className="text-[10px] text-neutral-500 leading-normal font-semibold mt-1">{details.desc}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Sujetos a Evaluación (Yellow) */}
                {credits.evaluables.length > 0 && (
                  <div className="flex flex-col gap-3.5">
                    <span className="text-[9px] font-black uppercase text-amber-700 tracking-wider block">
                      {language === 'es' ? 'Sujetos a Evaluación' : 'Subject to Evaluation'}
                    </span>
                    
                    <div className="flex flex-col gap-3">
                      {credits.evaluables.map((c) => {
                        const details = getCreditDetails(c);
                        const Icon = details.icon;
                        return (
                          <div key={c} className="p-4 bg-amber-50/15 border border-amber-100 rounded-2xl flex gap-3">
                            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0 h-fit">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-black text-neutral-900 block">{c}</span>
                              <p className="text-[10px] text-neutral-500 leading-normal font-semibold mt-1">{details.desc}</p>
                              <span className="inline-flex items-center gap-1 mt-2 text-[9px] font-extrabold text-amber-700">
                                <HelpCircle className="w-3.5 h-3.5" />
                                <span>{language === 'es' ? 'Compatible con validación' : 'Requires validation'}</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. No Compatibles (Red) */}
                {credits.noCompatibles.length > 0 && (
                  <div className="flex flex-col gap-3.5 font-medium">
                    <span className="text-[9px] font-black uppercase text-rose-700 tracking-wider block">
                      {language === 'es' ? 'No Compatibles' : 'Not Eligible'}
                    </span>
                    
                    <div className="flex flex-col gap-3">
                      {credits.noCompatibles.map((item) => {
                        const details = getCreditDetails(item.credit);
                        const Icon = details.icon;
                        return (
                          <div key={item.credit} className="p-4 bg-rose-50/15 border border-rose-100 rounded-2xl flex gap-3">
                            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 shrink-0 h-fit">
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="text-xs font-black text-neutral-900 block">{item.credit}</span>
                              <p className="text-[10px] text-neutral-550 leading-normal font-semibold mt-1">
                                {language === 'es' ? `Motivo: ${item.reason}` : `Reason: ${item.reason}`}
                              </p>
                              <span className="inline-flex items-center gap-1 mt-2 text-[9px] font-extrabold text-rose-700">
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{language === 'es' ? 'No compatible' : 'Ineligible'}</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
