import { memo } from 'react';
import { Briefcase, Building, Home, User } from 'lucide-react';
import { motion } from 'framer-motion';
import type { WizardPublisherType } from '../types';

interface PublisherIdentityStepProps {
  publisherType: WizardPublisherType;
  onPublisherTypeChange: (publisherType: WizardPublisherType) => void;
}

const PUBLISHER_OPTIONS: Array<{
  value: WizardPublisherType;
  label: string;
  description: string;
  icon: typeof User;
}> = [
  {
    value: 'owner',
    label: 'Soy Propietario',
    description: 'Publicación directa peer-to-peer. Habilita verificación KYC y chat inmediato para swaps sin intermediarios.',
    icon: User,
  },
  {
    value: 'broker',
    label: 'Soy Agente Inmobiliario / Broker',
    description: 'Habilita múltiples anuncios bajo una sola cuenta corporativa, comisiones inmobiliarias y ruteo directo a CRM.',
    icon: Building,
  },
  {
    value: 'developer',
    label: 'Soy Desarrollador Inmobiliario',
    description: 'Promociona proyectos en fase de preventa o construcción. Botón directo para agendar visitas al showroom.',
    icon: Briefcase,
  },
  {
    value: 'property_manager',
    label: 'Soy Administrador de Propiedades / Airbnb',
    description: 'Administro propiedades de terceros para renta vacacional, renta tradicional o administración patrimonial.',
    icon: Home,
  },
];

function PublisherIdentityStepComponent({
  publisherType,
  onPublisherTypeChange,
}: PublisherIdentityStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="flex flex-col gap-5"
    >
      <div className="hidden">
        <h4 className="text-sm font-black text-brand-black uppercase tracking-wider flex items-center gap-1.5 text-brand-accent">
          <User className="w-4 h-4" />
          <span>Paso 0: Identidad y Perfil</span>
        </h4>
        <h3 className="text-lg font-bold text-brand-black mt-1">¿Quién publica esta propiedad?</h3>
        <p className="text-xs text-brand-gray-500 mt-0.5">Define tu rol para adaptar la distribución legal y las herramientas de contacto.</p>
      </div>

      <div className="flex flex-col gap-3">
        {PUBLISHER_OPTIONS.map(({ value, label, description, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onPublisherTypeChange(value)}
            className={`w-full text-left p-4 rounded-2xl border transition-all cursor-pointer flex gap-4 ${
              publisherType === value
                ? 'border-brand-accent bg-brand-accent/[0.02] shadow-sm'
                : 'border-brand-gray-200 hover:border-brand-gray-400 bg-white'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-brand-accent/5 flex items-center justify-center shrink-0">
              <Icon className="w-5 h-5 text-brand-accent" />
            </div>
            <div>
              <span className="text-xs font-bold text-brand-black block">{label}</span>
              <span className="text-[10px] text-brand-gray-500 leading-normal mt-0.5 block">{description}</span>
            </div>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

export const PublisherIdentityStep = memo(PublisherIdentityStepComponent);
