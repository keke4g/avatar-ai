import type { Metadata } from 'next';
import AppointmentCrmClient from '../../components/appointments/AppointmentCrmClient';

export const metadata: Metadata = {
  title: 'Formato de Citas | Towers México',
  description: 'Registro y seguimiento interno de citas inmobiliarias.',
};

export default function AppointmentsPage() {
  return <AppointmentCrmClient />;
}
