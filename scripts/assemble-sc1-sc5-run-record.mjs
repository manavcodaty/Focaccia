#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, open, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants as fsConstants } from 'node:fs';

const RAW_SCHEMA_VERSION = 'sc1-sc5-raw-evidence-v1';
const CRITERIA = ['SC1', 'SC2', 'SC3', 'SC4', 'SC5'];
const SECURITY_SCENARIOS = [
  'genuine_unused_accept',
  'replayed_or_copied',
  'modified_or_tampered',
  'wrong_event',
  'expired_or_out_of_window',
  'cancelled_or_revoked_after_refresh',
  'duplicate_synchronisation',
];

async function readJson(filePath, label) {
  const info = await lstat(filePath).catch(() => null);
  if (info === null || !info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file.`);
  }
  const handle = await open(filePath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    return JSON.parse((await handle.readFile()).toString('utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${label} must contain valid JSON.`);
    throw error;
  } finally {
    await handle.close();
  }
}

async function writeJson(filePath, value) {
  const parent = path.dirname(filePath);
  const parentInfo = await lstat(parent).catch(() => null);
  if (parentInfo === null || !parentInfo.isDirectory() || parentInfo.isSymbolicLink()) {
    throw new Error('Run-record output parent must be a regular directory.');
  }
  const existing = await lstat(filePath).catch(() => null);
  if (existing !== null) throw new Error(`Refusing to overwrite ${path.basename(filePath)}.`);
  const handle = await open(
    filePath,
    fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_WRONLY | fsConstants.O_NOFOLLOW,
    0o600,
  );
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await chmod(filePath, 0o600);
}

function assertObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function assertSafeIdentifier(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._:-]{1,256}$/.test(value)) {
    throw new Error(`${label} must be a safe identifier.`);
  }
}

function assertSha256(value, label) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`${label} must be a SHA-256 fingerprint.`);
  }
}

function assertIsoTimestamp(value, label) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} must be an ISO timestamp.`);
  }
}

function workflowUrl(value) {
  if (typeof value !== 'string') throw new Error('workflow_run_url is required.');
  const parsed = new URL(value);
  if (
    parsed.protocol !== 'https:'
    || parsed.hostname !== 'github.com'
    || !/^\/[^/]+\/[^/]+\/actions\/runs\/\d+(?:\/attempts\/\d+)?\/?$/.test(parsed.pathname)
    || parsed.search
    || parsed.hash
  ) {
    throw new Error('workflow_run_url must be a GitHub Actions run URL.');
  }
  return value;
}

async function sha256File(filePath) {
  const bytes = await readFile(filePath);
  return createHash('sha256').update(bytes).digest('hex');
}

function normalizeAuthoritative(authoritative) {
  assertObject(authoritative, 'authoritative backend evidence');
  const counts = {
    accepted_check_ins: authoritative.accepted_check_ins ?? authoritative.accepted_checkins,
    checked_in_tickets: authoritative.checked_in_tickets ?? authoritative.checked_in_tickets_count,
    synchronized_check_ins: authoritative.synchronized_check_ins
      ?? authoritative.synchronized_checkins,
  };
  for (const [key, value] of Object.entries(counts)) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`Invalid authoritative count: ${key}.`);
  }
  const pass = Object.values(counts).every((value) => value === 1);
  const gateFingerprint = authoritative.gate_key_fingerprint;
  assertSha256(gateFingerprint, 'gate_key_fingerprint');
  return {
    artifact_paths: ['authoritative-backend.json', 'raw-evidence.json'],
    claimed_counts: { ...counts },
    gate_key_fingerprint: gateFingerprint,
    observed_counts: { ...counts },
    status: pass ? 'PASS' : 'FAIL',
  };
}

function scenarioRows(security, runId, duplicatePass) {
  assertObject(security, 'security matrix');
  if (!Array.isArray(security.scenarios)) throw new Error('Security matrix scenarios are required.');
  const rows = security.scenarios.map((row) => ({ ...assertObject(row, 'security scenario') }));
  const duplicateRow = {
    backend_consequence: duplicatePass
      ? 'idempotent_retry_one_authoritative_checkin_no_duplicate'
      : 'duplicate_synchronisation_not_verified',
    expected: 'REJECT',
    input_identity: `${runId}:duplicate_synchronisation`,
    observed: duplicatePass ? 'REJECT' : 'NOT_TESTED',
    reason_code: duplicatePass ? 'DUPLICATE_SYNC_IDEMPOTENT' : 'DUPLICATE_SYNC_NOT_TESTED',
    scenario: 'duplicate_synchronisation',
    status: duplicatePass ? 'PASS' : 'NOT_TESTED',
    timestamp: new Date().toISOString(),
  };
  const names = new Set(rows.map((row) => row.scenario));
  if (rows.some((row) => !SECURITY_SCENARIOS.slice(0, -1).includes(row.scenario)) || names.size !== rows.length) {
    throw new Error('Security matrix contains invalid or duplicate scenarios.');
  }
  return [...rows, duplicateRow];
}

function buildChecks(browser, native, privacy, securityRows, authoritative) {
  const browserChecks = assertObject(browser.checks, 'browser checks');
  const nativeChecks = assertObject(native.checks, 'native checks');
  const sc1Assertions = {
    attendee_authenticated: browserChecks.attendee_account_created === true,
    dashboard_updated: nativeChecks.dashboard_checked_in === true && authoritative.status === 'PASS',
    enrollment_completed: nativeChecks.enrollment_camera_capture_completed === true,
    foreign_claim_ownership_rejected: browserChecks.foreign_claim_ownership_rejected === true,
    foreign_ticket_ownership_rejected: browserChecks.foreign_ticket_ownership_rejected === true,
    gate_verification_succeeded: nativeChecks.gate_liveness_capture_accepted === true,
    intended_free_claim_succeeded: browserChecks.claim_code_format_valid === true,
    organizer_event_created: browserChecks.organizer_event_created === true,
    organizer_event_listed: browserChecks.event_listed === true,
    owned_ticket_recovered: browserChecks.attendee_wallet_checked === true,
    pass_issued: nativeChecks.enrollment_pass_issued === true,
  };
  const sc1Pass = Object.values(sc1Assertions).every(Boolean);
  const sc2Assertions = {
    fresh_revocation_state: nativeChecks.revocation_cache_fresh === true,
    no_live_backend_decision_path: nativeChecks.offline_acceptance === true,
    offline_evidence_present: nativeChecks.offline_queue_observed === true,
    valid_pass_accepted: nativeChecks.gate_liveness_capture_accepted === true,
  };
  const sc2Pass = Object.values(sc2Assertions).every(Boolean);
  const sc5Assertions = {
    after_restart_offline: nativeChecks.queue_persisted_after_restart === true,
    after_restart_pending_queue_count: nativeChecks.queue_persisted_after_restart ? 1 : 0,
    before_restart_pending_queue_count: nativeChecks.offline_queue_observed ? 1 : 0,
    dashboard_update_count: authoritative.status === 'PASS' && nativeChecks.dashboard_checked_in ? 1 : 0,
    idempotent_retry_no_duplicate: authoritative.status === 'PASS',
    original_gate_time: native.started_at,
    queue_cleared: nativeChecks.reconnect_sync === true,
    signed_reconnect_sync: nativeChecks.reconnect_sync === true,
  };
  const sc5Pass = sc5Assertions.after_restart_offline
    && sc5Assertions.after_restart_pending_queue_count === 1
    && sc5Assertions.before_restart_pending_queue_count === 1
    && sc5Assertions.dashboard_update_count === 1
    && sc5Assertions.idempotent_retry_no_duplicate
    && sc5Assertions.queue_cleared
    && sc5Assertions.signed_reconnect_sync
    && authoritative.status === 'PASS';
  const sc3Pass = privacy.status === 'PASS'
    && privacy.forbidden_reusable_biometrics_count === 0
    && privacy.reusable_biometrics_centrally_stored === false
    && privacy.source_only === false;
  const sc4Pass = securityRows.length === SECURITY_SCENARIOS.length
    && securityRows.every((row) => row.status === 'PASS');

  return {
    SC1: {
      artifact_paths: ['browser-report.json', 'native-report.json', 'authoritative-backend.json', 'raw-evidence.json'],
      assertions: sc1Assertions,
      status: sc1Pass ? 'PASS' : 'PARTIAL',
    },
    SC2: {
      artifact_paths: ['native-report.json', 'raw-evidence.json'],
      assertions: sc2Assertions,
      network_evidence_scope: 'relay_or_simulator',
      status: sc2Pass ? 'PASS' : 'PARTIAL',
    },
    SC3: {
      artifact_paths: ['privacy-audit.json', 'raw-evidence.json'],
      status: sc3Pass ? 'PASS' : privacy.status,
    },
    SC4: {
      artifact_paths: ['security-matrix.json', 'authoritative-backend.json', 'raw-evidence.json'],
      status: sc4Pass ? 'PASS' : 'PARTIAL',
    },
    SC5: {
      artifact_paths: ['native-report.json', 'authoritative-backend.json', 'raw-evidence.json'],
      assertions: sc5Assertions,
      status: sc5Pass ? 'PASS' : 'PARTIAL',
    },
  };
}

export async function assembleRunRecord({
  authoritativePath,
  browserPath,
  nativePath,
  outputRawEvidencePath,
  outputRecordPath,
  privacyPath,
  securityPath,
}) {
  const [authoritativeInput, browser, native, privacy, security] = await Promise.all([
    readJson(authoritativePath, 'authoritative backend evidence'),
    readJson(browserPath, 'browser report'),
    readJson(nativePath, 'native report'),
    readJson(privacyPath, 'privacy audit'),
    readJson(securityPath, 'security matrix'),
  ]);
  assertObject(browser, 'browser report');
  assertObject(native, 'native report');
  assertObject(privacy, 'privacy audit');
  const runId = browser.run_id;
  assertSafeIdentifier(runId, 'run_id');
  if (native.run_id !== runId || native.event_id !== browser.event_id) {
    throw new Error('Browser and native reports do not describe the same isolated run.');
  }
  const commitSha = native.commit_sha ?? browser.commit_sha;
  if (typeof commitSha !== 'string' || !/^[a-f0-9]{40}$/i.test(commitSha)) throw new Error('Invalid evaluated commit SHA.');
  const authoritative = normalizeAuthoritative(authoritativeInput);
  const duplicatePass = authoritative.status === 'PASS' && native.checks?.reconnect_sync === true;
  const securityRows = scenarioRows(security, runId, duplicatePass);
  const checks = buildChecks(browser, native, privacy, securityRows, authoritative);
  const workflowRunUrl = workflowUrl(native.workflow_run_url ?? browser.workflow_run_url);
  const startedAt = native.started_at ?? browser.started_at;
  assertIsoTimestamp(startedAt, 'started_at');
  assertSha256(native.face_fixture_sha256, 'fixture_sha256');
  assertSha256(browser.organizer_id_hash, 'organizer_id_hash');
  assertSha256(browser.attendee_id_hash, 'attendee_id_hash');
  assertSafeIdentifier(browser.event_id, 'event_id');
  assertSafeIdentifier(browser.ticket_id, 'ticket_id');
  const evidenceSections = [
    ...CRITERIA.map((criterion) => checks[criterion].status),
    securityRows.every((row) => row.status === 'PASS') ? 'PASS' : 'PARTIAL',
    privacy.status,
    authoritative.status,
  ];
  const overallStatus = evidenceSections.includes('FAIL')
    ? 'FAIL'
    : evidenceSections.every((status) => status === 'PASS')
      ? 'PASS'
      : 'PARTIAL';
  const failure = overallStatus === 'PASS' ? null : {
    category: 'CRITERION_FAILURE',
    diagnostics: { diagnostic_codes: ['REQUIRED_SCENARIO_NOT_TESTED'] },
    reason_code: 'CRITERION_EVIDENCE_INCOMPLETE',
    stage: 'POST_CREATION',
  };
  const artifactRoot = `artifacts/${runId}`;
  const artifactDirectory = path.join(path.dirname(outputRecordPath), 'artifacts', runId);
  await mkdir(artifactDirectory, { mode: 0o700, recursive: true });
  const artifactPaths = {
    authoritative: `${artifactRoot}/authoritative-backend.json`,
    browser: `${artifactRoot}/browser-report.json`,
    native: `${artifactRoot}/native-report.json`,
    privacy: `${artifactRoot}/privacy-audit.json`,
    raw: `${artifactRoot}/raw-evidence.json`,
    security: `${artifactRoot}/security-matrix.json`,
  };
  const record = {
    artifact_paths: [
      artifactPaths.raw,
      artifactPaths.browser,
      artifactPaths.native,
      artifactPaths.security,
      artifactPaths.privacy,
      artifactPaths.authoritative,
    ],
    attendee_id_hash: browser.attendee_id_hash,
    authoritative_backend: authoritative,
    checks,
    commit_sha: commitSha,
    counts_toward_target: true,
    event_id: browser.event_id,
    failure,
    fixture_sha256: native.face_fixture_sha256,
    gate_key_fingerprint: authoritative.gate_key_fingerprint,
    mutable_state_isolated: browser.mutable_state_isolated === true,
    network_loss_method: native.network_loss_method,
    organizer_id_hash: browser.organizer_id_hash,
    privacy_audit: {
      ...privacy,
      artifact_paths: ['privacy-audit.json', 'raw-evidence.json'],
    },
    provisioning_mode: native.provisioning_mode,
    provisioning_qr_camera_scan: native.provisioning_qr_camera_scan === true,
    run_id: runId,
    runner_os: native.runner_os,
    security_matrix: {
      ...security,
      artifact_paths: ['security-matrix.json', 'authoritative-backend.json', 'raw-evidence.json'],
      scenarios: securityRows,
      status: securityRows.every((row) => row.status === 'PASS') ? 'PASS' : 'PARTIAL',
    },
    started_at: startedAt,
    status: overallStatus,
    ticket_id: browser.ticket_id,
    workflow_run_url: workflowRunUrl,
  };
  record.checks.SC1.artifact_paths = [
    artifactPaths.browser,
    artifactPaths.native,
    artifactPaths.authoritative,
    artifactPaths.raw,
  ];
  record.checks.SC2.artifact_paths = [artifactPaths.native, artifactPaths.raw];
  record.checks.SC3.artifact_paths = [artifactPaths.privacy, artifactPaths.raw];
  record.checks.SC4.artifact_paths = [
    artifactPaths.security,
    artifactPaths.authoritative,
    artifactPaths.raw,
  ];
  record.checks.SC5.artifact_paths = [
    artifactPaths.native,
    artifactPaths.authoritative,
    artifactPaths.raw,
  ];
  record.privacy_audit.artifact_paths = [artifactPaths.privacy, artifactPaths.raw];
  record.security_matrix.artifact_paths = [
    artifactPaths.security,
    artifactPaths.authoritative,
    artifactPaths.raw,
  ];
  record.authoritative_backend.artifact_paths = [artifactPaths.authoritative, artifactPaths.raw];
  const rawEvidence = {
    schema_version: RAW_SCHEMA_VERSION,
    runs: {
      [runId]: {
        authoritative_backend: record.authoritative_backend,
        checks: record.checks,
        privacy_audit: record.privacy_audit,
        security_matrix: record.security_matrix,
      },
    },
  };
  await writeJson(outputRecordPath, record);
  await writeJson(outputRawEvidencePath, rawEvidence);
  await Promise.all([
    writeJson(path.join(artifactDirectory, 'authoritative-backend.json'), record.authoritative_backend),
    writeJson(path.join(artifactDirectory, 'browser-report.json'), browser),
    writeJson(path.join(artifactDirectory, 'native-report.json'), native),
    writeJson(path.join(artifactDirectory, 'privacy-audit.json'), privacy),
    writeJson(path.join(artifactDirectory, 'raw-evidence.json'), rawEvidence),
    writeJson(path.join(artifactDirectory, 'security-matrix.json'), record.security_matrix),
  ]);
  return { rawEvidence, record };
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || !value) throw new Error('Invalid command arguments.');
    values.set(flag, path.resolve(value));
  }
  const required = ['--authoritative', '--browser', '--native', '--output-raw', '--output-record', '--privacy', '--security'];
  if (values.size !== required.length || required.some((flag) => !values.has(flag))) {
    throw new Error(`Required arguments: ${required.join(', ')}.`);
  }
  return Object.fromEntries(required.map((flag) => [flag.slice(2).replaceAll('-', ''), values.get(flag)]));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArguments(process.argv.slice(2));
  await assembleRunRecord({
    authoritativePath: args.authoritative,
    browserPath: args.browser,
    nativePath: args.native,
    outputRawEvidencePath: args.outputraw,
    outputRecordPath: args.outputrecord,
    privacyPath: args.privacy,
    securityPath: args.security,
  });
  console.log('Assembled one safe SC1-SC5 run record.');
}
