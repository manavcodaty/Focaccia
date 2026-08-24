#!/usr/bin/env node

import {
  closeSync,
  constants as fsConstants,
  fchmodSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  opendirSync,
  readFileSync,
  realpathSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { isDeepStrictEqual, TextDecoder } from 'node:util';
import { inflateSync } from 'node:zlib';

const CRITERIA = ['SC1', 'SC2', 'SC3', 'SC4', 'SC5'];
const REQUIRED_RUNS = 10;
const RAW_EVIDENCE_SCHEMA_VERSION = 'sc1-sc5-raw-evidence-v1';
const MAX_RECORDS = lowerTestBudget('MAX_RECORDS', 100);
const MAX_INPUT_ENTRIES = lowerTestBudget('MAX_INPUT_ENTRIES', 2_000);
const MAX_RECURSIVE_FILES = lowerTestBudget('MAX_RECURSIVE_FILES', 1_000);
const MAX_RECURSION_DEPTH = lowerTestBudget('MAX_RECURSION_DEPTH', 8);
const MAX_FILE_BYTES = lowerTestBudget('MAX_FILE_BYTES', 16 * 1024 * 1024);
const MAX_TOTAL_BYTES = lowerTestBudget('MAX_TOTAL_BYTES', 256 * 1024 * 1024);
const MAX_ARTIFACT_PATHS_PER_RECORD = lowerTestBudget(
  'MAX_ARTIFACT_PATHS_PER_RECORD',
  256,
);
const MAX_RECORD_JSON_BYTES = lowerTestBudget('MAX_RECORD_JSON_BYTES', 2 * 1024 * 1024);
const MAX_PNG_COMPRESSED_BYTES = lowerTestBudget(
  'MAX_PNG_COMPRESSED_BYTES',
  16 * 1024 * 1024,
);
const MAX_PNG_DECODED_BYTES = lowerTestBudget(
  'MAX_PNG_DECODED_BYTES',
  64 * 1024 * 1024,
);
const MAX_PNG_DIMENSION = 8_192;
const CRC32_TABLE = createCrc32Table();
const IMAGE_REVIEW_METHODS = new Set([
  'MANUAL_VISUAL_SECRET_REVIEW',
  'MANUAL_VISUAL_SECRET_REVIEW_AND_REDACTION',
  'AUTOMATED_OCR_AND_MANUAL_VISUAL_SECRET_REVIEW',
]);
const FAILURE_CATEGORIES = new Set([
  'REMOTE_DISPATCH_PROHIBITED',
  'WORKFLOW_FAILURE',
  'RECONNECT_TIMEOUT',
  'CRITERION_FAILURE',
  'VALIDATION_FAILURE',
]);
const FAILURE_REASON_CODES = new Set([
  'ZERO_COST_UNVERIFIED',
  'UNSAFE_PUBLISHED_ARTIFACTS',
  'PRE_CREATION_FAILURE',
  'WORKFLOW_TIMEOUT',
  'RECONNECT_DID_NOT_COMPLETE',
  'CRITERION_EVIDENCE_INCOMPLETE',
  'REQUIRED_SCENARIO_NOT_TESTED',
]);
const FAILURE_DIAGNOSTIC_CODES = new Set([
  'MISSING_USER_PLAN_SCOPE',
  'MISSING_READ_PACKAGES_SCOPE',
  'NOT_AUTHORIZED_TO_DISPATCH',
  'NOT_AUTHORIZED_TO_PUSH',
  'NO_TARGET_OBSERVATIONS',
]);
const FAILURE_COUNT_DIAGNOSTICS = new Set([
  'expected_count',
  'observed_count',
]);
const FAILURE_BOOLEAN_DIAGNOSTICS = new Set(['reconnect_completed']);
const ALLOWED_STATUSES = ['PASS', 'PARTIAL', 'FAIL', 'NOT_TESTED', 'BLOCKED'];
const ISOLATION_IDENTITY_FIELDS = [
  'event_id',
  'organizer_id_hash',
  'attendee_id_hash',
  'ticket_id',
  'gate_key_fingerprint',
];
const SC1_REQUIRED_ASSERTIONS = [
  'organizer_event_created',
  'organizer_event_listed',
  'attendee_authenticated',
  'intended_free_claim_succeeded',
  'owned_ticket_recovered',
  'enrollment_completed',
  'pass_issued',
  'gate_verification_succeeded',
  'dashboard_updated',
  'foreign_ticket_ownership_rejected',
  'foreign_claim_ownership_rejected',
];
const SC2_REQUIRED_ASSERTIONS = [
  'fresh_revocation_state',
  'no_live_backend_decision_path',
  'valid_pass_accepted',
  'offline_evidence_present',
];
const SC3_REQUIRED_SURFACES = [
  'schema',
  'rows',
  'api_responses',
  'server_logs',
  'csv_exports',
  'retained_evidence',
];
const SC4_REQUIRED_SCENARIOS = [
  'genuine_unused_accept',
  'replayed_or_copied',
  'modified_or_tampered',
  'wrong_event',
  'expired_or_out_of_window',
  'cancelled_or_revoked_after_refresh',
  'duplicate_synchronisation',
];
const SC5_EXACT_ASSERTIONS = {
  after_restart_offline: true,
  after_restart_pending_queue_count: 1,
  before_restart_pending_queue_count: 1,
  dashboard_update_count: 1,
  idempotent_retry_no_duplicate: true,
  queue_cleared: true,
  signed_reconnect_sync: true,
};
const UNESTABLISHED_EVIDENCE = [
  'real-camera capture',
  'camera QR scanning',
  'physical radio loss',
  'participant FAR/FRR/EER',
  'demographic fairness',
  'sophisticated PAD',
  'user acceptance',
  'public deployment',
];
const REQUIRED_RECORD_FIELDS = [
  'run_id',
  'workflow_run_url',
  'commit_sha',
  'event_id',
  'organizer_id_hash',
  'attendee_id_hash',
  'ticket_id',
  'gate_key_fingerprint',
  'mutable_state_isolated',
  'runner_os',
  'started_at',
  'fixture_sha256',
  'provisioning_mode',
  'provisioning_qr_camera_scan',
  'network_loss_method',
  'checks',
  'security_matrix',
  'privacy_audit',
  'authoritative_backend',
  'artifact_paths',
  'status',
  'failure',
];

function lowerTestBudget(name, hardMaximum) {
  const raw = process.env[`SC1_SC5_TEST_${name}`];
  if (raw === undefined) return hardMaximum;
  if (!/^[1-9]\d*$/.test(raw)) throw new Error('Invalid reducer test budget override');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > hardMaximum) {
    throw new Error('Invalid reducer test budget override');
  }
  return value;
}

function parseArguments(argv) {
  const inputIndex = argv.indexOf('--input');
  const outputIndex = argv.indexOf('--output');

  if (inputIndex === -1 || outputIndex === -1 || !argv[inputIndex + 1] || !argv[outputIndex + 1]) {
    throw new Error('Usage: node scripts/aggregate-sc1-sc5-evidence.mjs --input <directory> --output <directory>');
  }

  return {
    input: path.resolve(argv[inputIndex + 1]),
    output: path.resolve(argv[outputIndex + 1]),
  };
}

function validateInputAndOutputPaths(inputDirectory, outputDirectory) {
  assertSeparateDirectories(inputDirectory, outputDirectory);
  assertPathHasNoSymlinks(inputDirectory, 'input');
  const inputStats = lstatSync(inputDirectory);
  if (!inputStats.isDirectory()) throw new Error('Input path must be a directory');
  const inputRealPath = realpathSync(inputDirectory);

  assertPathHasNoSymlinks(outputDirectory, 'output');
  return { inputDirectory: inputRealPath, outputDirectory };
}

function createSafeOutputDirectory(inputDirectory, outputDirectory) {
  mkdirSync(outputDirectory, { mode: 0o700, recursive: true });
  assertPathHasNoSymlinks(outputDirectory, 'output');
  const outputStats = lstatSync(outputDirectory);
  if (!outputStats.isDirectory() || outputStats.isSymbolicLink()) {
    throw new Error('Unsafe output directory rejected');
  }
  const outputRealPath = realpathSync(outputDirectory);
  assertSeparateDirectories(inputDirectory, outputRealPath);
  return outputRealPath;
}

function assertSeparateDirectories(inputDirectory, outputDirectory) {
  if (isSameOrNestedPath(inputDirectory, outputDirectory)
    || isSameOrNestedPath(outputDirectory, inputDirectory)) {
    throw new Error('Input and output directories must be separate and non-nested');
  }
}

function isSameOrNestedPath(candidate, ancestor) {
  const relative = path.relative(ancestor, candidate);
  return relative === '' || (
    relative !== '..'
    && !relative.startsWith(`..${path.sep}`)
    && !path.isAbsolute(relative)
  );
}

function assertPathHasNoSymlinks(candidate, label) {
  const parsed = path.parse(candidate);
  let current = parsed.root;
  const components = candidate.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (const component of components) {
    current = path.join(current, component);
    let stats;
    try {
      stats = lstatSync(current);
    } catch (error) {
      if (error?.code === 'ENOENT') return;
      throw error;
    }
    if (stats.isSymbolicLink()) {
      throw new Error(`Unsafe ${label} path contains a symlink`);
    }
  }
}

function readRecords(inputDirectory) {
  const context = createValidationContext(inputDirectory);
  const rootEntries = readBoundedDirectoryEntries(inputDirectory, context);
  const recordNames = rootEntries
    .filter((entry) => entry.name.endsWith('.json'))
    .map((entry) => entry.name)
    .sort(compareLexically);
  if (recordNames.some((name) => /baseline/i.test(name))) {
    throw new Error('Historical baseline files are unsafe and cannot be aggregated');
  }
  if (recordNames.length === 0) {
    throw new Error('No target or control records found in the input directory');
  }
  if (recordNames.length > MAX_RECORDS) {
    throw new Error('Input record count exceeds resource budget');
  }
  for (const name of recordNames) {
    const stats = lstatSync(path.join(inputDirectory, name));
    if (stats.isFile() && stats.size > MAX_RECORD_JSON_BYTES) {
      throw new Error('Record JSON exceeds resource budget');
    }
  }

  scanInputDirectoryForSecrets(inputDirectory, context, 0, rootEntries);
  const discoveredImagePaths = context.imagePaths;

  const records = recordNames
    .map((name) => {
      const cached = context.filesByPath.get(path.join(inputDirectory, name));
      if (cached === undefined || !cached.isJson) {
        throw new Error('Run record is not valid JSON evidence');
      }
      const record = cached.parsedJson;
      if (isHistoricalBaselineRecord(record)) {
        throw new Error('Historical baseline records are unsafe and cannot be aggregated');
      }
      return record;
    })
    .map((record, index) => validateRequiredFields(record, index, context));

  const runIds = new Set();
  for (const record of records) {
    if (runIds.has(record.run_id)) {
      throw new Error('Duplicate run_id detected');
    }
    runIds.add(record.run_id);
  }
  validateBatchIsolation(records);
  const artifactManifest = new Set(records.flatMap((record) => record.artifact_paths));
  if (discoveredImagePaths.some((artifactPath) => !artifactManifest.has(artifactPath))) {
    throw new Error('Missing image safety attestation for unreferenced image evidence');
  }

  return records.sort((left, right) => compareLexically(left.run_id, right.run_id));
}

function createValidationContext(inputDirectory) {
  return {
    entryCount: 0,
    fileCount: 0,
    filesByPath: new Map(),
    filesByRealPath: new Map(),
    imagePaths: [],
    inputDirectory,
    totalBytes: 0,
    validatedArtifacts: new Map(),
  };
}

function readBoundedDirectoryEntries(directory, context) {
  const entries = [];
  const directoryHandle = opendirSync(directory);
  try {
    while (true) {
      const entry = directoryHandle.readSync();
      if (entry === null) break;
      context.entryCount += 1;
      if (context.entryCount > MAX_INPUT_ENTRIES) {
        throw new Error('Input entry count exceeds resource budget');
      }
      entries.push(entry);
    }
  } finally {
    directoryHandle.closeSync();
  }
  return entries.sort((left, right) => compareLexically(left.name, right.name));
}

function compareLexically(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortedUnique(values) {
  return [...new Set(values)].sort(compareLexically);
}

function validateBatchIsolation(records) {
  const targetRecords = records.filter((record) => record.counts_toward_target !== false);
  const commits = new Set(targetRecords.map((record) => record.commit_sha));
  if (commits.size > 1) {
    throw new Error('Target records must evaluate a single pinned commit_sha');
  }
  if (new Set(records.map((record) => record.commit_sha)).size > 1) {
    throw new Error('All records must describe one evaluated commit_sha');
  }

  for (const field of [
    'workflow_run_url',
    ...ISOLATION_IDENTITY_FIELDS,
  ]) {
    const seen = new Set();
    for (const record of targetRecords) {
      if (record[field] === null) continue;
      if (seen.has(record[field])) {
        throw new Error(`Duplicate target ${field} detected`);
      }
      seen.add(record[field]);
    }
  }
}

function validateRequiredFields(record, index, context) {
  if (!isPlainObject(record)) {
    throw new Error(`Run record ${index + 1} must be an object`);
  }
  const isBlockedControl = record.record_type === 'blocked_preflight_control'
    && record.counts_toward_target === false;
  const isPreCreationFailure = isTargetPreCreationFailure(record);
  const controlNullableFields = new Set([
    'workflow_run_url',
    'event_id',
    'organizer_id_hash',
    'attendee_id_hash',
    'ticket_id',
    'gate_key_fingerprint',
    'fixture_sha256',
  ]);

  for (const field of REQUIRED_RECORD_FIELDS) {
    const nullIsAllowed = (isBlockedControl && controlNullableFields.has(field))
      || (isPreCreationFailure
        && (ISOLATION_IDENTITY_FIELDS.includes(field) || field === 'fixture_sha256'))
      || field === 'failure';
    if (!Object.hasOwn(record, field)
      || record[field] === undefined
      || (record[field] === null && !nullIsAllowed)) {
      throw new Error(`Run record ${index + 1} is missing required field: ${field}`);
    }
  }

  if (Object.hasOwn(record, 'counts_toward_target')
    && typeof record.counts_toward_target !== 'boolean') {
    throw new Error(`Run record ${index + 1} has invalid counts_toward_target`);
  }
  if (record.counts_toward_target === false && !isBlockedControl) {
    throw new Error(`Run record ${index + 1} has invalid counts_toward_target control marker`);
  }

  if (typeof record.commit_sha !== 'string' || !/^[a-f0-9]{40}$/i.test(record.commit_sha)) {
    throw new Error(`Run record ${index + 1} has an invalid pinned commit_sha`);
  }

  if (!isBlockedControl && !isWorkflowRunUrl(record.workflow_run_url)) {
    throw new Error(`Run record ${index + 1} has an invalid workflow_run_url`);
  }

  const identifierFields = ['run_id', 'event_id', 'ticket_id'];
  for (const field of identifierFields) {
    const nullIsAllowed = isBlockedControl
      || (isPreCreationFailure
        && (ISOLATION_IDENTITY_FIELDS.includes(field) || field === 'fixture_sha256'));
    if (record[field] === null && nullIsAllowed) continue;
    if (!isSafeIdentifier(record[field])) {
      throw new Error(`Run record ${index + 1} has invalid ${field}`);
    }
  }
  for (const field of [
    'organizer_id_hash',
    'attendee_id_hash',
    'gate_key_fingerprint',
    'fixture_sha256',
  ]) {
    const nullIsAllowed = isBlockedControl
      || (isPreCreationFailure
        && (ISOLATION_IDENTITY_FIELDS.includes(field) || field === 'fixture_sha256'));
    if (record[field] === null && nullIsAllowed) continue;
    if (!isBlockedControl && !isSha256(record[field])) {
      throw new Error(`Run record ${index + 1} has invalid ${field}`);
    }
  }
  for (const field of ['runner_os', 'provisioning_mode', 'network_loss_method']) {
    if (!isNonEmptyText(record[field])) {
      throw new Error(`Run record ${index + 1} has invalid ${field}`);
    }
  }
  if (typeof record.mutable_state_isolated !== 'boolean') {
    throw new Error(`Run record ${index + 1} has invalid mutable_state_isolated`);
  }
  if (typeof record.provisioning_qr_camera_scan !== 'boolean') {
    throw new Error(`Run record ${index + 1} has invalid provisioning_qr_camera_scan`);
  }
  if (!isIsoTimestamp(record.started_at)) {
    throw new Error(`Run record ${index + 1} has invalid started_at`);
  }

  if (!ALLOWED_STATUSES.includes(record.status)) {
    throw new Error(
      `Run record ${index + 1} has an invalid status; allowed: ${ALLOWED_STATUSES.join('|')}`,
    );
  }
  if (isBlockedControl && record.status !== 'BLOCKED') {
    throw new Error(`Run record ${index + 1} has invalid blocked preflight control status`);
  }
  if (record.status === 'PASS' && record.failure !== null) {
    throw new Error(`Run record ${index + 1} is PASS, so failure must be null`);
  }

  if (!isPlainObject(record.checks)) {
    throw new Error(`Run record ${index + 1} has invalid checks`);
  }
  for (const criterion of CRITERIA) {
    const check = record.checks[criterion];
    if (!isPlainObject(check) || !ALLOWED_STATUSES.includes(check.status)) {
      throw new Error(`Run record ${index + 1} has invalid checks.${criterion}.status`);
    }
    validateArtifactPathList(
      check.artifact_paths,
      `checks.${criterion}.artifact_paths`,
      index,
    );
  }

  for (const sectionName of ['security_matrix', 'privacy_audit', 'authoritative_backend']) {
    const section = record[sectionName];
    if (!isPlainObject(section)) {
      throw new Error(`Run record ${index + 1} has invalid ${sectionName}`);
    }
    if (!ALLOWED_STATUSES.includes(section.status)) {
      throw new Error(`Run record ${index + 1} has invalid ${sectionName}.status`);
    }
    validateArtifactPathList(section.artifact_paths, `${sectionName}.artifact_paths`, index);
  }
  if (isBlockedControl
    && (!CRITERIA.every((criterion) => record.checks[criterion].status === 'BLOCKED')
      || record.security_matrix.status !== 'BLOCKED'
      || record.authoritative_backend.status !== 'BLOCKED')) {
    throw new Error(`Run record ${index + 1} has inconsistent blocked preflight control evidence`);
  }
  if (isPreCreationFailure
    && ISOLATION_IDENTITY_FIELDS.some((field) => record[field] === null)
    && (!CRITERIA.every((criterion) => ['BLOCKED', 'NOT_TESTED'].includes(
      record.checks[criterion].status,
    ))
      || ['security_matrix', 'privacy_audit', 'authoritative_backend']
        .some((sectionName) => record[sectionName].status === 'PASS'))) {
    throw new Error(
      `Run record ${index + 1} has PASS evidence despite missing pre-creation identities`,
    );
  }
  validateArtifactPathList(record.artifact_paths, 'artifact_paths', index);
  validateAuthoritativeCounts(record.authoritative_backend, index);
  validateSuccessfulBackendClaims(record, index);
  validateSuccessfulJourneyClaims(record, index);
  validateSuccessfulAuditClaims(record, index);
  const passRecordIsConsistent = record.mutable_state_isolated
    && CRITERIA.every((criterion) => record.checks[criterion].status === 'PASS')
    && ['security_matrix', 'privacy_audit', 'authoritative_backend']
      .every((sectionName) => record[sectionName].status === 'PASS');
  if (record.status === 'PASS' && !passRecordIsConsistent) {
    throw new Error(`Run record ${index + 1} is an internally inconsistent PASS record`);
  }
  validateTargetRecordStatus(record, index, isPreCreationFailure);
  const artifactManifest = new Set(record.artifact_paths);
  for (const criterion of CRITERIA) {
    if (record.checks[criterion].artifact_paths.some((entry) => !artifactManifest.has(entry))) {
      throw new Error(
        `Run record ${index + 1} has invalid checks.${criterion}.artifact_paths manifest reference`,
      );
    }
  }
  for (const sectionName of ['security_matrix', 'privacy_audit', 'authoritative_backend']) {
    if (record[sectionName].artifact_paths.some((entry) => !artifactManifest.has(entry))) {
      throw new Error(
        `Run record ${index + 1} has invalid ${sectionName}.artifact_paths manifest reference`,
      );
    }
  }
  validateArtifactFiles(record, context, index);
  validateRawPassEvidence(record, context, index);

  if (record.status !== 'PASS') validateFailureSchema(record.failure, index);

  return record;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateFailureSchema(failure, index) {
  if (failure === null || failure === undefined
    || (isPlainObject(failure) && Object.keys(failure).length === 0)) {
    throw new Error(`Run record ${index + 1} is non-PASS but has no explicit failure`);
  }
  const invalid = () => {
    throw new Error(`Run record ${index + 1} has invalid failure schema`);
  };
  if (!isPlainObject(failure)) invalid();
  const allowedKeys = new Set(['category', 'diagnostics', 'reason_code', 'stage']);
  if (Object.keys(failure).some((key) => !allowedKeys.has(key))
    || !FAILURE_CATEGORIES.has(failure.category)
    || !FAILURE_REASON_CODES.has(failure.reason_code)) {
    invalid();
  }
  if (failure.stage !== undefined && !['PRE_CREATION', 'POST_CREATION'].includes(failure.stage)) {
    invalid();
  }
  if (failure.diagnostics !== undefined) {
    if (!isPlainObject(failure.diagnostics)
      || Object.entries(failure.diagnostics).some(
        ([key, value]) => !isValidFailureDiagnostic(key, value),
      )) {
      invalid();
    }
  }
}

function isValidFailureDiagnostic(key, value) {
  if (value === null) {
    return FAILURE_COUNT_DIAGNOSTICS.has(key)
      || FAILURE_BOOLEAN_DIAGNOSTICS.has(key)
      || key === 'diagnostic_codes';
  }
  if (FAILURE_COUNT_DIAGNOSTICS.has(key)) {
    return Number.isInteger(value) && value >= 0;
  }
  if (FAILURE_BOOLEAN_DIAGNOSTICS.has(key)) return typeof value === 'boolean';
  return key === 'diagnostic_codes'
    && Array.isArray(value)
    && value.length > 0
    && value.length <= 32
    && value.every((code) => FAILURE_DIAGNOSTIC_CODES.has(code));
}

function isTargetPreCreationFailure(record) {
  return record?.counts_toward_target !== false
    && ['FAIL', 'BLOCKED'].includes(record?.status)
    && isPlainObject(record?.failure)
    && record.failure.stage === 'PRE_CREATION';
}

function validateTargetRecordStatus(record, index, isPreCreationFailure) {
  if (record.counts_toward_target === false) return;
  const evidenceStatuses = [
    ...CRITERIA.map((criterion) => record.checks[criterion].status),
    record.security_matrix.status,
    record.privacy_audit.status,
    record.authoritative_backend.status,
  ];
  const expectedStatus = evidenceStatuses.includes('FAIL')
    ? 'FAIL'
    : evidenceStatuses.includes('BLOCKED')
      ? 'BLOCKED'
      : evidenceStatuses.every((status) => status === 'PASS')
        ? 'PASS'
        : evidenceStatuses.every((status) => status === 'NOT_TESTED')
          ? 'NOT_TESTED'
          : 'PARTIAL';
  const allowedPreCreationStatus = isPreCreationFailure
    && ['FAIL', 'BLOCKED'].includes(record.status)
    && evidenceStatuses.every((status) => ['BLOCKED', 'NOT_TESTED'].includes(status));
  if (record.status !== expectedStatus && !allowedPreCreationStatus) {
    throw new Error(
      `Run record ${index + 1} has inconsistent top-level status; expected ${expectedStatus}`,
    );
  }
}

function isHistoricalBaselineRecord(record) {
  if (!isPlainObject(record)) return false;
  const markerKeys = new Set([
    'dataset_type',
    'evidence_role',
    'evidence_type',
    'record_role',
    'record_type',
    'run_type',
  ]);
  const booleanKeys = new Set(['historical_baseline', 'is_historical_baseline']);
  const normalize = (value) => typeof value === 'string'
    ? value.replace(/[^A-Za-z0-9]+/g, '_').toLowerCase().replace(/^_+|_+$/g, '')
    : '';
  const hasMarker = (candidate) => {
    if (!isPlainObject(candidate)) return false;
    for (const [key, value] of Object.entries(candidate)) {
      const normalizedKey = normalize(key);
      const normalizedValue = normalize(value);
      if (booleanKeys.has(normalizedKey) && value === true) return true;
      if (markerKeys.has(normalizedKey)
        && ['baseline', 'historical_baseline'].includes(normalizedValue)) return true;
      if (normalizedKey === 'metadata' && hasMarker(value)) return true;
    }
    return false;
  };
  return hasMarker(record);
}

function assertNoSecrets(value) {
  const visit = (candidate) => {
    if (typeof candidate === 'string') {
      const valueCategory = secretCategoryForValue(candidate);
      if (valueCategory) throwSecretError(valueCategory);
      return;
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) visit(item);
      return;
    }
    if (!isPlainObject(candidate)) return;

    for (const [key, child] of Object.entries(candidate)) {
      const keyCategory = secretCategoryForKey(key);
      if (keyCategory && !isExplicitlyRedacted(child)) {
        throwSecretError(keyCategory);
      }
      visit(child);
    }
  };

  visit(value);
}

function secretCategoryForKey(key) {
  const normalized = key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .toLowerCase()
    .replace(/^_+|_+$/g, '');

  if (/^(?:.*_)?(?:password|passwd|passphrase)$/.test(normalized)) return 'password';
  if (/(?:^|_)service_role_(?:key|secret|token)$/.test(normalized)) return 'service-role';
  if (/(?:^|_)private_key$/.test(normalized)) return 'private-key';
  if (/^(?:access|refresh|id|auth|bearer|github|gitlab|full)_token$/.test(normalized)
    || /(?:^|_)(?:full_)?pass_token$/.test(normalized)
    || normalized === 'authorization') return 'full-token';
  if (/^(?:provisioning|qr)(?:_qr)?_payload$/.test(normalized)) {
    return 'provisioning-payload';
  }
  return null;
}

function secretCategoryForValue(value) {
  const assignmentRules = [
    ['password', /\b(?:password|passwd|passphrase)\b\s*[:=]\s*(?!\[?(?:REDACTED|REMOVED|MASKED)\]?|\*{3,})\S+/i],
    ['service-role', /\bservice[_ -]?role[_ -]?(?:key|secret|token)\b\s*[:=]\s*(?!\[?(?:REDACTED|REMOVED|MASKED)\]?|\*{3,})\S+/i],
    ['private-key', /\bprivate[_ -]?key\b\s*[:=]\s*(?!\[?(?:REDACTED|REMOVED|MASKED)\]?|\*{3,})\S+/i],
    ['full-token', /\b(?:(?:access|refresh|auth|bearer|github|gitlab|full)[_ -]?token|(?:full[_ -]?)?pass[_ -]?token)\b\s*[:=]\s*(?!\[?(?:REDACTED|REMOVED|MASKED)\]?|\*{3,})\S+/i],
    ['provisioning-payload', /\b(?:provisioning|qr)(?:[_ -]?qr)?[_ -]?payload\b\s*[:=]\s*(?!\[?(?:REDACTED|REMOVED|MASKED)\]?|\*{3,})\S+/i],
  ];
  for (const [category, pattern] of assignmentRules) {
    if (pattern.test(value)) return category;
  }
  if (/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(value)) return 'private-key';
  if (/\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i.test(value)) return 'full-token';
  if (/\b(?:gh[pousr]|github_pat|glpat|sbp|sk_live)_[A-Za-z0-9_-]{16,}\b/.test(value)) {
    return 'full-token';
  }
  if (/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/.test(value)) {
    return 'full-token';
  }
  return null;
}

function isExplicitlyRedacted(value) {
  return value === null || (typeof value === 'string'
    && /^(?:\[?REDACTED\]?|\[?REMOVED\]?|\[?MASKED\]?|OMITTED|NOT_STORED|\*{3,})$/i
      .test(value.trim()));
}

function throwSecretError(category) {
  throw new Error(`Secret-bearing input rejected (category: ${category})`);
}

function validateArtifactPathList(value, field, index) {
  if (!Array.isArray(value)
    || value.length === 0
    || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`Run record ${index + 1} has invalid ${field}`);
  }
  if (value.length > MAX_ARTIFACT_PATHS_PER_RECORD) {
    throw new Error(`Run record ${index + 1} ${field} exceeds artifact_paths resource budget`);
  }
  if (new Set(value).size !== value.length) {
    throw new Error(`Run record ${index + 1} has duplicate ${field}`);
  }
}

function validateArtifactFiles(record, context, index) {
  const imageArtifacts = [];

  for (const artifactPath of record.artifact_paths) {
    const artifact = getValidatedArtifact(artifactPath, context, index);
    if (artifact.mediaType !== null) imageArtifacts.push({ artifactPath, ...artifact });
  }

  validateImageSafetyAttestations(record, imageArtifacts, index);
}

function getValidatedArtifact(artifactPath, context, index) {
  const cached = context.validatedArtifacts.get(artifactPath);
  if (cached !== undefined) return cached;

  const isNormalizedRelativePath = !path.isAbsolute(artifactPath)
    && !artifactPath.includes('\\')
    && artifactPath.length <= 1024
    && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(artifactPath)
    && artifactPath === path.posix.normalize(artifactPath)
    && !artifactPath.split('/').some((part) => part === '' || part === '.' || part === '..');
  if (!isNormalizedRelativePath) {
    throw new Error(`Run record ${index + 1} has invalid artifact_paths reference`);
  }

  const candidate = path.resolve(context.inputDirectory, artifactPath);
  let candidateRealPath;
  try {
    candidateRealPath = realpathSync(candidate);
    const staysInsideInput = candidateRealPath.startsWith(
      `${context.inputDirectory}${path.sep}`,
    );
    const stats = lstatSync(candidate);
    if (!staysInsideInput || stats.isSymbolicLink() || !stats.isFile()) {
      throw new Error('unsafe artifact');
    }
  } catch (error) {
    throw new Error(`Run record ${index + 1} has invalid artifact_paths reference`);
  }

  const scanned = context.filesByRealPath.get(candidateRealPath);
  if (scanned === undefined) {
    throw new Error(`Run record ${index + 1} has invalid artifact_paths reference`);
  }
  const validated = {
    bytes: scanned.bytes,
    mediaType: scanned.mediaType,
    parsedJson: scanned.parsedJson,
  };
  context.validatedArtifacts.set(artifactPath, validated);
  return validated;
}

function inspectArtifactBytes(artifactPath, bytes) {
  const imageMediaType = classifyImageEvidence(artifactPath, bytes);
  if (imageMediaType !== null) {
    return { isJson: false, mediaType: imageMediaType, parsedJson: null };
  }
  if (bytes.includes(0)) {
    throw new Error('Unsupported NUL-bearing binary evidence rejected');
  }

  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('Unsupported binary evidence rejected');
  }
  let parsed;
  let isJson = false;
  try {
    parsed = JSON.parse(text);
    isJson = true;
  } catch {
    // Non-JSON evidence such as logs is scanned as text below.
  }

  if (isJson) {
    assertNoSecrets(parsed);
    return { isJson: true, mediaType: null, parsedJson: parsed };
  }

  assertNoSecrets(text);
  return { isJson: false, mediaType: null, parsedJson: null };
}

function classifyImageEvidence(artifactPath, bytes) {
  const extension = path.extname(artifactPath).toLowerCase();
  const hasJpegExtension = extension === '.jpg' || extension === '.jpeg';
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const hasPngMagic = bytes.length >= pngSignature.length
    && bytes.subarray(0, pngSignature.length).equals(pngSignature);
  const hasJpegMagic = bytes.length >= 2
    && bytes[0] === 0xff
    && bytes[1] === 0xd8;

  if (hasJpegExtension || hasJpegMagic) {
    throw new Error('Unsupported JPEG evidence rejected');
  }
  if (extension !== '.png' && !hasPngMagic) return null;
  if (extension !== '.png' || !hasPngMagic) {
    throw new Error('Image extension and magic bytes do not match');
  }
  validatePngStructure(bytes, pngSignature);
  return 'image/png';
}

function validatePngStructure(bytes, signature) {
  const invalid = () => {
    throw new Error('Invalid PNG structure rejected');
  };
  const invalidPixelStream = () => {
    throw new Error('Invalid PNG pixel stream rejected');
  };
  const singletonChunks = new Set();
  let offset = signature.length;
  let chunkIndex = 0;
  let header = null;
  let sawIdat = false;
  let idatBytes = 0;
  const idatChunks = [];

  while (offset < bytes.length) {
    if (bytes.length - offset < 12) invalid();
    const length = bytes.readUInt32BE(offset);
    if (length > bytes.length - offset - 12) invalid();
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    if ([...typeBytes].some((byte) => !(
      byte >= 0x41 && byte <= 0x5a
      || byte >= 0x61 && byte <= 0x7a
    ))) {
      throw new Error('Invalid PNG chunk type rejected');
    }
    const type = typeBytes.toString('ascii');
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    const expectedCrc = bytes.readUInt32BE(dataEnd);
    if (crc32(bytes.subarray(offset + 4, dataEnd)) !== expectedCrc) invalid();
    const data = bytes.subarray(dataStart, dataEnd);

    if (chunkIndex === 0 && type !== 'IHDR') invalid();
    if (type === 'IHDR') {
      if (chunkIndex !== 0 || singletonChunks.has(type) || length !== 13) invalid();
      const width = data.readUInt32BE(0);
      const height = data.readUInt32BE(4);
      const bitDepth = data[8];
      const colorType = data[9];
      const validBitDepths = {
        0: [1, 2, 4, 8, 16],
        2: [8, 16],
        4: [8, 16],
        6: [8, 16],
      };
      if (width === 0
        || height === 0
        || width > MAX_PNG_DIMENSION
        || height > MAX_PNG_DIMENSION
        || !validBitDepths[colorType]?.includes(bitDepth)
        || data[10] !== 0
        || data[11] !== 0
        || data[12] !== 0) {
        invalid();
      }
      const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
      const rowBytes = Math.ceil(width * channels * bitDepth / 8);
      const pixelStreamBytes = height * (rowBytes + 1);
      if (!Number.isSafeInteger(pixelStreamBytes)
        || pixelStreamBytes <= 0) {
        invalid();
      }
      if (pixelStreamBytes > MAX_PNG_DECODED_BYTES) {
        throw new Error('PNG decoded bytes exceed resource budget');
      }
      header = {
        bitDepth,
        bytesPerPixel: Math.max(1, Math.ceil(channels * bitDepth / 8)),
        colorType,
        height,
        pixelStreamBytes,
        rowBytes,
        width,
      };
      singletonChunks.add(type);
    } else if (type === 'IDAT') {
      if (!singletonChunks.has('IHDR') || sawIdat && singletonChunks.has('IDAT_ENDED')) {
        invalid();
      }
      sawIdat = true;
      idatBytes += length;
      if (idatBytes > MAX_PNG_COMPRESSED_BYTES) {
        throw new Error('PNG compressed bytes exceed resource budget');
      }
      idatChunks.push(data);
    } else if (type === 'IEND') {
      if (length !== 0
        || !sawIdat
        || idatBytes === 0
        || singletonChunks.has(type)
        || chunkEnd !== bytes.length) {
        invalid();
      }
      validatePngPixelStream(
        Buffer.concat(idatChunks, idatBytes),
        header,
        invalidPixelStream,
      );
      singletonChunks.add(type);
      return;
    } else {
      throw new Error('Non-canonical PNG chunk rejected');
    }

    if (sawIdat && type !== 'IDAT') singletonChunks.add('IDAT_ENDED');
    offset = chunkEnd;
    chunkIndex += 1;
  }
  invalid();
}

function validatePngPixelStream(compressed, header, invalid) {
  let inflated;
  try {
    const result = inflateSync(compressed, {
      info: true,
      maxOutputLength: header.pixelStreamBytes + 1,
    });
    if (result.engine.bytesWritten !== compressed.length) invalid();
    inflated = result.buffer;
  } catch {
    invalid();
  }
  if (inflated.length !== header.pixelStreamBytes) invalid();

  let offset = 0;
  let previousRow = Buffer.alloc(header.rowBytes);
  for (let rowIndex = 0; rowIndex < header.height; rowIndex += 1) {
    const filter = inflated[offset];
    if (filter > 4) invalid();
    const filteredRow = inflated.subarray(offset + 1, offset + 1 + header.rowBytes);
    if (filteredRow.length !== header.rowBytes) invalid();
    const decodedRow = decodePngRow(
      filter,
      filteredRow,
      previousRow,
      header.bytesPerPixel,
    );
    previousRow = decodedRow;
    offset += header.rowBytes + 1;
  }
  if (offset !== inflated.length) invalid();
}

function decodePngRow(filter, filteredRow, previousRow, bytesPerPixel) {
  const decoded = Buffer.allocUnsafe(filteredRow.length);
  for (let index = 0; index < filteredRow.length; index += 1) {
    const left = index >= bytesPerPixel ? decoded[index - bytesPerPixel] : 0;
    const above = previousRow[index];
    const upperLeft = index >= bytesPerPixel ? previousRow[index - bytesPerPixel] : 0;
    const predictor = filter === 0
      ? 0
      : filter === 1
        ? left
        : filter === 2
          ? above
          : filter === 3
            ? Math.floor((left + above) / 2)
            : paethPredictor(left, above, upperLeft);
    decoded[index] = (filteredRow[index] + predictor) & 0xff;
  }
  return decoded;
}

function paethPredictor(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createCrc32Table() {
  return Uint32Array.from({ length: 256 }, (_, value) => {
    let crc = value;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc >>> 1 ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return crc >>> 0;
  });
}

function validateImageSafetyAttestations(record, imageArtifacts, index) {
  const attestations = record.image_safety_attestations;
  if (Array.isArray(attestations)
    && attestations.some((attestation) => attestation?.media_type === 'image/jpeg')) {
    throw new Error('Unsupported JPEG evidence rejected');
  }
  if (imageArtifacts.length === 0) {
    if (attestations !== undefined && (!Array.isArray(attestations) || attestations.length !== 0)) {
      throw new Error(`Run record ${index + 1} has invalid image safety attestations`);
    }
    return;
  }
  if (!Array.isArray(attestations) || attestations.length === 0) {
    throw new Error(`Run record ${index + 1} is missing image safety attestation`);
  }

  const expectedKeys = [
    'artifact_path',
    'media_type',
    'redaction_status',
    'review_method',
    'sha256',
    'visual_secret_review_status',
  ];
  const seenPaths = new Set();
  for (const attestation of attestations) {
    if (!isPlainObject(attestation)
      || !isDeepStrictEqual(Object.keys(attestation).sort(compareLexically), expectedKeys)
      || typeof attestation.artifact_path !== 'string'
      || attestation.media_type !== 'image/png'
      || seenPaths.has(attestation.artifact_path)) {
      throw new Error(`Run record ${index + 1} has invalid image safety attestation`);
    }
    seenPaths.add(attestation.artifact_path);
  }

  for (const { artifactPath, bytes, mediaType } of imageArtifacts) {
    const attestation = attestations.find((entry) => entry.artifact_path === artifactPath);
    if (attestation === undefined) {
      throw new Error(`Run record ${index + 1} is missing image safety attestation`);
    }
    if (attestation.media_type !== mediaType) {
      throw new Error(`Run record ${index + 1} has an image safety attestation media type mismatch`);
    }
    if (attestation.redaction_status !== 'PASS'
      || attestation.visual_secret_review_status !== 'PASS') {
      throw new Error(`Run record ${index + 1} image safety attestation reviews must be PASS`);
    }
    if (!IMAGE_REVIEW_METHODS.has(attestation.review_method)) {
      throw new Error(`Run record ${index + 1} has a non-substantive image safety review method`);
    }
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (!isSha256(attestation.sha256) || attestation.sha256 !== digest) {
      throw new Error(`Run record ${index + 1} image safety attestation sha256 mismatch`);
    }
  }
  if (seenPaths.size !== imageArtifacts.length) {
    throw new Error(`Run record ${index + 1} has invalid image safety attestation references`);
  }
}

function scanInputDirectoryForSecrets(directory, context, depth = 0, knownEntries = null) {
  if (depth > MAX_RECURSION_DEPTH) {
    throw new Error('Input recursion depth exceeds resource budget');
  }
  const entries = knownEntries ?? readBoundedDirectoryEntries(directory, context);

  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error('Input directory contains an unsafe symbolic link');
    }
    if (entry.isDirectory()) {
      scanInputDirectoryForSecrets(candidate, context, depth + 1);
    } else if (entry.isFile()) {
      const stats = lstatSync(candidate);
      context.fileCount += 1;
      if (context.fileCount > MAX_RECURSIVE_FILES) {
        throw new Error('Input recursive file count exceeds resource budget');
      }
      if (stats.size > MAX_FILE_BYTES) {
        throw new Error('Input per-file bytes exceed resource budget');
      }
      context.totalBytes += stats.size;
      if (!Number.isSafeInteger(context.totalBytes) || context.totalBytes > MAX_TOTAL_BYTES) {
        throw new Error('Input total bytes exceed resource budget');
      }

      const candidateRealPath = realpathSync(candidate);
      if (!candidateRealPath.startsWith(`${context.inputDirectory}${path.sep}`)) {
        throw new Error('Input file resolves outside the input directory');
      }
      const bytes = readFileSync(candidate);
      if (bytes.length !== stats.size || bytes.length > MAX_FILE_BYTES) {
        throw new Error('Input file changed while being validated');
      }
      const inspected = inspectArtifactBytes(candidate, bytes);
      const cached = { bytes, ...inspected };
      context.filesByPath.set(candidate, cached);
      context.filesByRealPath.set(candidateRealPath, cached);
      if (inspected.mediaType !== null) {
        context.imagePaths.push(
          path.relative(context.inputDirectory, candidate).split(path.sep).join('/'),
        );
      }
    } else {
      throw new Error('Input directory contains unsupported filesystem evidence');
    }
  }
}

function validateAuthoritativeCounts(authoritativeBackend, index) {
  const claimed = authoritativeBackend.claimed_counts;
  const observed = authoritativeBackend.observed_counts;
  if (!isPlainObject(claimed) || !isPlainObject(observed)) {
    throw new Error(`Run record ${index + 1} has invalid authoritative backend counts`);
  }

  const claimedKeys = Object.keys(claimed).sort(compareLexically);
  const observedKeys = Object.keys(observed).sort(compareLexically);
  const countsAreValid = claimedKeys.length > 0
    && JSON.stringify(claimedKeys) === JSON.stringify(observedKeys)
    && claimedKeys.every((key) => Number.isInteger(claimed[key])
      && claimed[key] >= 0
      && Number.isInteger(observed[key])
      && observed[key] >= 0
      && claimed[key] === observed[key]);

  if (!countsAreValid) {
    throw new Error(`Run record ${index + 1} has an authoritative backend count mismatch`);
  }
}

function validateRawPassEvidence(record, context, index) {
  for (const criterion of ['SC1', 'SC2', 'SC5']) {
    if (record.checks[criterion].status === 'PASS') {
      validateRawBinding(
        record,
        record.checks[criterion].artifact_paths,
        context,
        index,
        criterion,
        record.checks[criterion],
        (rawRun) => rawRun?.checks?.[criterion],
      );
    }
  }

  if (record.privacy_audit.status === 'PASS') {
    validateRawBinding(
      record,
      record.privacy_audit.artifact_paths,
      context,
      index,
      'privacy_audit',
      record.privacy_audit,
      (rawRun) => rawRun?.privacy_audit,
    );
  }
  if (record.checks.SC3.status === 'PASS') {
    validateRawBinding(
      record,
      record.checks.SC3.artifact_paths,
      context,
      index,
      'privacy_audit',
      record.privacy_audit,
      (rawRun) => rawRun?.privacy_audit,
    );
  }

  if (record.security_matrix.status === 'PASS') {
    validateRawBinding(
      record,
      record.security_matrix.artifact_paths,
      context,
      index,
      'security_matrix',
      record.security_matrix,
      (rawRun) => rawRun?.security_matrix,
    );
  }
  if (record.checks.SC4.status === 'PASS') {
    validateRawBinding(
      record,
      record.checks.SC4.artifact_paths,
      context,
      index,
      'security_matrix',
      record.security_matrix,
      (rawRun) => rawRun?.security_matrix,
    );
  }

  if (record.authoritative_backend.status === 'PASS') {
    validateRawBinding(
      record,
      record.authoritative_backend.artifact_paths,
      context,
      index,
      'authoritative_backend',
      record.authoritative_backend,
      (rawRun) => rawRun?.authoritative_backend,
    );
  }
}

function validateRawBinding(
  record,
  artifactPaths,
  context,
  index,
  claimName,
  expected,
  selectCandidate,
) {
  for (const artifactPath of artifactPaths) {
    const parsed = context.validatedArtifacts.get(artifactPath)?.parsedJson;
    if (parsed === null || parsed === undefined) continue;
    if (parsed?.schema_version !== RAW_EVIDENCE_SCHEMA_VERSION) continue;
    const candidate = selectCandidate(parsed?.runs?.[record.run_id]);
    if (isDeepStrictEqual(candidate, expected)) return;
  }

  throw new Error(
    `Run record ${index + 1} has a raw evidence mismatch for ${claimName}`,
  );
}

function validateSuccessfulBackendClaims(record, index) {
  const observed = record.authoritative_backend.observed_counts;
  const sc1IsSuccessful = record.checks.SC1.status === 'PASS';
  const sc5IsSuccessful = record.checks.SC5.status === 'PASS';
  if ((sc1IsSuccessful || sc5IsSuccessful)
    && record.authoritative_backend.status !== 'PASS') {
    throw new Error(
      `Run record ${index + 1} requires authoritative backend evidence for successful SC1 check-in and SC5 synchronization claims`,
    );
  }

  if (sc1IsSuccessful) {
    for (const metric of ['accepted_check_ins', 'checked_in_tickets']) {
      if (observed[metric] !== 1) {
        throw new Error(
          `Run record ${index + 1} requires authoritative backend evidence for SC1 with exactly one ${metric}`,
        );
      }
    }
  }

  if (sc5IsSuccessful) {
    for (const metric of [
      'synchronized_check_ins',
      'accepted_check_ins',
      'checked_in_tickets',
    ]) {
      if (observed[metric] !== 1) {
        throw new Error(
          `Run record ${index + 1} requires SC5 authoritative backend evidence with exactly one ${metric}`,
        );
      }
    }
  }
}

function validateSuccessfulJourneyClaims(record, index) {
  if (record.checks.SC1.status === 'PASS') {
    const assertions = record.checks.SC1.assertions;
    for (const assertion of SC1_REQUIRED_ASSERTIONS) {
      if (!isPlainObject(assertions) || assertions[assertion] !== true) {
        throw new Error(
          `Run record ${index + 1} has invalid checks.SC1.assertions.${assertion}`,
        );
      }
    }
  }

  if (record.checks.SC2.status === 'PASS') {
    const assertions = record.checks.SC2.assertions;
    for (const assertion of SC2_REQUIRED_ASSERTIONS) {
      if (!isPlainObject(assertions) || assertions[assertion] !== true) {
        throw new Error(
          `Run record ${index + 1} has invalid checks.SC2.assertions.${assertion}`,
        );
      }
    }
    if (/^(?:NOT_TESTED|NONE|UNKNOWN|N\/A)$/i.test(record.network_loss_method)) {
      throw new Error(`Run record ${index + 1} has invalid SC2 network_loss_method`);
    }
    if (record.checks.SC2.network_evidence_scope !== 'relay_or_simulator') {
      throw new Error(
        `Run record ${index + 1} has invalid SC2 network_evidence_scope; only relay/simulator evidence is established`,
      );
    }
  }

  if (record.checks.SC5.status === 'PASS') {
    const assertions = record.checks.SC5.assertions;
    for (const [assertion, expected] of Object.entries(SC5_EXACT_ASSERTIONS)) {
      if (!isPlainObject(assertions) || assertions[assertion] !== expected) {
        throw new Error(
          `Run record ${index + 1} has invalid checks.SC5.assertions.${assertion}`,
        );
      }
    }
    if (!isPlainObject(assertions) || !isIsoTimestamp(assertions.original_gate_time)) {
      throw new Error(
        `Run record ${index + 1} has invalid checks.SC5.assertions.original_gate_time`,
      );
    }
  }
}

function validateSuccessfulAuditClaims(record, index) {
  if (record.checks.SC3.status === 'PASS') {
    if (record.privacy_audit.status !== 'PASS') {
      throw new Error(`Run record ${index + 1} has invalid privacy_audit.status for SC3 PASS`);
    }
    if (!Array.isArray(record.privacy_audit.surfaces)) {
      throw new Error(`Run record ${index + 1} has invalid privacy_audit.surfaces`);
    }
    const surfaceNames = record.privacy_audit.surfaces.map((entry) => entry?.surface);
    if (new Set(surfaceNames).size !== surfaceNames.length) {
      throw new Error(`Run record ${index + 1} has duplicate privacy_audit.surfaces`);
    }
    for (const surface of SC3_REQUIRED_SURFACES) {
      const row = record.privacy_audit.surfaces.find((entry) => entry?.surface === surface);
      if (!isPlainObject(row) || row.scanned !== true) {
        throw new Error(
          `Run record ${index + 1} has invalid privacy_audit.surfaces entry for ${surface}`,
        );
      }
    }
    if (record.privacy_audit.forbidden_reusable_biometrics_count !== 0) {
      throw new Error(
        `Run record ${index + 1} has invalid privacy_audit.forbidden_reusable_biometrics_count`,
      );
    }
    const classification = record.privacy_audit.encrypted_gate_bound_payload_classification;
    if (!isNonEmptyText(classification)
      || !/encrypted/i.test(classification)
      || !/gate[_ -]?bound/i.test(classification)) {
      throw new Error(
        `Run record ${index + 1} has invalid privacy_audit.encrypted_gate_bound_payload_classification`,
      );
    }
    if (record.privacy_audit.reusable_biometrics_centrally_stored !== false) {
      throw new Error(
        `Run record ${index + 1} has invalid privacy_audit.reusable_biometrics_centrally_stored`,
      );
    }
    if (record.privacy_audit.source_only !== false) {
      throw new Error(`Run record ${index + 1} has invalid privacy_audit.source_only`);
    }
  }

  if (record.checks.SC4.status === 'PASS') {
    if (record.security_matrix.status !== 'PASS') {
      throw new Error(`Run record ${index + 1} has invalid security_matrix.status for SC4 PASS`);
    }
    const rows = record.security_matrix.scenarios;
    if (!Array.isArray(rows)) {
      throw new Error(`Run record ${index + 1} has invalid security_matrix.scenarios`);
    }
    const scenarioNames = rows.map((row) => row?.scenario);
    if (new Set(scenarioNames).size !== scenarioNames.length) {
      throw new Error(`Run record ${index + 1} has duplicate security_matrix.scenarios`);
    }
    for (const scenario of SC4_REQUIRED_SCENARIOS) {
      const row = rows.find((candidate) => candidate?.scenario === scenario);
      if (!isPlainObject(row)) {
        throw new Error(
          `Run record ${index + 1} is missing security_matrix.scenarios row for ${scenario}`,
        );
      }
      const expectedDecision = scenario === 'genuine_unused_accept' ? 'ACCEPT' : 'REJECT';
      const rowIsValid = isSafeIdentifier(row.input_identity)
        && row.expected === expectedDecision
        && row.observed === expectedDecision
        && isSafeIdentifier(row.reason_code)
        && isIsoTimestamp(row.timestamp)
        && isNonEmptyText(row.backend_consequence)
        && row.status === 'PASS';
      if (!rowIsValid) {
        throw new Error(
          `Run record ${index + 1} has invalid security_matrix.scenarios row for ${scenario}`,
        );
      }
    }
    const staleCache = record.security_matrix.stale_cache_limitation;
    if (!isPlainObject(staleCache)
      || staleCache.represented !== true
      || !ALLOWED_STATUSES.includes(staleCache.status)) {
      throw new Error(
        `Run record ${index + 1} has invalid security_matrix.stale_cache_limitation`,
      );
    }
  }
}

function isNonEmptyText(value) {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.length <= 256
    && !/[\u0000-\u001f\u007f]/.test(value);
}

function isSafeIdentifier(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 256
    && /^[A-Za-z0-9._:-]+$/.test(value);
}

function isSha256(value) {
  return typeof value === 'string' && /^(?:sha256:)?[a-f0-9]{64}$/i.test(value);
}

function isIsoTimestamp(value) {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(?:Z|[+-](\d{2}):(\d{2}))$/.exec(value);
  if (match === null) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText,
    offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const offsetHour = offsetHourText === undefined ? 0 : Number(offsetHourText);
  const offsetMinute = offsetMinuteText === undefined ? 0 : Number(offsetMinuteText);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth[month - 1]
    && hour <= 23
    && minute <= 59
    && second <= 59
    && offsetHour <= 23
    && offsetMinute <= 59;
}

function isWorkflowRunUrl(value) {
  if (typeof value !== 'string') return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'github.com'
      && url.username === ''
      && url.password === ''
      && url.search === ''
      && url.hash === ''
      && /^\/[^/]+\/[^/]+\/actions\/runs\/\d+(?:\/attempts\/\d+)?\/?$/.test(url.pathname);
  } catch {
    return false;
  }
}

function buildReceipt(records) {
  const targetRecords = records.filter((record) => record.counts_toward_target !== false);
  const targetObservations = targetRecords.filter(isTargetObservation);
  const controlRecords = records.filter((record) => record.counts_toward_target === false);
  const criteria = Object.fromEntries(CRITERIA.map((criterion) => {
    const results = targetRecords.map((record) => ({
      artifact_paths: getCriterionArtifactPaths(record, criterion),
      counts_as_observation: isTargetObservation(record),
      run_id: record.run_id,
      status: getCriterionEvidenceStatus(record, criterion),
      workflow_run_url: record.workflow_run_url,
    }));
    const observed = results.filter((result) => result.counts_as_observation
      && !['BLOCKED', 'NOT_TESTED'].includes(result.status));

    return [criterion, {
      numerator: observed.filter((result) => result.status === 'PASS').length,
      observed_denominator: observed.length,
      required_denominator: REQUIRED_RUNS,
      results,
      status: deriveCriterionStatus(results, controlRecords, criterion),
    }];
  }));

  const failureCategoryMap = new Map();
  for (const record of records.filter((candidate) => candidate.status !== 'PASS')) {
    const category = getFailureCategory(record.failure);
    const current = failureCategoryMap.get(category) ?? [];
    current.push(record.run_id);
    failureCategoryMap.set(category, current);
  }
  const failureCategories = [...failureCategoryMap.entries()]
    .sort(([left], [right]) => compareLexically(left, right))
    .map(([category, runIds]) => ({
      category,
      count: runIds.length,
      run_ids: sortedUnique(runIds),
    }));
  const failureRecords = records
    .filter((record) => record.status !== 'PASS')
    .map(buildFailureRecord);

  const status = targetRecords.some((record) => record.status === 'FAIL')
    || CRITERIA.some((criterion) => criteria[criterion].status === 'FAIL')
    ? 'FAIL'
    : targetRecords.some((record) => record.status === 'BLOCKED')
      ? 'BLOCKED'
    : targetRecords.length > 0
      && targetRecords.every((record) => record.status === 'NOT_TESTED')
      ? 'NOT_TESTED'
    : targetObservations.length === 0
      && controlRecords.some((record) => record.status === 'BLOCKED')
      ? 'BLOCKED'
    : CRITERIA.every((criterion) => criteria[criterion].status === 'PASS')
      && targetRecords.every((record) => record.status === 'PASS')
      ? 'PASS'
      : 'PARTIAL';

  const blockedControlScenarios = controlRecords
    .filter((record) => record.status === 'BLOCKED')
    .map((record) => ({
      artifact_paths: sortedUnique(record.artifact_paths),
      category: getFailureCategory(record.failure),
      counts_toward_target: false,
      provenance: {
        commit_sha: record.commit_sha,
        record_type: record.record_type,
        runner_os: record.runner_os,
        started_at: record.started_at,
      },
      run_id: record.run_id,
      workflow_run_url: record.workflow_run_url,
      workflow_state: 'NOT_DISPATCHED',
    }));
  const blockedTargetScenarios = targetRecords.flatMap((record) => {
    const blockedCriteria = CRITERIA.filter(
      (criterion) => record.checks[criterion].status === 'BLOCKED',
    );
    if (blockedCriteria.length === 0) return [];
    return [{
      artifact_paths: sortedUnique(blockedCriteria.flatMap(
        (criterion) => record.checks[criterion].artifact_paths,
      )),
      category: getFailureCategory(record.failure),
      counts_toward_target: true,
      criteria: blockedCriteria,
      run_id: record.run_id,
      workflow_run_url: record.workflow_run_url,
    }];
  });
  const blockedScenarios = [...blockedControlScenarios, ...blockedTargetScenarios];
  const notTestedScenarios = targetRecords.flatMap((record) => {
    const criteriaNotTested = CRITERIA.filter(
      (criterion) => record.checks[criterion].status === 'NOT_TESTED',
    );
    if (criteriaNotTested.length === 0) return [];
    const artifactPaths = sortedUnique(criteriaNotTested.flatMap(
      (criterion) => record.checks[criterion].artifact_paths,
    ));
    return [{
      artifact_paths: artifactPaths,
      criteria: criteriaNotTested,
      counts_toward_target: true,
      run_id: record.run_id,
      workflow_run_url: record.workflow_run_url,
    }];
  });
  const criteriaWithRequiredObservations = CRITERIA.filter(
    (criterion) => criteria[criterion].observed_denominator >= REQUIRED_RUNS,
  ).length;
  const traceableResults = CRITERIA.reduce(
    (total, criterion) => total + criteria[criterion].results.filter(
      (result) => isWorkflowRunUrl(result.workflow_run_url)
        && result.artifact_paths.length > 0,
    ).length,
    0,
  );

  return {
    blocked_scenarios: blockedScenarios,
    criteria,
    evaluated_commit_sha: records[0].commit_sha,
    evidence_completeness: {
      complete: criteriaWithRequiredObservations === CRITERIA.length
        && targetObservations.length >= REQUIRED_RUNS,
      control_records: controlRecords.length,
      criteria_with_required_observations: criteriaWithRequiredObservations,
      records_validated: records.length,
      target_observations_missing: Math.max(0, REQUIRED_RUNS - targetObservations.length),
      traceable_results: traceableResults,
    },
    evidence_scope: {
      image_review_trust_boundary: 'only canonical stripped, structurally decoded PNG image evidence is supported; reducer accepts only IHDR, IDAT, and IEND chunks and verifies PNG chunk framing, CRCs, exact zlib-decoded scanline structure, hash, path, media type, and attestation, but cannot independently determine whether pixel content contains secrets; visual redaction and secret review is an attested trust boundary, not automated proof',
      repeated_fixture_runs: 'controlled software repeatability only',
      unestablished: UNESTABLISHED_EVIDENCE,
      latency_policy: 'never infer latency from zero or missing fields',
    },
    failure_categories: failureCategories,
    failure_records: failureRecords,
    not_tested_scenarios: notTestedScenarios,
    status,
    target: {
      observed_target_runs: targetObservations.length,
      remaining_required_runs: Math.max(0, REQUIRED_RUNS - targetObservations.length),
      required_runs: REQUIRED_RUNS,
    },
  };
}

function isTargetObservation(record) {
  return record.counts_toward_target !== false
    && !isTargetPreCreationFailure(record)
    && record.mutable_state_isolated === true
    && ISOLATION_IDENTITY_FIELDS.every((field) => record[field] !== null);
}

function deriveCriterionStatus(results, controlRecords, criterion) {
  const observed = results.filter((result) => result.counts_as_observation
    && !['BLOCKED', 'NOT_TESTED'].includes(result.status));
  if (observed.some((result) => result.status === 'FAIL')) return 'FAIL';
  if (observed.some((result) => result.status === 'PARTIAL')) return 'PARTIAL';
  if (observed.length > 0) {
    return observed.length >= REQUIRED_RUNS
      && observed.every((result) => result.status === 'PASS')
      ? 'PASS'
      : 'PARTIAL';
  }
  if (results.some((result) => result.status === 'BLOCKED')) return 'BLOCKED';
  if (results.some((result) => result.status === 'NOT_TESTED')) return 'NOT_TESTED';
  if (controlRecords.some((record) => record.checks[criterion].status === 'BLOCKED')) {
    return 'BLOCKED';
  }
  return 'NOT_TESTED';
}

function getCriterionEvidenceStatus(record, criterion) {
  const supportingSection = {
    SC1: 'authoritative_backend',
    SC3: 'privacy_audit',
    SC4: 'security_matrix',
    SC5: 'authoritative_backend',
  }[criterion];
  const statuses = [record.checks[criterion].status];
  if (supportingSection) statuses.push(record[supportingSection].status);
  for (const status of ['FAIL', 'BLOCKED', 'NOT_TESTED', 'PARTIAL', 'PASS']) {
    if (statuses.includes(status)) return status;
  }
  return 'FAIL';
}

function getCriterionArtifactPaths(record, criterion) {
  const artifactPaths = [...record.checks[criterion].artifact_paths];
  if (criterion === 'SC1' || criterion === 'SC5') {
    artifactPaths.push(...record.authoritative_backend.artifact_paths);
  } else if (criterion === 'SC3') {
    artifactPaths.push(...record.privacy_audit.artifact_paths);
  } else if (criterion === 'SC4') {
    artifactPaths.push(...record.security_matrix.artifact_paths);
  }
  return sortedUnique(artifactPaths);
}

function getFailureCategory(failure) {
  if (isPlainObject(failure) && FAILURE_CATEGORIES.has(failure.category)) {
    return failure.category;
  }
  return 'UNCLASSIFIED_FAILURE';
}

function buildFailureRecord(record) {
  const failure = record.failure;
  const diagnostics = Object.hasOwn(failure, 'diagnostics')
    ? Object.fromEntries(Object.keys(failure.diagnostics).sort(compareLexically).map(
      (key) => [
        key,
        key === 'diagnostic_codes'
          ? sortedUnique(failure.diagnostics[key])
          : copySafeDiagnosticValue(failure.diagnostics[key]),
      ],
    ))
    : null;

  return {
    artifact_paths: sortedUnique(record.artifact_paths),
    category: getFailureCategory(failure),
    diagnostics,
    reason_code: failure.reason_code,
    run_id: record.run_id,
    workflow_run_url: record.workflow_run_url,
  };
}

function copySafeDiagnosticValue(value) {
  return Array.isArray(value) ? value.map(copySafeDiagnosticValue) : value;
}

function escapeMarkdownCell(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('|', '&#124;')
    .replaceAll('`', '&#96;')
    .replaceAll('\n', '<br>');
}

function buildMarkdown(receipt) {
  const lines = [
    '# SC1-SC5 Cloud Evidence Receipt',
    '',
    `Overall status: \`${receipt.status}\``,
    '',
    `Evaluated commit: \`${receipt.evaluated_commit_sha}\``,
    '',
    `Evidence completeness: ${receipt.target.observed_target_runs} of ${receipt.target.required_runs} target observations`,
    '',
    '## Criterion counts',
    '',
    '| Criterion | Numerator | Observed denominator | Required denominator | Status |',
    '| --- | ---: | ---: | ---: | --- |',
  ];

  for (const criterion of CRITERIA) {
    const summary = receipt.criteria[criterion];
    lines.push(
      `| ${criterion} | ${summary.numerator} | ${summary.observed_denominator} | ${summary.required_denominator} | \`${summary.status}\` |`,
    );
  }

  lines.push(
    '',
    '## Traceable results',
    '',
    '| Criterion | Run | Status | Workflow | Raw artifacts |',
    '| --- | --- | --- | --- | --- |',
  );

  for (const criterion of CRITERIA) {
    for (const result of receipt.criteria[criterion].results) {
      const artifacts = result.artifact_paths.map((artifactPath) => `\`${artifactPath}\``).join(', ');
      lines.push(
        `| ${criterion} | \`${result.run_id}\` | \`${result.status}\` | [workflow run](${result.workflow_run_url}) | ${artifacts} |`,
      );
    }
  }

  lines.push('', '## Failure categories', '');
  if (receipt.failure_categories.length === 0) {
    lines.push('None.');
  } else {
    lines.push(
      '| Category | Count | Runs |',
      '| --- | ---: | --- |',
      ...receipt.failure_categories.map((failure) => (
        `| \`${failure.category}\` | ${failure.count} | ${failure.run_ids.map((runId) => `\`${runId}\``).join(', ')} |`
      )),
    );
  }

  lines.push('', '## Failure details', '');
  if (receipt.failure_records.length === 0) {
    lines.push('None.');
  } else {
    lines.push(
      '| Run | Category | Reason code | Diagnostics | Workflow | Raw artifacts |',
      '| --- | --- | --- | --- | --- | --- |',
      ...receipt.failure_records.map((failure) => {
        const workflow = failure.workflow_run_url
          ? `[workflow run](${failure.workflow_run_url})`
          : 'not dispatched';
        const artifacts = failure.artifact_paths
          .map((artifactPath) => `\`${artifactPath}\``)
          .join(', ');
        const diagnostics = failure.diagnostics === null
          ? 'not provided'
          : escapeMarkdownCell(JSON.stringify(failure.diagnostics));
        return `| \`${failure.run_id}\` | \`${failure.category}\` | \`${failure.reason_code}\` | ${diagnostics} | ${workflow} | ${artifacts} |`;
      }),
    );
  }

  lines.push('', '## Blocked/not-tested scenarios', '');
  const scenarios = [
    ...receipt.blocked_scenarios.map((scenario) => ({ ...scenario, status: 'BLOCKED' })),
    ...receipt.not_tested_scenarios.map((scenario) => ({ ...scenario, status: 'NOT_TESTED' })),
  ];
  if (scenarios.length === 0) {
    lines.push('None.');
  } else {
    lines.push(
      '| Status | Record | Criteria | Counts toward target | Workflow | Raw artifacts |',
      '| --- | --- | --- | --- | --- | --- |',
      ...scenarios.map((scenario) => {
        const workflow = scenario.workflow_run_url
          ? `[workflow run](${scenario.workflow_run_url})`
          : 'not dispatched';
        const artifacts = scenario.artifact_paths.map((entry) => `\`${entry}\``).join(', ');
        const criteria = scenario.criteria?.map((criterion) => `\`${criterion}\``).join(', ')
          ?? 'preflight control';
        const countsTowardTarget = scenario.counts_toward_target ? 'yes' : 'no';
        return `| \`${scenario.status}\` | \`${scenario.run_id}\` | ${criteria} | ${countsTowardTarget} | ${workflow} | ${artifacts} |`;
      }),
    );
    if (receipt.target.observed_target_runs === 0) {
      lines.push(
        '',
        'Zero target observations were recorded; this is a truthful `BLOCKED` receipt, not an empty success.',
      );
    }
  }

  lines.push(
    '',
    '## Evidence boundary',
    '',
    'Repeated fixture-driven runs assess controlled software repeatability only.',
    '',
    '- real-camera capture remains unestablished',
    '- camera QR scanning remains unestablished',
    '- physical radio loss remains unestablished',
    '- participant FAR/FRR/EER remains unestablished',
    '- demographic fairness remains unestablished',
    '- sophisticated PAD remains unestablished',
    '- user acceptance remains unestablished',
    '- public deployment remains unestablished',
    '',
    'Latency is never inferred from zero or missing fields.',
    '',
    'Only canonical stripped, structurally decoded PNG image evidence is supported; the reducer accepts only IHDR, IDAT, and IEND chunks and verifies PNG chunk framing, CRCs, exact zlib-decoded scanline structure, hash, path, media type, and attestation, but cannot independently determine whether pixel content contains secrets; visual redaction and secret review is an attested trust boundary, not automated proof.',
  );

  return `${lines.join('\n')}\n`;
}

function validateReceiptDestinations(outputDirectory) {
  for (const receiptName of [
    'sc1-sc5-evidence-receipt.json',
    'sc1-sc5-evidence-receipt.md',
  ]) {
    validateReceiptDestination(path.join(outputDirectory, receiptName));
  }
}

function validateReceiptDestination(destination) {
  let stats;
  try {
    stats = lstatSync(destination);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  if (stats.isSymbolicLink()) {
    throw new Error('Unsafe symlinked receipt destination rejected');
  }
  if (!stats.isFile()) {
    throw new Error('Unsafe non-file receipt destination rejected');
  }
}

function writeReceiptAtomically(outputDirectory, receiptName, contents) {
  const destination = path.join(outputDirectory, receiptName);
  const temporary = path.join(
    outputDirectory,
    `.${receiptName}.${process.pid}.${randomUUID()}.tmp`,
  );
  let descriptor = null;
  let renamed = false;
  try {
    descriptor = openSync(
      temporary,
      fsConstants.O_WRONLY
        | fsConstants.O_CREAT
        | fsConstants.O_EXCL
        | fsConstants.O_NOFOLLOW,
      0o600,
    );
    fchmodSync(descriptor, 0o600);
    writeFileSync(descriptor, contents, { encoding: 'utf8' });
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = null;
    assertPathHasNoSymlinks(outputDirectory, 'output');
    validateReceiptDestination(destination);
    renameSync(temporary, destination);
    renamed = true;
  } finally {
    try {
      if (descriptor !== null) closeSync(descriptor);
    } finally {
      if (!renamed) {
        try {
          unlinkSync(temporary);
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
      }
    }
  }
}

function main() {
  const { input, output } = parseArguments(process.argv.slice(2));
  const {
    inputDirectory,
    outputDirectory: requestedOutputDirectory,
  } = validateInputAndOutputPaths(input, output);
  const receipt = buildReceipt(readRecords(inputDirectory));
  const outputDirectory = createSafeOutputDirectory(
    inputDirectory,
    requestedOutputDirectory,
  );
  validateReceiptDestinations(outputDirectory);
  writeReceiptAtomically(
    outputDirectory,
    'sc1-sc5-evidence-receipt.json',
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  writeReceiptAtomically(
    outputDirectory,
    'sc1-sc5-evidence-receipt.md',
    buildMarkdown(receipt),
  );
}

main();
