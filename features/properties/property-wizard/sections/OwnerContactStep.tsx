import { memo, type Dispatch, type RefObject, type SetStateAction } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock3, Contact, KeyRound, Mail, Phone, StickyNote, User } from 'lucide-react';

import { CustomSelect } from '../components/CustomSelect';

interface OwnerContactStepProps {
  ownerAppointmentNoticeHours: number | '';
  ownerContactPreference: string;
  ownerEmail: string;
  ownerExtraNotes: string;
  ownerFullName: string;
  ownerHasKeys: 'unknown' | 'yes' | 'no';
  ownerOccupancyStatus: string;
  ownerPhone: string;
  ownerRelationship: string;
  ownerViewingDays: string[];
  ownerViewingEndTime: string;
  ownerViewingStartTime: string;
  ownerVisitInstructions: string;
  scrollAreaRef: RefObject<HTMLDivElement | null>;
  setOwnerAppointmentNoticeHours: Dispatch<SetStateAction<number | ''>>;
  setOwnerContactPreference: Dispatch<SetStateAction<string>>;
  setOwnerEmail: Dispatch<SetStateAction<string>>;
  setOwnerExtraNotes: Dispatch<SetStateAction<string>>;
  setOwnerFullName: Dispatch<SetStateAction<string>>;
  setOwnerHasKeys: Dispatch<SetStateAction<'unknown' | 'yes' | 'no'>>;
  setOwnerOccupancyStatus: Dispatch<SetStateAction<string>>;
  setOwnerPhone: Dispatch<SetStateAction<string>>;
  setOwnerRelationship: Dispatch<SetStateAction<string>>;
  setOwnerViewingDays: Dispatch<SetStateAction<string[]>>;
  setOwnerViewingEndTime: Dispatch<SetStateAction<string>>;
  setOwnerViewingStartTime: Dispatch<SetStateAction<string>>;
  setOwnerVisitInstructions: Dispatch<SetStateAction<string>>;
}

function OwnerContactStepComponent({
  ownerAppointmentNoticeHours,
  ownerContactPreference,
  ownerEmail,
  ownerExtraNotes,
  ownerFullName,
  ownerHasKeys,
  ownerOccupancyStatus,
  ownerPhone,
  ownerRelationship,
  ownerViewingDays,
  ownerViewingEndTime,
  ownerViewingStartTime,
  ownerVisitInstructions,
  scrollAreaRef,
  setOwnerAppointmentNoticeHours,
  setOwnerContactPreference,
  setOwnerEmail,
  setOwnerExtraNotes,
  setOwnerFullName,
  setOwnerHasKeys,
  setOwnerOccupancyStatus,
  setOwnerPhone,
  setOwnerRelationship,
  setOwnerViewingDays,
  setOwnerViewingEndTime,
  setOwnerViewingStartTime,
  setOwnerVisitInstructions,
}: OwnerContactStepProps) {
  return (
    <motion.div
      key="step-owner-contact"
      initial={{ opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -15 }}
      className="flex flex-col gap-4"
    >
      <div className="hidden">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="flex items-center gap-1.5 text-sm font-black uppercase tracking-wider text-brand-accent">
            <Contact className="h-4 w-4" />
            <span>Datos del propietario o encargado legal</span>
          </h4>
          <span className="rounded-full border border-brand-gray-200 bg-brand-gray-50 px-2.5 py-1 text-[8px] font-black uppercase tracking-wider text-brand-gray-500">
            Opcional
          </span>
        </div>
        <p className="mt-1 text-xs font-medium leading-relaxed text-brand-gray-500">
          Información operativa privada para coordinar la captación y las visitas. No se mostrará en el anuncio.
        </p>
      </div>

      <section className="rounded-2xl border border-violet-200/70 bg-gradient-to-br from-violet-50/80 via-white to-white p-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
            <User className="h-4 w-4" />
          </span>
          <div>
            <h5 className="text-xs font-black text-brand-black">Persona responsable</h5>
            <p className="mt-0.5 text-[10px] font-medium leading-relaxed text-brand-gray-500">
              Registra únicamente los datos que tengas disponibles.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-600">¿Quién es tu contacto?</label>
            <CustomSelect
              value={ownerRelationship}
              onChange={setOwnerRelationship}
              options={[
                { value: '', label: 'Sin especificar' },
                { value: 'OWNER', label: 'Propietario(a)' },
                { value: 'FAMILY', label: 'Familiar' },
                { value: 'LEGAL_REPRESENTATIVE', label: 'Apoderado(a) legal' },
                { value: 'HEIR', label: 'Heredero(a)' },
                { value: 'EXECUTOR', label: 'Albacea' },
                { value: 'DEVELOPER', label: 'Desarrollador(a)' },
                { value: 'PROPERTY_MANAGER', label: 'Administrador(a) del inmueble' },
                { value: 'MANAGER', label: 'Gerente' },
                { value: 'FLOOR_ADVISOR', label: 'Asesor(a) de piso' },
                { value: 'OTHER', label: 'Otro' },
              ]}
              scrollContainerRef={scrollAreaRef}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="owner-full-name" className="text-xs font-bold text-brand-gray-600">Nombre completo</label>
            <input
              id="owner-full-name"
              type="text"
              autoComplete="name"
              value={ownerFullName}
              onChange={(event) => setOwnerFullName(event.target.value)}
              placeholder="Ej. María González López"
              className="w-full rounded-xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="owner-phone" className="flex items-center gap-1.5 text-xs font-bold text-brand-gray-600">
              <Phone className="h-3.5 w-3.5" /> Número de contacto
            </label>
            <input
              id="owner-phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              value={ownerPhone}
              onChange={(event) => setOwnerPhone(event.target.value)}
              placeholder="Ej. +52 667 123 4567"
              className="w-full rounded-xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="owner-email" className="flex items-center gap-1.5 text-xs font-bold text-brand-gray-600">
              <Mail className="h-3.5 w-3.5" /> Correo
            </label>
            <input
              id="owner-email"
              type="email"
              autoComplete="email"
              value={ownerEmail}
              onChange={(event) => setOwnerEmail(event.target.value)}
              placeholder="correo@ejemplo.com"
              className="w-full rounded-xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10"
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label className="text-xs font-bold text-brand-gray-600">Medio de contacto preferido</label>
            <CustomSelect
              value={ownerContactPreference}
              onChange={setOwnerContactPreference}
              options={[
                { value: '', label: 'Sin preferencia' },
                { value: 'WHATSAPP', label: 'WhatsApp' },
                { value: 'PHONE', label: 'Llamada telefónica' },
                { value: 'SMS', label: 'Mensaje SMS' },
                { value: 'EMAIL', label: 'Correo electrónico' },
              ]}
              scrollContainerRef={scrollAreaRef}
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-brand-gray-200 bg-brand-gray-50/65 p-4">
        <div className="mb-4 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-brand-gray-200 bg-white text-brand-black shadow-sm">
            <Calendar className="h-4 w-4" />
          </span>
          <div>
            <h5 className="text-xs font-black text-brand-black">Disponibilidad para visitas</h5>
            <p className="mt-0.5 text-[10px] font-medium text-brand-gray-500">Selecciona días, horario y condiciones de acceso.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ['MONDAY', 'Lun'],
            ['TUESDAY', 'Mar'],
            ['WEDNESDAY', 'Mié'],
            ['THURSDAY', 'Jue'],
            ['FRIDAY', 'Vie'],
            ['SATURDAY', 'Sáb'],
            ['SUNDAY', 'Dom'],
          ].map(([value, label]) => {
            const selected = ownerViewingDays.includes(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                onClick={() => setOwnerViewingDays((previous) => (
                  selected ? previous.filter((day) => day !== value) : [...previous, value]
                ))}
                className={`min-h-9 rounded-xl border px-3 text-[10px] font-black transition ${
                  selected
                    ? 'border-brand-black bg-brand-black text-white'
                    : 'border-brand-gray-200 bg-white text-brand-gray-600 hover:border-brand-gray-400'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="owner-start-time" className="flex items-center gap-1.5 text-xs font-bold text-brand-gray-600">
              <Clock3 className="h-3.5 w-3.5" /> Desde
            </label>
            <input id="owner-start-time" type="time" value={ownerViewingStartTime} onChange={(event) => setOwnerViewingStartTime(event.target.value)}
              className="w-full rounded-xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold outline-none focus:border-brand-accent" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="owner-end-time" className="flex items-center gap-1.5 text-xs font-bold text-brand-gray-600">
              <Clock3 className="h-3.5 w-3.5" /> Hasta
            </label>
            <input id="owner-end-time" type="time" value={ownerViewingEndTime} onChange={(event) => setOwnerViewingEndTime(event.target.value)}
              className="w-full rounded-xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold outline-none focus:border-brand-accent" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-brand-gray-600">
              <KeyRound className="h-3.5 w-3.5" /> ¿Tenemos llave?
            </label>
            <CustomSelect<'unknown' | 'yes' | 'no'>
              value={ownerHasKeys}
              onChange={setOwnerHasKeys}
              options={[
                { value: 'unknown', label: 'Sin especificar' },
                { value: 'yes', label: 'Sí, tenemos llave' },
                { value: 'no', label: 'No, coordinar acceso' },
              ]}
              scrollContainerRef={scrollAreaRef}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-brand-gray-600">Ocupación actual</label>
            <CustomSelect
              value={ownerOccupancyStatus}
              onChange={setOwnerOccupancyStatus}
              options={[
                { value: '', label: 'Sin especificar' },
                { value: 'VACANT', label: 'Desocupada' },
                { value: 'OWNER_OCCUPIED', label: 'Habitada por propietario' },
                { value: 'TENANT_OCCUPIED', label: 'Habitada por inquilino' },
                { value: 'UNDER_CONSTRUCTION', label: 'En obra / adecuación' },
              ]}
              scrollContainerRef={scrollAreaRef}
            />
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="owner-notice-hours" className="text-xs font-bold text-brand-gray-600">Anticipación para agendar</label>
            <div className="relative">
              <input
                id="owner-notice-hours"
                type="number"
                min={0}
                max={720}
                value={ownerAppointmentNoticeHours}
                onChange={(event) => setOwnerAppointmentNoticeHours(event.target.value === '' ? '' : Number(event.target.value))}
                placeholder="Ej. 24"
                className="w-full rounded-xl border border-brand-gray-200 bg-white p-3 pr-16 text-xs font-semibold outline-none focus:border-brand-accent"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-brand-gray-400">horas</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <label htmlFor="owner-visit-instructions" className="text-xs font-bold text-brand-gray-600">Instrucciones para mostrar la propiedad</label>
            <textarea
              id="owner-visit-instructions"
              rows={3}
              value={ownerVisitInstructions}
              onChange={(event) => setOwnerVisitInstructions(event.target.value)}
              placeholder="Ej. Avisar al guardia, pedir identificación o coordinar con el inquilino."
              className="w-full resize-none rounded-xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold leading-relaxed outline-none focus:border-brand-accent"
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="owner-extra-notes" className="flex items-center gap-1.5 text-xs font-bold text-brand-gray-600">
          <StickyNote className="h-3.5 w-3.5" /> Datos adicionales
        </label>
        <textarea
          id="owner-extra-notes"
          rows={4}
          value={ownerExtraNotes}
          onChange={(event) => setOwnerExtraNotes(event.target.value)}
          placeholder="Condiciones especiales, contexto de la captación o cualquier dato útil para el equipo."
          className="w-full resize-none rounded-2xl border border-brand-gray-200 bg-white p-3 text-xs font-semibold leading-relaxed outline-none focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/10"
        />
      </div>
    </motion.div>
  );
}

export const OwnerContactStep = memo(OwnerContactStepComponent);
