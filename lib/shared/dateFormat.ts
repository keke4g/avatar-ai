export type SupportedDateLanguage = 'es' | 'en';

const MONTH_NAMES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

const MONTH_NAMES_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const SHORT_MONTH_NAMES_ES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const;

const SHORT_MONTH_NAMES_EN = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

export function formatHumanDate(
  dateStr: string,
  language: SupportedDateLanguage = 'es',
): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number.parseInt(yearStr, 10);
  const monthIndex = Number.parseInt(monthStr, 10) - 1;
  const day = Number.parseInt(dayStr, 10);
  const monthName = language === 'es'
    ? MONTH_NAMES_ES[monthIndex] || ''
    : MONTH_NAMES_EN[monthIndex] || '';

  if (language === 'es') {
    return year === 2026
      ? `${day} de ${monthName}`
      : `${day} de ${monthName} de ${year}`;
  }

  return year === 2026
    ? `${monthName} ${day}`
    : `${monthName} ${day}, ${year}`;
}

export function formatElegantRange(
  start: string,
  end: string,
  language: SupportedDateLanguage = 'es',
): string {
  if (!start || !end) return '';

  const months = language === 'es' ? SHORT_MONTH_NAMES_ES : SHORT_MONTH_NAMES_EN;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const startDay = startDate.getDate();
  const startMonth = months[startDate.getMonth()];
  const endDay = endDate.getDate();
  const endMonth = months[endDate.getMonth()];

  if (startMonth === endMonth) {
    return `${startDay} - ${endDay} ${startMonth}`;
  }
  return `${startDay} ${startMonth} - ${endDay} ${endMonth}`;
}
