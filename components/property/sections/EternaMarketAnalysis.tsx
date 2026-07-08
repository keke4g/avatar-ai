'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  TrendingUp, 
  AlertCircle, 
  Gem, 
  Zap, 
  Clock, 
  Activity 
} from 'lucide-react';
import { Property } from '../../../lib/types';

interface EternaMarketAnalysisProps {
  property: Property;
  language: 'es' | 'en';
}

export const EternaMarketAnalysis: React.FC<EternaMarketAnalysisProps> = ({
  property,
  language
}) => {
  // Determine text parameters based on property data
  const isProp1 = property.id === 'prop-1';
  const hasDebt = property.legalDebtFree === false;

  const strengthText = isProp1
    ? (language === 'es' ? 'Acceso directo a playa privada y alta plusvalía proyectada.' : 'Direct access to private beach and high projected appreciation.')
    : (language === 'es' ? 'Ubicación premium con alta demanda de rentas y plusvalía sólida.' : 'Premium location with high rental demand and solid appreciation.');

  const opportunityText = hasDebt
    ? (language === 'es' ? 'Requiere liquidación del gravamen actual durante la firma notarial.' : 'Requires liquidation of the current lien during the notary signing.')
    : (language === 'es' ? 'Optimizar costos de mantenimiento mensual para maximizar el cap rate.' : 'Optimize monthly maintenance fees to maximize the cap rate.');

  const recommendationText = isProp1
    ? (language === 'es' ? 'Excelente oportunidad para compradores patrimoniales de alta gama.' : 'Excellent opportunity for high-end residential buyers.')
    : (language === 'es' ? 'Ideal para inversionistas que buscan flujos de efectivo recurrentes.' : 'Ideal for investors seeking recurring cash flow streams.');

  // Executive summary text
  const executiveSummary = isProp1
    ? (language === 'es' 
        ? 'Eterna detecta que esta propiedad frente al mar representa un activo único en su zona, con una absorción comercial acelerada y un índice de plusvalía anual que supera de forma destacada el promedio histórico regional.'
        : 'Eterna detects that this beachfront property represents a unique asset in its area, with accelerated commercial absorption and a capital appreciation rate that outstandingly exceeds the historical regional average.')
    : (language === 'es'
        ? 'Eterna detecta que esta propiedad se encuentra en una zona de alta plusvalía, con excelente absorción comercial y una velocidad de venta superior al promedio del mercado.'
        : 'Eterna detects that this property is located in a high-appreciation area, with excellent commercial absorption and a sales velocity above the market average.');

  // Metric values
  const speedLabel = isProp1 
    ? (language === 'es' ? 'Rápida' : 'Fast') 
    : (language === 'es' ? 'Media-Alta' : 'Moderate-High');
  const speedPercentage = isProp1 ? 88 : 72; // Apple progress marker position percentage

  const estDays = isProp1 
    ? (language === 'es' ? '45-60 días' : '45-60 days') 
    : (language === 'es' ? '60-90 días' : '60-90 days');
  const daysCount = isProp1 ? 52 : 75;

  const appreciationRate = isProp1 ? '8.5%' : '8.2%';
  const appreciationValue = isProp1 ? 8.5 : 8.2;

  const liquidityLabel = isProp1 
    ? (language === 'es' ? 'Alta' : 'High') 
    : (language === 'es' ? 'Media-Alta' : 'Moderate-High');

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 100, damping: 15 } }
  };

  return (
    <div className="bg-gradient-to-br from-neutral-50/60 to-white/90 border border-neutral-100/60 rounded-3xl p-6 flex flex-col gap-6 shadow-xs mb-6">
      
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-neutral-100/60 pb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-neutral-900 text-amber-400 shrink-0">
            <Sparkles className="w-4 h-4 shrink-0" />
          </div>
          <div>
            <h3 className="text-xs font-black text-neutral-900 uppercase tracking-wider">
              {language === 'es' ? 'Análisis de Inteligencia Inmobiliaria' : 'Real Estate AI Analysis'}
            </h3>
            <p className="text-[10px] text-neutral-450 font-semibold mt-0.5">
              {language === 'es' ? 'Analizado por Eterna IA • Actualizado hace unos segundos' : 'Analyzed by Eterna AI • Updated seconds ago'}
            </p>
          </div>
        </div>
      </div>

      {/* Executive Summary Quote */}
      <div className="border-l-2 border-neutral-300 pl-4 py-0.5">
        <p className="text-xs font-semibold text-neutral-600 leading-relaxed italic">
          &ldquo;{executiveSummary}&rdquo;
        </p>
      </div>

      {/* Three Horizontal/Grid Executive Cards */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-50px' }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {/* 1. Strength */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          className="p-4 bg-emerald-50/10 border border-emerald-100/50 rounded-2xl flex flex-col gap-2.5 transition-all"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black uppercase text-emerald-800 tracking-wider">
              {language === 'es' ? 'Fortaleza Principal' : 'Key Strength'}
            </span>
          </div>
          <p className="text-xs font-bold text-neutral-800 leading-relaxed">
            {strengthText}
          </p>
        </motion.div>

        {/* 2. Opportunity */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          className="p-4 bg-amber-50/10 border border-amber-100/50 rounded-2xl flex flex-col gap-2.5 transition-all"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black uppercase text-amber-800 tracking-wider">
              {language === 'es' ? 'Área de Oportunidad' : 'Opportunity Area'}
            </span>
          </div>
          <p className="text-xs font-bold text-neutral-800 leading-relaxed">
            {opportunityText}
          </p>
        </motion.div>

        {/* 3. Recommendation */}
        <motion.div
          variants={cardVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          className="p-4 bg-purple-50/10 border border-purple-100/50 rounded-2xl flex flex-col gap-2.5 transition-all"
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 shrink-0">
              <Gem className="w-4 h-4" />
            </div>
            <span className="text-[9px] font-black uppercase text-purple-800 tracking-wider">
              {language === 'es' ? 'Recomendación IA' : 'AI Recommendation'}
            </span>
          </div>
          <p className="text-xs font-bold text-neutral-800 leading-relaxed">
            {recommendationText}
          </p>
        </motion.div>
      </motion.div>

      {/* Divider */}
      <div className="border-t border-neutral-100/60 my-1" />

      {/* Apple-style Minimalist Metrics Block */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-semibold text-neutral-600">
        
        {/* Velocidad Comercial */}
        <div className="flex flex-col p-4 bg-white/40 border border-neutral-100/50 rounded-2xl gap-3">
          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">
            {language === 'es' ? 'Velocidad Comercial' : 'Commercial Velocity'}
          </span>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-black text-neutral-900">{speedLabel}</span>
            {/* Apple minimalist indicator slider */}
            <div className="w-full bg-neutral-100 h-1 rounded-full relative overflow-hidden mt-1" aria-hidden="true">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${speedPercentage}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="bg-neutral-800 h-full rounded-full"
              />
            </div>
          </div>
        </div>

        {/* Tiempo Estimado */}
        <div className="flex flex-col p-4 bg-white/40 border border-neutral-100/50 rounded-2xl gap-3">
          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">
            {language === 'es' ? 'Tiempo Estimado' : 'Est. Days on Market'}
          </span>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
            <data value={daysCount} className="text-xs font-black text-neutral-900">
              {estDays}
            </data>
          </div>
        </div>

        {/* Plusvalía Anual */}
        <div className="flex flex-col p-4 bg-white/40 border border-neutral-100/50 rounded-2xl gap-3">
          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">
            {language === 'es' ? 'Plusvalía Anual' : 'Annual Appreciation'}
          </span>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-neutral-400 shrink-0" />
            <data value={appreciationValue} className="text-xs font-black text-emerald-600">
              {appreciationRate}
            </data>
          </div>
        </div>

        {/* Liquidez */}
        <div className="flex flex-col p-4 bg-white/40 border border-neutral-100/50 rounded-2xl gap-3">
          <span className="text-[9px] font-black uppercase text-neutral-400 tracking-wider">
            {language === 'es' ? 'Liquidez' : 'Liquidity Level'}
          </span>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-neutral-400 shrink-0" />
            <span className="text-xs font-black text-neutral-900">
              {liquidityLabel}
            </span>
          </div>
        </div>

      </div>

    </div>
  );
};
