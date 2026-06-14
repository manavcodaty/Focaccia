import assert from 'node:assert/strict';
import test from 'node:test';

import { createIssuanceCoordinator } from '../src/lib/issuance-coordinator.ts';
import { createPassVault, type SecureKeyValueStore } from '../src/lib/pass-vault.ts';
import type { PendingPassIssuance, StoredEnrollmentPass } from '../src/lib/ticket-state.ts';

class MemorySecureStore implements SecureKeyValueStore {
  readonly values = new Map<string, string>();
  async deleteItem(key: string) { this.values.delete(key); }
  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) { this.values.set(key, value); }
}

const userId = '30000000-0000-4000-8000-000000000001';
const ticketId = '10000000-0000-4000-8000-000000000001';
const idempotencyKey = '40000000-0000-4000-8000-000000000001';

function pending(): PendingPassIssuance {
  return {
    createdAtIso: '2026-06-13T10:04:00.000Z',
    idempotencyKey,
    payload: {
      enc_template: 'a'.repeat(96),
      event_id: 'summer-market',
      exp: 1781474400,
      iat: 1781456400,
      nonce: 'abcdefghijklmnop',
      pass_id: 'abcdefghijklmnopqrstuv',
      single_use: true,
      v: 1,
    },
    ticketId,
    userId,
  };
}

function pass(): StoredEnrollmentPass {
  return {
    createdAtIso: '2026-06-13T10:05:00.000Z',
    event: {
      ends_at: '2026-06-14T22:00:00.000Z',
      event_id: 'summer-market',
      location: 'Assembly Hall',
      name: 'Summer Market',
      starts_at: '2026-06-14T18:00:00.000Z',
    },
    generation: 1,
    passId: 'abcdefghijklmnopqrstuv',
    ticketId,
    ticketTypeName: 'General Admission',
    token: 'payload.signature',
    tokenSnippet: 'payload...signature',
    userId,
  };
}

test('retains the exact payload and idempotency key after a network failure', async () => {
  const vault = createPassVault(new MemorySecureStore());
  const coordinator = createIssuanceCoordinator(vault);
  let createCount = 0;
  let submitCount = 0;

  await assert.rejects(
    () => coordinator.issue({
      createPending: async () => {
        createCount += 1;
        return pending();
      },
      finalize: async () => pass(),
      submit: async () => {
        submitCount += 1;
        throw new Error('network unavailable');
      },
      ticketId,
      userId,
    }),
    /network unavailable/,
  );

  assert.equal(createCount, 1);
  assert.equal(submitCount, 1);
  assert.deepEqual(await vault.loadPending(userId, ticketId), pending());
});

test('resumes a failed issuance without another capture and prevents concurrent duplicates', async () => {
  const vault = createPassVault(new MemorySecureStore());
  await vault.savePending(pending());
  const coordinator = createIssuanceCoordinator(vault);
  let createCount = 0;
  let releaseSubmit!: () => void;
  let markSubmitStarted!: () => void;
  const submitStarted = new Promise<void>((resolve) => { markSubmitStarted = resolve; });
  const submitted: PendingPassIssuance[] = [];

  const options = {
    createPending: async () => {
      createCount += 1;
      return pending();
    },
    finalize: async () => pass(),
    submit: async (request: PendingPassIssuance) => {
      submitted.push(request);
      markSubmitStarted();
      await new Promise<void>((resolve) => { releaseSubmit = resolve; });
      return { generation: 1, idempotent_replay: true, signature: 'signature' };
    },
    ticketId,
    userId,
  };

  const first = coordinator.issue(options);
  const second = coordinator.issue(options);

  assert.strictEqual(first, second);
  await submitStarted;
  releaseSubmit();
  assert.deepEqual(await first, pass());
  assert.equal(createCount, 0);
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0]?.idempotencyKey, idempotencyKey);
  assert.equal(await vault.loadPending(userId, ticketId), null);
  assert.deepEqual(await vault.loadPass(userId, ticketId), pass());
});
