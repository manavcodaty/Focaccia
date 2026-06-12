import assert from 'node:assert/strict';
import test from 'node:test';

import { checkoutErrorMessage, formatEventDate, formatPrice, statusCopy } from '../lib/presentation.ts';

test('formats real GBP totals and London event times', () => {
  assert.equal(formatPrice(0), '£0.00');
  assert.equal(formatPrice(1250), '£12.50');
  assert.match(
    formatEventDate('2026-07-12T17:00:00.000Z', '2026-07-12T20:30:00.000Z'),
    /Sunday, 12 July 2026, 18:00-21:30/,
  );
});

test('every ticket state has plain-English status and next-step copy', () => {
  for (const status of ['claimed', 'enrolled', 'checked_in', 'cancelled', 'revoked'] as const) {
    const copy = statusCopy(status);
    assert.ok(copy.label.length > 0);
    assert.ok(copy.nextStep.length > 20);
  }
  assert.equal(statusCopy('claimed').tone, 'warm');
  assert.equal(statusCopy('revoked').tone, 'danger');
});

test('checkout errors distinguish capacity, duplicate, paid, and unknown failures', () => {
  assert.match(checkoutErrorMessage('event_sold_out'), /final place/);
  assert.match(checkoutErrorMessage('ticket_type_sold_out'), /final place/);
  assert.match(checkoutErrorMessage('capacity_exhausted'), /final place/);
  assert.match(checkoutErrorMessage('paid_ticket_not_supported'), /Paid ticket/);
  assert.match(checkoutErrorMessage('ticket_already_exists'), /already hold/);
  assert.match(checkoutErrorMessage('other'), /could not be completed/);
});
