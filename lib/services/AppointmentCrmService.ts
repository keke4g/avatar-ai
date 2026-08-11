import { supabase } from '../supabaseClient';

export const APPOINTMENT_WHATSAPP_TARGET = '526624739146';

export type AppointmentStatus = 'NEW' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';

export interface AppointmentCrmRecord {
  id: string;
  appointmentNumber: number;
  clientName: string;
  appointmentAt: string;
  propertyReference: string;
  prospectorUserId: string;
  prospectorName: string;
  paymentMethod: string;
  clientPhone: string;
  status: AppointmentStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentInput {
  clientName: string;
  appointmentAt: string;
  propertyReference: string;
  prospectorName: string;
  paymentMethod: string;
  clientPhone: string;
}

type AppointmentRow = {
  id: string;
  appointment_number: number;
  client_name: string;
  appointment_at: string;
  property_reference: string;
  prospector_user_id: string;
  prospector_name: string;
  payment_method: string;
  client_phone: string;
  status: AppointmentStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
};

function mapAppointment(row: AppointmentRow): AppointmentCrmRecord {
  return {
    id: row.id,
    appointmentNumber: row.appointment_number,
    clientName: row.client_name,
    appointmentAt: row.appointment_at,
    propertyReference: row.property_reference,
    prospectorUserId: row.prospector_user_id,
    prospectorName: row.prospector_name,
    paymentMethod: row.payment_method,
    clientPhone: row.client_phone,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function clean(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

export class AppointmentCrmService {
  static async list(): Promise<AppointmentCrmRecord[]> {
    const { data, error } = await supabase
      .from('appointment_requests')
      .select('*')
      .order('appointment_at', { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    return ((data || []) as AppointmentRow[]).map(mapAppointment);
  }

  static async create(input: CreateAppointmentInput): Promise<AppointmentCrmRecord> {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const userId = authData.user?.id;

    if (authError || !userId) {
      throw new Error('Tu sesión expiró. Inicia sesión nuevamente.');
    }

    const payload = {
      client_name: clean(input.clientName),
      appointment_at: input.appointmentAt,
      property_reference: clean(input.propertyReference),
      prospector_user_id: userId,
      prospector_name: clean(input.prospectorName),
      payment_method: clean(input.paymentMethod),
      client_phone: clean(input.clientPhone),
      whatsapp_target: APPOINTMENT_WHATSAPP_TARGET,
      created_by: userId,
    };

    const { data, error } = await supabase
      .from('appointment_requests')
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapAppointment(data as AppointmentRow);
  }

  static async updateStatus(
    id: string,
    status: AppointmentStatus,
  ): Promise<AppointmentCrmRecord> {
    const { data, error } = await supabase
      .from('appointment_requests')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return mapAppointment(data as AppointmentRow);
  }
}

export function formatAppointmentFolio(appointmentNumber: number): string {
  return `CI-${String(appointmentNumber).padStart(6, '0')}`;
}

export function buildAppointmentWhatsAppUrl(
  appointment: AppointmentCrmRecord,
  locale: 'es' | 'en' = 'es',
): string {
  const formattedDate = new Intl.DateTimeFormat(
    locale === 'es' ? 'es-MX' : 'en-US',
    {
      dateStyle: 'full',
      timeStyle: 'short',
    },
  ).format(new Date(appointment.appointmentAt));

  const message = [
    '*NUEVA CITA · TOWERS MÉXICO*',
    '',
    `*Folio:* ${formatAppointmentFolio(appointment.appointmentNumber)}`,
    `*Cliente:* ${appointment.clientName}`,
    `*Fecha y hora:* ${formattedDate}`,
    `*Propiedad:* ${appointment.propertyReference}`,
    `*Prospectador:* ${appointment.prospectorName}`,
    `*Método de pago:* ${appointment.paymentMethod}`,
    `*Teléfono del cliente:* ${appointment.clientPhone}`,
    '',
    '_La cita ya quedó registrada en el CRM interno._',
  ].join('\n');

  return `https://wa.me/${APPOINTMENT_WHATSAPP_TARGET}?text=${encodeURIComponent(message)}`;
}
