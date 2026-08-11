'use client';

import {
  ArrowUpRight,
  Building2,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  Send,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import AuthGuard from '../AuthGuard';
import { useSwap } from '../../lib/context/SwapContext';
import { useTranslation } from '../../lib/context/LanguageContext';
import {
  AppointmentCrmRecord,
  AppointmentCrmService,
  AppointmentStatus,
  buildAppointmentWhatsAppUrl,
  formatAppointmentFolio,
} from '../../lib/services/AppointmentCrmService';

const PAYMENT_METHODS = [
  'Contado / recursos propios',
  'Crédito bancario',
  'Infonavit',
  'Fovissste',
  'Cofinavit',
  'Financiamiento directo',
  'Por definir',
] as const;

const STATUS_OPTIONS: AppointmentStatus[] = [
  'NEW',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
];

const statusStyles: Record<AppointmentStatus, string> = {
  NEW: 'border-sky-200 bg-sky-50 text-sky-700',
  CONFIRMED: 'border-amber-200 bg-amber-50 text-amber-700',
  COMPLETED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border-rose-200 bg-rose-50 text-rose-700',
};

const statusLabels: Record<AppointmentStatus, { es: string; en: string }> = {
  NEW: { es: 'Nueva', en: 'New' },
  CONFIRMED: { es: 'Confirmada', en: 'Confirmed' },
  COMPLETED: { es: 'Realizada', en: 'Completed' },
  CANCELLED: { es: 'Cancelada', en: 'Cancelled' },
};

type AppointmentForm = {
  clientName: string;
  appointmentAt: string;
  propertyReference: string;
  prospectorName: string;
  paymentMethod: string;
  clientPhone: string;
};

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-600 sm:mb-2 sm:gap-2 sm:text-[10px] sm:tracking-[0.16em]">
        <span className="text-sky-700 [&>svg]:h-3.5 [&>svg]:w-3.5 sm:[&>svg]:h-4 sm:[&>svg]:w-4">{icon}</span>
        {label}
      </span>
      {children}
    </label>
  );
}

function AppointmentCrmWorkspace() {
  const { currentUser, properties } = useSwap();
  const { language } = useTranslation();
  const isSpanish = language === 'es';
  const [records, setRecords] = useState<AppointmentCrmRecord[]>([]);
  const [form, setForm] = useState<AppointmentForm>(() => ({
    clientName: '',
    appointmentAt: '',
    propertyReference: '',
    prospectorName: currentUser?.name || '',
    paymentMethod: '',
    clientPhone: '',
  }));
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<AppointmentCrmRecord | null>(null);
  const [fallbackWhatsappUrl, setFallbackWhatsappUrl] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | AppointmentStatus>('ALL');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [minimumDate] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setRecords(await AppointmentCrmService.list());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'No se pudo cargar el CRM de citas.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRecords();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecords]);

  const setValue = (field: keyof AppointmentForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const filteredRecords = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('es-MX');
    return records.filter((record) => {
      const matchesStatus = statusFilter === 'ALL' || record.status === statusFilter;
      const matchesSearch = !needle || [
        record.clientName,
        record.propertyReference,
        record.prospectorName,
        record.clientPhone,
        formatAppointmentFolio(record.appointmentNumber),
      ].some((value) => value.toLocaleLowerCase('es-MX').includes(needle));
      return matchesStatus && matchesSearch;
    });
  }, [records, search, statusFilter]);

  const metrics = useMemo(() => ({
    total: records.length,
    new: records.filter((record) => record.status === 'NEW').length,
    confirmed: records.filter((record) => record.status === 'CONFIRMED').length,
    completed: records.filter((record) => record.status === 'COMPLETED').length,
  }), [records]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess(null);
    setFallbackWhatsappUrl('');

    const phoneDigits = form.clientPhone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setError('Ingresa un teléfono del cliente con al menos 10 dígitos.');
      return;
    }

    const appointmentDate = new Date(form.appointmentAt);
    if (Number.isNaN(appointmentDate.getTime())) {
      setError('Selecciona una fecha y hora válidas.');
      return;
    }

    const whatsappWindow = window.open('about:blank', '_blank');
    setSubmitting(true);

    try {
      const created = await AppointmentCrmService.create({
        ...form,
        appointmentAt: appointmentDate.toISOString(),
      });
      const whatsappUrl = buildAppointmentWhatsAppUrl(
        created,
        isSpanish ? 'es' : 'en',
      );

      setRecords((current) => [...current, created].sort(
        (left, right) => new Date(left.appointmentAt).getTime() - new Date(right.appointmentAt).getTime(),
      ));
      setSuccess(created);
      setForm({
        clientName: '',
        appointmentAt: '',
        propertyReference: '',
        prospectorName: currentUser?.name || '',
        paymentMethod: '',
        clientPhone: '',
      });

      if (whatsappWindow) {
        whatsappWindow.location.replace(whatsappUrl);
      } else {
        setFallbackWhatsappUrl(whatsappUrl);
      }
    } catch (submitError) {
      whatsappWindow?.close();
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo registrar la cita.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (
    record: AppointmentCrmRecord,
    status: AppointmentStatus,
  ) => {
    setUpdatingId(record.id);
    setError('');
    try {
      const updated = await AppointmentCrmService.updateStatus(record.id, status);
      setRecords((current) => current.map((item) => (
        item.id === updated.id ? updated : item
      )));
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : 'No se pudo actualizar el estado.',
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const inputClassName = 'h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-950 outline-none transition placeholder:text-slate-300 focus:border-sky-500 focus:ring-3 focus:ring-sky-100 sm:h-12 sm:rounded-2xl sm:px-4 sm:text-sm sm:focus:ring-4';

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-3 pb-14 pt-3 text-slate-950 sm:px-6 sm:pb-20 sm:pt-8 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-[34px] bg-[#071a2f] px-6 py-7 text-white shadow-[0_30px_80px_rgba(7,26,47,0.18)] sm:px-9 sm:py-9"
        >
          <div className="absolute -right-16 -top-24 h-64 w-64 rounded-full border border-sky-300/15" />
          <div className="absolute -right-4 -top-10 h-44 w-44 rounded-full border border-sky-300/15" />
          <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.24em] text-sky-300">
                <CalendarCheck2 className="h-4 w-4" />
                Towers México · Operaciones internas
              </div>
              <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-5xl">
                Formato de Citas
              </h1>
              <p className="mt-3 max-w-xl text-sm font-medium leading-6 text-slate-300">
                Registra la visita, envíala por WhatsApp y conserva el seguimiento completo dentro del CRM.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Total', metrics.total],
                ['Nuevas', metrics.new],
                ['Confirmadas', metrics.confirmed],
                ['Realizadas', metrics.completed],
              ].map(([label, value]) => (
                <div key={label} className="min-w-24 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
                  <div className="text-xl font-black">{value}</div>
                  <div className="mt-0.5 text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <div className="mt-4 grid items-start gap-4 sm:mt-6 sm:gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <motion.section
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.08 }}
            className="rounded-[24px] border border-slate-200/80 bg-white p-4 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:rounded-[30px] sm:p-7 xl:sticky xl:top-28"
          >
            <div className="mb-3 flex items-center justify-between gap-3 sm:mb-6 sm:items-start sm:gap-4">
              <div>
                <h2 className="text-xl font-black tracking-[-0.03em] sm:text-2xl">Ficha de Visita</h2>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700 sm:h-11 sm:w-11 sm:rounded-2xl">
                <CalendarDays className="h-4 w-4 sm:h-5 sm:w-5" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-5">
              <Field label="Nombre completo del cliente" icon={<UsersRound className="h-4 w-4" />}>
                <input
                  required
                  maxLength={160}
                  value={form.clientName}
                  onChange={(event) => setValue('clientName', event.target.value)}
                  placeholder="Nombre y apellidos"
                  className={inputClassName}
                />
              </Field>

              <Field label="Día y hora de la cita" icon={<Clock3 className="h-4 w-4" />}>
                <input
                  required
                  type="datetime-local"
                  min={minimumDate}
                  value={form.appointmentAt}
                  onChange={(event) => setValue('appointmentAt', event.target.value)}
                  className={`${inputClassName} [color-scheme:light]`}
                />
              </Field>

              <Field label="Propiedad" icon={<Building2 className="h-4 w-4" />}>
                <input
                  required
                  maxLength={240}
                  list="appointment-properties"
                  value={form.propertyReference}
                  onChange={(event) => setValue('propertyReference', event.target.value)}
                  placeholder="Propiedad, folio o ubicación"
                  className={inputClassName}
                />
                <datalist id="appointment-properties">
                  {properties.map((property) => (
                    <option key={property.id} value={property.title}>
                      {property.location}
                    </option>
                  ))}
                </datalist>
              </Field>

              <Field label="Prospectador" icon={<UserRound className="h-4 w-4" />}>
                <input
                  required
                  maxLength={160}
                  value={form.prospectorName}
                  onChange={(event) => setValue('prospectorName', event.target.value)}
                  className={inputClassName}
                />
              </Field>

              <Field label="Método de pago" icon={<WalletCards className="h-4 w-4" />}>
                <div className="relative">
                  <select
                    required
                    value={form.paymentMethod}
                    onChange={(event) => setValue('paymentMethod', event.target.value)}
                    className={`${inputClassName} appearance-none pr-10`}
                  >
                    <option value="">Seleccionar método</option>
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method} value={method}>{method}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
              </Field>

              <div className="hidden h-px bg-slate-100 sm:block" />

              <Field label="Teléfono del cliente" icon={<Phone className="h-4 w-4" />}>
                <input
                  required
                  type="tel"
                  inputMode="tel"
                  maxLength={30}
                  value={form.clientPhone}
                  onChange={(event) => setValue('clientPhone', event.target.value)}
                  placeholder="+52 667 000 0000"
                  className={inputClassName}
                />
              </Field>

              {error && (
                <div role="alert" className="flex gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold leading-5 text-rose-700">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-black text-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    Cita {formatAppointmentFolio(success.appointmentNumber)} registrada
                  </div>
                  <p className="mt-1 text-[10px] font-semibold leading-4 text-emerald-700">
                    El registro ya aparece en el CRM y WhatsApp fue preparado con los datos.
                  </p>
                  {fallbackWhatsappUrl && (
                    <a
                      href={fallbackWhatsappUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-[10px] font-black uppercase tracking-wider text-white"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      Abrir WhatsApp
                    </a>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#071a2f] px-4 text-[10px] font-black uppercase tracking-[0.12em] text-white shadow-[0_12px_26px_rgba(7,26,47,0.16)] transition hover:-translate-y-0.5 hover:bg-sky-800 disabled:cursor-not-allowed disabled:opacity-60 sm:h-13 sm:rounded-2xl sm:px-5 sm:text-xs sm:tracking-[0.14em]"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {submitting ? 'Registrando…' : 'Registrar y abrir WhatsApp'}
              </button>
            </form>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12 }}
            className="min-w-0 rounded-[30px] border border-slate-200/80 bg-white p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] sm:p-7"
          >
            <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-6 lg:flex-row lg:items-end">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-sky-700">CRM interno</div>
                <h2 className="mt-1 text-2xl font-black tracking-[-0.03em]">Seguimiento de citas</h2>
                <p className="mt-1 text-xs font-medium text-slate-500">
                  Consulta clientes, responsables y avance operativo.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Cliente, propiedad o folio"
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-xs font-semibold outline-none focus:border-sky-400 sm:w-60"
                  />
                </div>
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value as 'ALL' | AppointmentStatus)}
                    className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-4 pr-10 text-xs font-bold outline-none focus:border-sky-400 sm:w-40"
                  >
                    <option value="ALL">Todos los estados</option>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>{statusLabels[status].es}</option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                </div>
                <button
                  type="button"
                  onClick={() => void loadRecords()}
                  aria-label="Actualizar CRM"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-sky-700"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {loading && records.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-sky-700" />
                  <p className="mt-3 text-xs font-bold text-slate-500">Cargando citas…</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="flex min-h-72 flex-col items-center justify-center rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
                  <CalendarCheck2 className="h-8 w-8 text-slate-300" />
                  <h3 className="mt-4 text-sm font-black">No hay citas para mostrar</h3>
                  <p className="mt-1 max-w-xs text-xs font-medium leading-5 text-slate-400">
                    Registra la primera cita o cambia los filtros de búsqueda.
                  </p>
                </div>
              ) : (
                filteredRecords.map((record) => (
                  <article
                    key={record.id}
                    className="group rounded-[24px] border border-slate-200 bg-white p-4 transition hover:border-sky-200 hover:shadow-[0_14px_35px_rgba(14,116,144,0.08)] sm:p-5"
                  >
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(180px,0.8fr)_150px] lg:items-center">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-[#071a2f] px-2.5 py-1 text-[8px] font-black uppercase tracking-widest text-white">
                            {formatAppointmentFolio(record.appointmentNumber)}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-widest ${statusStyles[record.status]}`}>
                            {statusLabels[record.status][isSpanish ? 'es' : 'en']}
                          </span>
                        </div>
                        <h3 className="mt-3 truncate text-base font-black tracking-[-0.02em]">{record.clientName}</h3>
                        <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-slate-500">
                          <Building2 className="h-3.5 w-3.5 shrink-0 text-sky-700" />
                          {record.propertyReference}
                        </p>
                      </div>

                      <div className="space-y-2 border-slate-100 lg:border-l lg:pl-5">
                        <p className="flex items-center gap-2 text-[11px] font-bold text-slate-700">
                          <CalendarDays className="h-3.5 w-3.5 text-sky-700" />
                          {new Intl.DateTimeFormat(isSpanish ? 'es-MX' : 'en-US', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          }).format(new Date(record.appointmentAt))}
                        </p>
                        <p className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                          <UserRound className="h-3.5 w-3.5 text-slate-400" />
                          {record.prospectorName}
                        </p>
                        <a
                          href={`tel:${record.clientPhone.replace(/[^\d+]/g, '')}`}
                          className="flex items-center gap-2 text-[11px] font-semibold text-slate-500 hover:text-sky-700"
                        >
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          {record.clientPhone}
                        </a>
                      </div>

                      <div className="relative">
                        <select
                          aria-label={`Estado de ${record.clientName}`}
                          value={record.status}
                          disabled={updatingId === record.id}
                          onChange={(event) => void handleStatusChange(record, event.target.value as AppointmentStatus)}
                          className="h-11 w-full appearance-none rounded-2xl border border-slate-200 bg-slate-50 pl-4 pr-10 text-[10px] font-black uppercase tracking-wider outline-none focus:border-sky-400 disabled:opacity-60"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{statusLabels[status][isSpanish ? 'es' : 'en']}</option>
                          ))}
                        </select>
                        {updatingId === record.id ? (
                          <Loader2 className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-sky-700" />
                        ) : (
                          <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        )}
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                      <span className="flex items-center gap-2 text-[10px] font-semibold text-slate-400">
                        <WalletCards className="h-3.5 w-3.5" />
                        {record.paymentMethod}
                      </span>
                      <a
                        href={buildAppointmentWhatsAppUrl(record, isSpanish ? 'es' : 'en')}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider text-emerald-700 transition group-hover:translate-x-0.5"
                      >
                        Reenviar por WhatsApp
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </article>
                ))
              )}
            </div>
          </motion.section>
        </div>
      </div>
    </main>
  );
}

export default function AppointmentCrmClient() {
  return (
    <AuthGuard allowedRoles={['ADMIN', 'INTERNAL_ADVISOR', 'SUPER_ADMIN']}>
      <AppointmentCrmWorkspace />
    </AuthGuard>
  );
}
