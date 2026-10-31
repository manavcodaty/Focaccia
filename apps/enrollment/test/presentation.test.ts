import assert from 'node:assert/strict';
import test from 'node:test';

import { issuanceMessage, phaseLabel } from '../src/lib/capture-presentation.ts';
import { eventDateTile, formatEventDay, formatEventTimeRange, formatEventWhen } from '../src/lib/event-format.ts';
import { FunctionApiError } from '../src/lib/function-errors.ts';

const utc = { locale: 'en-GB', timeZone: 'UTC' };
const starts = '2026-11-14T19:00:00.000Z';
const ends = '2026-11-14T23:30:00.000Z';

test('event dates render as a compact day, time range and tile', () => {
  assert.equal(formatEventDay(starts, utc), 'Sat 14 Nov');
  assert.equal(formatEventTimeRange(starts, ends, utc), '19:00–23:30');
  assert.equal(formatEventWhen(starts, ends, utc), 'Sat 14 Nov · 19:00–23:30');
  assert.deepEqual(eventDateTile(starts, utc), { day: '14', month: 'Nov' });
});

test('event formatting degrades quietly on bad input', () => {
  assert.equal(formatEventDay('not a date', utc), '');
  assert.equal(formatEventTimeRange('not a date', ends, utc), '');
  assert.equal(formatEventTimeRange(starts, 'not a date', utc), '19:00');
  assert.equal(formatEventWhen('not a date', 'nope', utc), '');
  assert.deepEqual(eventDateTile('not a date', utc), { day: '–', month: '' });
});

test('capture phases are one or two words and silent when idle', () => {
  assert.equal(phaseLabel(null), null);
  assert.equal(phaseLabel('generating-template'), 'Generating template');
  assert.equal(phaseLabel('encrypting-pass'), 'Encrypting');
  assert.equal(phaseLabel('requesting-signature'), 'Signing');
  assert.equal(phaseLabel('finalizing-pass'), 'Saving');
  for (const phase of ['generating-template', 'encrypting-pass', 'requesting-signature', 'finalizing-pass'] as const) {
    assert.ok((phaseLabel(phase) ?? '').split(' ').length <= 2);
  }
});

test('issuance failures map to short, actionable messages', () => {
  const failure = (code: string) => new FunctionApiError(409, { code, message: 'server text' });

  assert.equal(issuanceMessage(failure('pass_generation_limit')), 'Generation limit reached.');
  assert.equal(issuanceMessage(failure('ticket_state_conflict')), 'Ticket changed. Refresh My tickets.');
  assert.equal(issuanceMessage(failure('ticket_not_found')), 'Ticket no longer available.');
  assert.equal(issuanceMessage(failure('gate_not_provisioned')), 'Gate not set up yet.');
  assert.equal(issuanceMessage(failure('other_code')), 'server text');
  assert.equal(issuanceMessage(new Error('Camera busy')), 'Camera busy');
  assert.equal(issuanceMessage('nope'), 'Pass not issued.');
});
