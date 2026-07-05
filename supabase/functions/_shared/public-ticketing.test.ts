import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { buildPublicEvent, organizerLabelFromEmail } from './public-ticketing.ts';

const event = {
  capacity: 2,
  created_at: '2026-06-12T09:00:00.000Z',
  created_by: 'organizer-id',
  description: 'A real event',
  ends_at: '2026-07-12T22:00:00.000Z',
  event_id: 'evt_test',
  location: 'Assembly Hall',
  name: 'Summer Assembly',
  starts_at: '2026-07-12T18:00:00.000Z',
};

const ticketTypes = [{
  capacity: 1,
  currency: 'GBP',
  description: '',
  event_id: event.event_id,
  id: 'type-free',
  name: 'General Admission',
  price_pence: 0,
  sort_order: 0,
}, {
  capacity: null,
  currency: 'GBP',
  description: '',
  event_id: event.event_id,
  id: 'type-paid',
  name: 'Supporter',
  price_pence: 1200,
  sort_order: 1,
}];

test('organizer labels are derived without exposing a full email address', () => {
  assert.equal(organizerLabelFromEmail('manav.patel+events@example.com'), 'Manav Patel Events');
  assert.equal(organizerLabelFromEmail(undefined), 'Focaccia organizer');
});

test('public event capacity and checkout availability are calculated from active tickets', () => {
  const result = buildPublicEvent({
    activeTickets: [{ event_id: event.event_id, ticket_type_id: 'type-free' }],
    event,
    organizer: { email: 'organizer@example.com', user_id: 'organizer-id' },
    ticketTypes,
  });

  assert.equal(result.organizer, 'Organizer');
  assert.equal(result.remaining_capacity, 1);
  assert.equal(result.sold_out, false);
  assert.deepEqual(result.ticket_types.map((type) => ({
    available: type.checkout_available,
    remaining: type.remaining_capacity,
    soldOut: type.sold_out,
  })), [
    { available: false, remaining: 0, soldOut: true },
    { available: false, remaining: 1, soldOut: false },
  ]);
});

test('event sellout disables every ticket type', () => {
  const result = buildPublicEvent({
    activeTickets: [
      { event_id: event.event_id, ticket_type_id: 'type-free' },
      { event_id: event.event_id, ticket_type_id: 'type-paid' },
    ],
    event,
    ticketTypes,
  });

  assert.equal(result.remaining_capacity, 0);
  assert.equal(result.sold_out, true);
  assert.equal(result.ticket_types.every((type) => type.sold_out && !type.checkout_available), true);
});

test('public event endpoints rate-limit anonymous service-role reads', () => {
  const sources = [
    readFileSync(new URL('../get-public-event/index.ts', import.meta.url), 'utf8'),
    readFileSync(new URL('../get-public-events/index.ts', import.meta.url), 'utf8'),
  ];

  for (const source of sources) {
    assert.match(source, /consume_api_rate_limit/);
    assert.match(source, /public-events:anonymous/);
    assert.match(source, /rate_limit_exceeded/);
  }
});
