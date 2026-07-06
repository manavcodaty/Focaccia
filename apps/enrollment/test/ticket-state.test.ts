import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checkedInConfirmation,
  generationAllowance,
  reconcilePassWithTicket,
  ticketAction,
  ticketStatusPresentation,
  type EnrollmentTicket,
  type StoredEnrollmentPass,
} from '../src/lib/ticket-state.ts';

function ticket(overrides: Partial<EnrollmentTicket> = {}): EnrollmentTicket {
  return {
    cancelled_at: null,
    checked_in_at: null,
    claim_code: 'ABCD-EFGH-JKLM',
    claim_code_hint: 'JKLM',
    claimed_at: '2026-06-13T10:00:00.000Z',
    created_at: '2026-06-13T10:00:00.000Z',
    current_pass_id: null,
    enrolled_at: null,
    event: {
      ends_at: '2026-06-14T22:00:00.000Z',
      event_id: 'summer-market',
      location: 'Assembly Hall',
      name: 'Summer Market',
      starts_at: '2026-06-14T18:00:00.000Z',
    },
    event_id: 'summer-market',
    generation_count: 0,
    id: '10000000-0000-4000-8000-000000000001',
    revoked_at: null,
    status: 'claimed',
    ticket_type: {
      currency: 'GBP',
      id: '20000000-0000-4000-8000-000000000001',
      name: 'General Admission',
      price_pence: 0,
    },
    ticket_type_id: '20000000-0000-4000-8000-000000000001',
    updated_at: '2026-06-13T10:00:00.000Z',
    ...overrides,
  };
}

function storedPass(overrides: Partial<StoredEnrollmentPass> = {}): StoredEnrollmentPass {
  return {
    createdAtIso: '2026-06-13T10:05:00.000Z',
    event: ticket().event,
    generation: 1,
    passId: 'abcdefghijklmnopqrstuv',
    queueCode: '12345678',
    ticketId: ticket().id,
    ticketTypeName: 'General Admission',
    token: 'payload.signature',
    tokenSnippet: 'payload...signature',
    userId: '30000000-0000-4000-8000-000000000001',
    ...overrides,
  };
}

test('maps every ticket status to plain-language presentation', () => {
  assert.deepEqual(ticketStatusPresentation('claimed'), { label: 'Claimed', tone: 'warning' });
  assert.deepEqual(ticketStatusPresentation('enrolled'), { label: 'Enrolled', tone: 'success' });
  assert.deepEqual(ticketStatusPresentation('checked_in'), { label: 'Checked in', tone: 'neutral' });
  assert.deepEqual(ticketStatusPresentation('cancelled'), { label: 'Cancelled', tone: 'danger' });
  assert.deepEqual(ticketStatusPresentation('revoked'), { label: 'Revoked', tone: 'danger' });
});

test('builds explicit approval copy only after a gate check-in', () => {
  assert.equal(checkedInConfirmation(ticket()), null);
  assert.deepEqual(checkedInConfirmation(ticket({
    checked_in_at: '2026-06-14T19:15:00.000Z',
    status: 'checked_in',
  })), {
    body: 'The gate authenticated this pass and recorded entry for Summer Market.',
    processedAt: '2026-06-14T19:15:00.000Z',
    title: 'Ticket processed and approved',
  });
});

test('calculates the three-generation allowance and blocks a fourth pass', () => {
  assert.deepEqual(generationAllowance(0), { remaining: 3, used: 0 });
  assert.deepEqual(generationAllowance(2), { remaining: 1, used: 2 });
  assert.deepEqual(generationAllowance(3), { remaining: 0, used: 3 });
});

test('derives the correct action for claimed, enrolled, terminal, and missing-device-pass states', () => {
  assert.equal(ticketAction(ticket(), null), 'enroll');
  assert.equal(ticketAction(ticket({
    current_pass_id: 'abcdefghijklmnopqrstuv',
    generation_count: 1,
    status: 'enrolled',
  }), storedPass()), 'show-pass');
  assert.equal(ticketAction(ticket({
    current_pass_id: 'different-pass-id-1234',
    generation_count: 1,
    status: 'enrolled',
  }), storedPass()), 'regenerate');
  assert.equal(ticketAction(ticket({ generation_count: 3, status: 'enrolled' }), null), 'generation-limit');
  assert.equal(ticketAction(ticket({ status: 'checked_in' }), null), 'none');
  assert.equal(ticketAction(ticket({ status: 'cancelled' }), null), 'none');
  assert.equal(ticketAction(ticket({ status: 'revoked' }), null), 'none');
});

test('detects organizer reset and invalidates an old local pass', () => {
  assert.deepEqual(reconcilePassWithTicket(ticket(), storedPass()), {
    discardPass: true,
    reason: 'organizer-reset',
  });
  assert.deepEqual(reconcilePassWithTicket(ticket({
    current_pass_id: 'abcdefghijklmnopqrstuv',
    generation_count: 1,
    status: 'enrolled',
  }), storedPass()), {
    discardPass: false,
    reason: null,
  });
});

test('reconciliation removes terminal or replaced passes and leaves an absent pass alone', () => {
  assert.deepEqual(reconcilePassWithTicket(ticket({ status: 'checked_in' }), storedPass()), {
    discardPass: true,
    reason: 'terminal-ticket',
  });
  assert.deepEqual(reconcilePassWithTicket(ticket({ status: 'revoked' }), storedPass()), {
    discardPass: true,
    reason: 'terminal-ticket',
  });
  assert.deepEqual(reconcilePassWithTicket(ticket({
    current_pass_id: 'different-pass-id-1234',
    generation_count: 2,
    status: 'enrolled',
  }), storedPass()), {
    discardPass: true,
    reason: 'pass-replaced',
  });
  assert.deepEqual(reconcilePassWithTicket(ticket(), null), {
    discardPass: false,
    reason: null,
  });
});
