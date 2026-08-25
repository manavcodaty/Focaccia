import assert from 'node:assert/strict';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

const moduleUrl = new URL('./assemble-sc1-sc5-run-record.mjs', import.meta.url);

function temporaryDirectory() {
  return mkdtempSync(path.join(tmpdir(), 'focaccia-run-record-'));
}

function writeJson(directory, name, value) {
  const filePath = path.join(directory, name);
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  return filePath;
}

function browserReport() {
  return {
    attendee_id_hash: 'b'.repeat(64),
    checks: {
      attendee_account_created: true,
      attendee_wallet_checked: true,
      claim_code_format_valid: true,
      event_listed: true,
      foreign_claim_ownership_rejected: true,
      foreign_ticket_ownership_rejected: true,
      gate_provisioning_payload_captured_ephemerally: true,
      organizer_event_created: true,
    },
    commit_sha: 'a'.repeat(40),
    event_id: 'cloud_e2e_test01',
    organizer_id_hash: 'c'.repeat(64),
    run_id: 'run-test01',
    started_at: '2026-08-25T00:00:00.000Z',
    status: 'PASS',
    ticket_id: '11111111-1111-4111-8111-111111111111',
    workflow_run_url: 'https://github.com/manavcodaty/Focaccia/actions/runs/123',
  };
}

function nativeReport() {
  return {
    checks: {
      camera_image_source_started: true,
      dashboard_checked_in: true,
      enrollment_pass_issued: true,
      enrollment_camera_capture_completed: true,
      gate_provisioned: true,
      gate_liveness_capture_accepted: true,
      provisioning_payload_injected: true,
      revocation_cache_fresh: true,
      offline_acceptance: true,
      offline_queue_observed: true,
      queue_persisted_after_restart: true,
      replay_rejected: true,
      reconnect_sync: true,
    },
    commit_sha: 'a'.repeat(40),
    event_id: 'cloud_e2e_test01',
    face_fixture_sha256: 'd'.repeat(64),
    network_loss_method: 'stopped_macOS_relay',
    provisioning_mode: 'e2e_payload_injection',
    provisioning_qr_camera_scan: false,
    run_id: 'run-test01',
    runner_os: 'macOS-26',
    started_at: '2026-08-25T00:00:00.000Z',
    workflow_run_url: 'https://github.com/manavcodaty/Focaccia/actions/runs/123',
  };
}

function securityMatrix() {
  const scenarios = [
    'genuine_unused_accept',
    'replayed_or_copied',
    'modified_or_tampered',
    'wrong_event',
    'expired_or_out_of_window',
    'cancelled_or_revoked_after_refresh',
  ].map((scenario, index) => ({
    backend_consequence: scenario === 'genuine_unused_accept'
      ? 'offline_harness_accept_only_no_backend_write'
      : 'offline_harness_rejection_no_backend_write',
    expected: scenario === 'genuine_unused_accept' ? 'ACCEPT' : 'REJECT',
    input_identity: `run-test01:${scenario}`,
    observed: scenario === 'genuine_unused_accept' ? 'ACCEPT' : 'REJECT',
    reason_code: `SCENARIO_${index}`,
    scenario,
    status: 'PASS',
    timestamp: `2026-08-25T00:00:0${index}.000Z`,
  }));
  return {
    scenarios,
    stale_cache_limitation: { represented: true, status: 'NOT_TESTED' },
    status: 'PARTIAL',
  };
}

function privacyAudit() {
  return {
    encrypted_gate_bound_payload_classification: 'encrypted_event_specific_gate_bound_payload_not_central_searchable_biometric_storage',
    forbidden_reusable_biometrics_count: 0,
    reusable_biometrics_centrally_stored: false,
    source_only: false,
    status: 'PASS',
    surfaces: ['schema', 'rows', 'api_responses', 'server_logs', 'csv_exports', 'retained_evidence']
      .map((surface) => ({ scanned: true, surface })),
  };
}

test('assembles bounded run record and raw evidence with authoritative count denominator', async () => {
  const directory = temporaryDirectory();
  try {
    const browserPath = writeJson(directory, 'browser.json', browserReport());
    const nativePath = writeJson(directory, 'native.json', nativeReport());
    const securityPath = writeJson(directory, 'security.json', securityMatrix());
    const privacyPath = writeJson(directory, 'privacy.json', privacyAudit());
    const authoritativePath = writeJson(directory, 'authoritative.json', {
      accepted_checkins: 1,
      checked_in_tickets: 1,
      event_id: 'cloud_e2e_test01',
      gate_key_fingerprint: 'e'.repeat(64),
      synchronized_checkins: 1,
    });
    const recordPath = path.join(directory, 'run-record.json');
    const rawPath = path.join(directory, 'raw-evidence.json');
    const { assembleRunRecord } = await import(moduleUrl);
    const { rawEvidence, record } = await assembleRunRecord({
      authoritativePath,
      browserPath,
      nativePath,
      outputRecordPath: recordPath,
      outputRawEvidencePath: rawPath,
      privacyPath,
      securityPath,
    });

    assert.equal(record.status, 'PASS');
    assert.equal(record.checks.SC1.status, 'PASS');
    assert.equal(record.checks.SC4.status, 'PASS');
    assert.equal(record.checks.SC5.status, 'PASS');
    assert.equal(record.authoritative_backend.observed_counts.synchronized_check_ins, 1);
    assert.equal(rawEvidence.schema_version, 'sc1-sc5-raw-evidence-v1');
    assert.deepEqual(record.artifact_paths, [
      'artifacts/run-test01/raw-evidence.json',
      'artifacts/run-test01/browser-report.json',
      'artifacts/run-test01/native-report.json',
      'artifacts/run-test01/security-matrix.json',
      'artifacts/run-test01/privacy-audit.json',
      'artifacts/run-test01/authoritative-backend.json',
    ]);
    assert.ok(record.artifact_paths.every((artifactPath) => existsSync(path.join(directory, artifactPath))));
    assert.deepEqual(rawEvidence.runs[record.run_id].authoritative_backend, record.authoritative_backend);
    assert.deepEqual(JSON.parse(readFileSync(recordPath, 'utf8')), record);
    assert.deepEqual(JSON.parse(readFileSync(rawPath, 'utf8')), rawEvidence);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
});
