'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  CheckCircle2, 
  XCircle, 
  Home, 
  Map, 
  UserCheck, 
  Clock, 
  AlertTriangle 
} from 'lucide-react';
import { Property } from '../../../lib/types';
import { PropertyEligibilityEngine } from '../../../lib/services/PropertyEligibilityEngine';

interface LegalDossierSectionProps {
  property: Property;
  language: 'es' | 'en';
}

export const LegalDossierSection: React.FC<LegalDossierSectionProps> = ({
  property,
  language
}) => {
  const legalStatus = PropertyEligibilityEngine.getLegalStatus(property);

  // Status configuration mapping
  const statusConfig = {
    GREEN: {
      dotColor: 'bg-emerald-500 ring-emerald-100',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      badgeText: language === 'es' ? 'Apto para escriturar' : 'Ready to deed'
    },
    YELLOW: {
      dotColor: 'bg-amber-500 ring-amber-100',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      badgeText: language === 'es' ? 'Sujeto a evaluación' : 'Under evaluation'
    },
    RED: {
      dotColor: 'bg-rose-500 ring-rose-100',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      badgeText: language === 'es' ? 'Restricción legal' : 'Legal restriction'
    }
  };

  const config = statusConfig[legalStatus.status] || statusConfig.YELLOW;

  // Grid cards structure
  const dossierItems = [
    {
      id: 'deeds',
      label: language === 'es' ? 'Escrituras' : 'Public Deeds',
      value: property.legalPublicDeed 
        ? (language === 'es' ? 'Inscritas' : 'Registered') 
        : (language === 'es' ? 'Sin Escrituras' : 'Not Registered'),
      status: property.legalPublicDeed ? 'valid' : 'critical',
      icon: FileText
    },
    {
      id: 'taxes',
      label: language === 'es' ? 'Predial' : 'Property Tax',
      value: property.legalTaxCurrent 
        ? (language === 'es' ? 'Al corriente' : 'Up to date') 
        : (language === 'es' ? 'Con adeudo' : 'With debts'),
      status: property.legalTaxCurrent ? 'valid' : 'critical',
      icon: CheckCircle2
    },
    ...(property.legalRegime ? [{
      id: 'regime',
      label: language === 'es' ? 'Régimen' : 'Regime',
      value: property.legalRegime,
      status: 'valid',
      icon: Home
    }] : []),
    ...(property.legalLandUse ? [{
      id: 'landUse',
      label: language === 'es' ? 'Uso de suelo' : 'Land Use',
      value: property.legalLandUse,
      status: 'valid',
      icon: Map
    }] : []),
    ...(property.legalJuridicalResponsible ? [{
      id: 'responsible',
      label: language === 'es' ? 'Responsable Jurídico' : 'Juridical Responsible',
      value: property.legalJuridicalResponsible,
      status: 'valid',
      icon: UserCheck
    }] : []),
    ...(property.legalLastUpdate ? [{
      id: 'lastUpdate',
      label: language === 'es' ? 'Última actualización' : 'Last update',
      value: property.legalLastUpdate,
      status: 'valid',
      icon: Clock
    }] : [])
  ];

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { 
      opacity: 1, 
      y: 0,
      transition: { type: 'spring' as const, stiffness: 100, damping: 15 }
    }
  };

  return (
    <div className="border-b border-neutral-100 pb-8 flex flex-col gap-6">
      {/* Title Header with two levels */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${config.dotColor.split(' ')[0]} ring-4 ${config.dotColor.split(' ')[1]} shrink-0`} />
            <span>{language === 'es' ? 'Expediente Jurídico' : 'Legal Dossier'}</span>
          </h3>
          <p className="text-xs text-neutral-450 mt-1 font-medium">
            {language === 'es' ? 'Estado Legal:' : 'Legal Status:'} {legalStatus.label}
          </p>
        </div>
        
        <span className={`self-start sm:self-center px-3.5 py-1 rounded-full border text-[10px] font-black uppercase tracking-wider ${config.badgeClass} shadow-xs`}>
          {config.badgeText}
        </span>
      </div>

      {/* Grid of Independent Cards with Staggered animations */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: '-50px' }}
        className="grid grid-cols-2 md:grid-cols-3 gap-4"
      >
        {dossierItems.map((item) => {
          const Icon = item.icon;
          const isValid = item.status === 'valid';

          return (
            <motion.div
              key={item.id}
              variants={cardVariants}
              whileHover={{ y: -4, scale: 1.01, boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.03)' }}
              className="p-4 bg-white/50 backdrop-blur-xs border border-neutral-100/80 rounded-2xl flex flex-col gap-2 relative overflow-hidden transition-shadow duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="p-2 rounded-xl bg-neutral-50 text-neutral-500 shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                {isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
                )}
              </div>
              
              <div>
                <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">
                  {item.label}
                </span>
                <span className="text-xs font-black text-neutral-900 mt-0.5 block truncate">
                  {item.value}
                </span>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Timeline Warning Card */}
      {((legalStatus.warnings && legalStatus.warnings.length > 0) || property.legalRestrictions) && (
        <div className="relative mt-2 p-4 bg-amber-50/20 border border-amber-100/60 rounded-2xl flex gap-3.5 overflow-hidden transition-all hover:bg-amber-50/30">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-amber-400" />
          
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0 h-fit">
            <AlertTriangle className="w-4 h-4" />
          </div>

          <div className="flex flex-col gap-1.5 text-xs text-amber-900 font-medium">
            <span className="font-extrabold uppercase tracking-wider text-[10px] text-amber-800">
              {language === 'es' ? 'Observaciones de Expediente' : 'Dossier Observations'}
            </span>
            
            {property.legalRestrictions && (
              <p className="leading-relaxed font-semibold">{property.legalRestrictions}</p>
            )}

            {legalStatus.warnings && legalStatus.warnings.length > 0 && (
              <ul className="list-disc list-inside flex flex-col gap-1 mt-1 font-bold text-amber-850">
                {legalStatus.warnings.map((w, idx) => (
                  <li key={idx} className="leading-snug">{w}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
