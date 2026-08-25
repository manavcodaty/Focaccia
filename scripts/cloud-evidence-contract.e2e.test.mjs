import assert from 'node:assert/strict';
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { assembleRunRecord } from './assemble-sc1-sc5-run-record.mjs';

function temporaryDirectory(prefix) {
  return mkdtempSync(path.join(realpathSync(tmpdir()), prefix));
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
      organizer_event_created: true,
    },
    commit_sha: 'a'.repeat(40),
    event_id: 'cloud_e2e_contract01',
    organizer_id_hash: 'c'.repeat(64),
    mutable_state_isolated: true,
    run_id: 'run-contract01',
    started_at: '2026-08-25T00:00:00.000Z',
    ticket_id: '11111111-1111-4111-8111-111111111111',
    workflow_run_url: 'https://github.com/manavcodaty/Focaccia/actions/runs/123',
  };
}

function nativeReport() {
  return {
    checks: {
      dashboard_checked_in: true,
      enrollment_camera_capture_completed: true,
      enrollment_pass_issued: true,
      gate_liveness_capture_accepted: true,
      offline_acceptance: true,
      offline_queue_observed: true,
      queue_persisted_after_restart: true,
      reconnect_sync: true,
      revocation_cache_fresh: true,
    },
    commit_sha: 'a'.repeat(40),
    event_id: 'cloud_e2e_contract01',
    face_fixture_sha256: 'd'.repeat(64),
    network_loss_method: 'stopped_macOS_relay',
    provisioning_mode: 'e2e_payload_injection',
    provisioning_qr_camera_scan: false,
    run_id: 'run-contract01',
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
    backend_consequence: 'offline_harness_only_no_backend_write',
    expected: scenario === 'genuine_unused_accept' ? 'ACCEPT' : 'REJECT',
    input_identity: `run-contract01:${scenario}`,
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
    encrypted_gate_bound_payload_classification:
      'encrypted_event_specific_gate_bound_payload_not_centrally_searchable',
    forbidden_reusable_biometrics_count: 0,
    reusable_biometrics_centrally_stored: false,
    source_only: false,
    status: 'PASS',
    surfaces: ['schema', 'rows', 'api_responses', 'server_logs', 'csv_exports', 'retained_evidence']
      .map((surface) => ({ scanned: true, surface })),
  };
}

test('assembles one run and reduces it into a bounded ten-observation receipt', async () => {
  const sourceDirectory = temporaryDirectory('focaccia-contract-source-');
  const inputDirectory = temporaryDirectory('focaccia-contract-input-');
  const outputDirectory = temporaryDirectory('focaccia-contract-output-');

  try {
    const browserPath = writeJson(sourceDirectory, 'browser.json', browserReport());
    const nativePath = writeJson(sourceDirectory, 'native.json', nativeReport());
    const securityPath = writeJson(sourceDirectory, 'security.json', securityMatrix());
    const privacyPath = writeJson(sourceDirectory, 'privacy.json', privacyAudit());
    const authoritativePath = writeJson(sourceDirectory, 'authoritative.json', {
      accepted_checkins: 1,
      checked_in_tickets: 1,
      event_id: 'cloud_e2e_contract01',
      gate_key_fingerprint: 'e'.repeat(64),
      synchronized_checkins: 1,
    });
    const recordPath = path.join(sourceDirectory, 'run-record.json');
    const rawPath = path.join(sourceDirectory, 'raw-evidence.json');
    await assembleRunRecord({
      authoritativePath,
      browserPath,
      nativePath,
      outputRecordPath: recordPath,
      outputRawEvidencePath: rawPath,
      privacyPath,
      securityPath,
    });

    copyFileSync(
      recordPath,
      path.join(inputDirectory, `${browserReport().run_id}.json`),
    );
    const runArtifactDirectory = path.join(inputDirectory, 'artifacts', browserReport().run_id);
    mkdirSync(runArtifactDirectory, { recursive: true });
    for (const fileName of [
      'authoritative-backend.json',
      'browser-report.json',
      'native-report.json',
      'privacy-audit.json',
      'raw-evidence.json',
      'security-matrix.json',
    ]) {
      copyFileSync(
        path.join(sourceDirectory, 'artifacts', browserReport().run_id, fileName),
        path.join(runArtifactDirectory, fileName),
      );
    }

    const reducerPath = path.resolve('scripts/aggregate-sc1-sc5-evidence.mjs');
    const result = spawnSync(process.execPath, [
      reducerPath,
      '--input',
      inputDirectory,
      '--output',
      outputDirectory,
    ], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

    const receipt = JSON.parse(readFileSync(
      path.join(outputDirectory, 'sc1-sc5-evidence-receipt.json'),
      'utf8',
    ));
    assert.equal(receipt.status, 'PARTIAL');
    assert.equal(receipt.target.required_runs, 10);
    assert.equal(receipt.target.observed_target_runs, 1);
    assert.equal(receipt.criteria.SC1.observed_denominator, 1);
    assert.equal(receipt.criteria.SC1.numerator, 1);
  } finally {
    rmSync(sourceDirectory, { force: true, recursive: true });
    rmSync(inputDirectory, { force: true, recursive: true });
    rmSync(outputDirectory, { force: true, recursive: true });
  }
});
