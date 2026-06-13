export interface OrganizerCsvTicket {
  readonly attendee_email: string;
  readonly attendee_name: string;
  readonly checked_in_at: string | null;
  readonly generation_count: number;
  readonly status: string;
  readonly ticket_id: string;
  readonly ticket_type_name: string;
}

const HEADERS = [
  'Attendee name',
  'Attendee email',
  'Ticket type',
  'Status',
  'Generation',
  'Checked in at',
  'Ticket ID',
] as const;

function protectSpreadsheetValue(value: string): string {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function escapeCsvValue(value: string | number | null): string {
  const protectedValue = protectSpreadsheetValue(value === null ? '' : String(value));
  return /[",\r\n]/.test(protectedValue)
    ? `"${protectedValue.replaceAll('"', '""')}"`
    : protectedValue;
}

export function buildOrganizerTicketsCsv(tickets: readonly OrganizerCsvTicket[]): string {
  const rows = tickets.map((ticket) => [
    ticket.attendee_name,
    ticket.attendee_email,
    ticket.ticket_type_name,
    ticket.status,
    ticket.generation_count,
    ticket.checked_in_at,
    ticket.ticket_id,
  ].map(escapeCsvValue).join(','));

  return [HEADERS.join(','), ...rows, ''].join('\r\n');
}
