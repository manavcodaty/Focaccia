import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const auditPath = path.join(scriptDirectory, 'cloud-privacy-audit.mjs');

async function privacyFixture(overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'focaccia-privacy-audit-'));
  const files = {
    api_responses: { issue_pass: { enc_template: 'encrypted-gate-bound-ciphertext' } },
    csv_exports: 'ticket_id,status\nticket-1,checked_in\n',
    retained_evidence: { status: 'PASS', screenshot_review: 'safe_result_screen_only' },
    rows: { event_passes: [{ event_id: 'event-1', payload_hash: 'a'.repeat(64) }] },
    schema: { columns: ['event_id', 'pass_id', 'payload_hash', 'status'] },
    server_logs: 'request complete status=200\n',
    ...overrides,
  };
  for (const [surface, value] of Object.entries(files)) {
    const extension = surface === 'csv_exports' ? 'csv' : surface === 'server_logs' ? 'log' : 'json';
    const contents = typeof value === 'string' ? value : `${JSON.stringify(value, null, 2)}\n`;
    await writeFile(path.join(root, `${surface}.${extension}`), contents, { mode: 0o600 });
  }
  return root;
}

test('cloud privacy audit exists', () => {
  assert.equal(existsSync(auditPath), true);
});

test('audits all six surfaces and classifies encrypted gate-bound payloads without calling them reusable biometrics', async () => {
  const fixture = await privacyFixture();
  try {
    const module = await import('./cloud-privacy-audit.mjs');
    assert.equal(typeof module.auditPrivacySurfaces, 'function');
    const result = await module.auditPrivacySurfaces(fixture);
    assert.equal(result.status, 'PASS');
    assert.equal(result.forbidden_reusable_biometrics_count, 0);
    assert.equal(result.reusable_biometrics_centrally_stored, false);
    assert.equal(result.source_only, false);
    assert.equal(result.encrypted_gate_bound_payload_observed, true);
    assert.match(result.encrypted_gate_bound_payload_classification, /encrypted.*gate_bound/i);
    assert.deepEqual(result.surfaces.map((entry) => entry.surface), [
      'schema',
      'rows',
      'api_responses',
      'server_logs',
      'csv_exports',
      'retained_evidence',
    ]);
    assert.ok(result.surfaces.every((entry) => entry.scanned === true));
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('marks a safe projection as source-only instead of making a central-audit claim', async () => {
  const fixture = await privacyFixture();
  try {
    const { auditPrivacySurfaces } = await import('./cloud-privacy-audit.mjs');
    const result = await auditPrivacySurfaces(fixture, { sourceOnly: true });
    assert.equal(result.status, 'PASS');
    assert.equal(result.source_only, true);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('reports forbidden biometric field names without echoing their values', async () => {
  const forbiddenValue = 'do-not-echo-biometric-value';
  const fixture = await privacyFixture({ rows: { face_embedding: forbiddenValue } });
  try {
    const { auditPrivacySurfaces } = await import('./cloud-privacy-audit.mjs');
    const result = await auditPrivacySurfaces(fixture);
    assert.equal(result.status, 'FAIL');
    assert.equal(result.forbidden_reusable_biometrics_count, 1);
    assert.deepEqual(result.findings, [{
      category: 'reusable_embedding',
      field: 'face_embedding',
      surface: 'rows',
    }]);
    assert.doesNotMatch(JSON.stringify(result), new RegExp(forbiddenValue));
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('fails closed when a required privacy surface is missing', async () => {
  const fixture = await privacyFixture();
  try {
    await rm(path.join(fixture, 'server_logs.log'));
    const { auditPrivacySurfaces } = await import('./cloud-privacy-audit.mjs');
    await assert.rejects(() => auditPrivacySurfaces(fixture), /missing required privacy surface/i);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
