import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const harnessPath = path.join(scriptDirectory, 'cloud-security-matrix.ts');

test('cloud security matrix harness exists', () => {
  assert.equal(existsSync(harnessPath), true);
});

test('builds six cryptographically exercised offline security scenarios without retaining tokens', async () => {
  const module = await import('./cloud-security-matrix.ts');
  assert.equal(typeof module.buildOfflineSecurityScenarios, 'function');

  const result = await module.buildOfflineSecurityScenarios({
    eventId: 'event-run-001',
    inputIdentityPrefix: 'run001',
    now: new Date('2026-08-25T06:00:00.000Z'),
  });

  assert.deepEqual(
    result.scenarios.map((row: { scenario: string }) => row.scenario),
    [
      'genuine_unused_accept',
      'replayed_or_copied',
      'modified_or_tampered',
      'wrong_event',
      'expired_or_out_of_window',
      'cancelled_or_revoked_after_refresh',
    ],
  );
  assert.deepEqual(
    result.scenarios.map((row: { observed: string; reason_code: string }) => [
      row.observed,
      row.reason_code,
    ]),
    [
      ['ACCEPT', 'ACCEPT'],
      ['REJECT', 'REPLAY_USED'],
      ['REJECT', 'BAD_SIGNATURE'],
      ['REJECT', 'WRONG_EVENT'],
      ['REJECT', 'EXPIRED'],
      ['REJECT', 'REVOKED'],
    ],
  );
  for (const row of result.scenarios) {
    assert.equal(row.status, 'PASS');
    assert.match(row.input_identity, /^[A-Za-z0-9._:-]+$/);
    assert.match(row.timestamp, /^2026-08-25T06:00:0[1-6]\.000Z$/);
    assert.equal('token' in row, false);
  }
  const serialized = JSON.stringify(result);
  assert.doesNotMatch(serialized, /enc_template|full_pass_token|pass_token|private_key/i);
});
