type FormatOptions = { locale?: string; timeZone?: string };

function toDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function zone(options: FormatOptions) {
  return options.timeZone ? { timeZone: options.timeZone } : {};
}

/** "Sat 14 Nov" */
export function formatEventDay(startsAt: string, options: FormatOptions = {}): string {
  const date = toDate(startsAt);
  if (!date) return '';
  return date.toLocaleDateString(options.locale, { day: 'numeric', month: 'short', weekday: 'short', ...zone(options) });
}

/** "19:00–23:00" */
export function formatEventTimeRange(startsAt: string, endsAt: string, options: FormatOptions = {}): string {
  const start = toDate(startsAt);
  const end = toDate(endsAt);
  if (!start) return '';
  const time = (date: Date) => date.toLocaleTimeString(options.locale, { hour: '2-digit', minute: '2-digit', ...zone(options) });
  return end ? `${time(start)}–${time(end)}` : time(start);
}

/** "Sat 14 Nov · 19:00–23:00" */
export function formatEventWhen(startsAt: string, endsAt: string, options: FormatOptions = {}): string {
  return [formatEventDay(startsAt, options), formatEventTimeRange(startsAt, endsAt, options)].filter(Boolean).join(' · ');
}

/** Month and day for a ticket's date tile: { month: "Nov", day: "14" }. */
export function eventDateTile(startsAt: string, options: FormatOptions = {}): { day: string; month: string } {
  const date = toDate(startsAt);
  if (!date) return { day: '–', month: '' };
  return {
    day: date.toLocaleDateString(options.locale, { day: 'numeric', ...zone(options) }),
    month: date.toLocaleDateString(options.locale, { month: 'short', ...zone(options) }),
  };
}
