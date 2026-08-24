#!/usr/bin/env node

import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { isDeepStrictEqual, TextDecoder } from 'node:util';

const CRITERIA = ['SC1', 'SC2', 'SC3', 'SC4', 'SC5'];
const REQUIRED_RUNS = 10;
const RAW_EVIDENCE_SCHEMA_VERSION = 'sc1-sc5-raw-evidence-v1';
const IMAGE_REVIEW_METHODS = new Set([
  'MANUAL_VISUAL_SECRET_REVIEW',
  'MANUAL_VISUAL_SECRET_REVIEW_AND_REDACTION',
  'AUTOMATED_OCR_AND_MANUAL_VISUAL_SECRET_REVIEW',
]);
const FAILURE_DIAGNOSTIC_KEYS = new Set([
  'assertion',
  'attempt_count',
  'criterion',
  'diagnostic_codes',
  'expected',
  'expected_count',
  'observed',
  'observed_count',
  'phase',
  'retry_count',
]);
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

function readRecords(inputDirectory) {
  const recordNames = readdirSync(inputDirectory).filter((name) => name.endsWith('.json'));
  if (recordNames.some((name) => /baseline/i.test(name))) {
    throw new Error('Historical baseline files are unsafe and cannot be aggregated');
  }
  if (recordNames.length === 0) {
    throw new Error('No target or control records found in the input directory');
  }
  const discoveredImagePaths = scanInputDirectoryForSecrets(inputDirectory);

  const records = recordNames
    .map((name) => {
      const record = JSON.parse(readFileSync(path.join(inputDirectory, name), 'utf8'));
      assertNoSecrets(record);
      if (isHistoricalBaselineRecord(record)) {
        throw new Error('Historical baseline records are unsafe and cannot be aggregated');
      }
      return record;
    })
    .map((record, index) => validateRequiredFields(record, index, inputDirectory));

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

  return records.sort((left, right) => {
    if (left.run_id < right.run_id) return -1;
    if (left.run_id > right.run_id) return 1;
    return 0;
  });
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

function validateRequiredFields(record, index, inputDirectory) {
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
  validateArtifactFiles(record, inputDirectory, index);
  validateRawPassEvidence(record, inputDirectory, index);

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
    || !isFailureIdentifier(failure.category)
    || !isFailureIdentifier(failure.reason_code)) {
    invalid();
  }
  if (failure.stage !== undefined && !['PRE_CREATION', 'POST_CREATION'].includes(failure.stage)) {
    invalid();
  }
  if (failure.diagnostics !== undefined) {
    if (!isPlainObject(failure.diagnostics)
      || Object.keys(failure.diagnostics).some((key) => !FAILURE_DIAGNOSTIC_KEYS.has(key))
      || Object.values(failure.diagnostics).some((value) => !isSafeDiagnosticValue(value))) {
      invalid();
    }
  }
}

function isFailureIdentifier(value) {
  return typeof value === 'string'
    && /^[A-Z][A-Z0-9_]{1,63}$/.test(value);
}

function isSafeDiagnosticValue(value) {
  if (value === null || typeof value === 'boolean' || Number.isInteger(value)) return true;
  if (Array.isArray(value)) {
    return value.length <= 32 && value.every(isSafeDiagnosticValue);
  }
  if (typeof value !== 'string' || value.length > 64 || !isSafeIdentifier(value)) return false;
  if (/(?:password|passwd|passphrase|token|payload|private[_-]?key|service[_-]?role)/i.test(value)) {
    return false;
  }
  if (value.length >= 32 && stringEntropy(value) >= 4.2) return false;
  return true;
}

function stringEntropy(value) {
  const counts = new Map();
  for (const character of value) counts.set(character, (counts.get(character) ?? 0) + 1);
  return [...counts.values()].reduce((entropy, count) => {
    const probability = count / value.length;
    return entropy - probability * Math.log2(probability);
  }, 0);
}

function isTargetPreCreationFailure(record) {
  return record?.counts_toward_target !== false
    && ['FAIL', 'BLOCKED'].includes(record?.status)
    && isPlainObject(record?.failure)
    && typeof record.failure.stage === 'string'
    && record.failure.stage.replace(/[^A-Za-z0-9]+/g, '_').toUpperCase() === 'PRE_CREATION';
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
}

function validateArtifactFiles(record, inputDirectory, index) {
  const inputRoot = realpathSync(inputDirectory);
  const imageArtifacts = [];

  for (const artifactPath of record.artifact_paths) {
    const isNormalizedRelativePath = !path.isAbsolute(artifactPath)
      && !artifactPath.includes('\\')
      && artifactPath.length <= 1024
      && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(artifactPath)
      && artifactPath === path.posix.normalize(artifactPath)
      && !artifactPath.split('/').some((part) => part === '' || part === '.' || part === '..');
    if (!isNormalizedRelativePath) {
      throw new Error(`Run record ${index + 1} has invalid artifact_paths reference`);
    }

    const candidate = path.resolve(inputRoot, artifactPath);
    try {
      const candidateRealPath = realpathSync(candidate);
      const staysInsideInput = candidateRealPath.startsWith(`${inputRoot}${path.sep}`);
      const stats = lstatSync(candidate);
      if (!staysInsideInput || stats.isSymbolicLink() || !stats.isFile()) {
        throw new Error('unsafe artifact');
      }
    } catch (error) {
      throw new Error(`Run record ${index + 1} has invalid artifact_paths reference`);
    }

    const mediaType = assertArtifactHasNoSecrets(candidate);
    if (mediaType !== null) imageArtifacts.push({ artifactPath, candidate, mediaType });
  }

  validateImageSafetyAttestations(record, imageArtifacts, index);
}

function assertArtifactHasNoSecrets(artifactPath) {
  const bytes = readFileSync(artifactPath);
  const imageMediaType = classifyImageEvidence(artifactPath, bytes);
  if (imageMediaType !== null) return imageMediaType;
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
    return null;
  }

  assertNoSecrets(text);
  const assignmentRules = [
    ['password', /\b(?:password|passwd|passphrase)\b\s*[:=]\s*(?!\[?(?:REDACTED|REMOVED|MASKED)\]?|\*{3,})\S+/i],
    ['service-role', /\bservice[_-]?role[_-]?(?:key|secret|token)\b\s*[:=]\s*\S+/i],
    ['private-key', /\bprivate[_-]?key\b\s*[:=]\s*\S+/i],
    ['full-token', /\b(?:(?:access|refresh|auth|bearer|github|full|pass)[_-]?token|full[_-]?pass[_-]?token)\b\s*[:=]\s*\S+/i],
    ['provisioning-payload', /\b(?:provisioning|qr)(?:[_-]qr)?[_-]payload\b\s*[:=]\s*\S+/i],
  ];
  for (const [category, pattern] of assignmentRules) {
    if (pattern.test(text)) throwSecretError(category);
  }
  return null;
}

function classifyImageEvidence(artifactPath, bytes) {
  const extension = path.extname(artifactPath).toLowerCase();
  const extensionMediaType = extension === '.png'
    ? 'image/png'
    : extension === '.jpg' || extension === '.jpeg'
      ? 'image/jpeg'
      : null;
  const hasPngMagic = bytes.length >= 8
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const hasJpegMagic = bytes.length >= 5
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
    && bytes[bytes.length - 2] === 0xff
    && bytes[bytes.length - 1] === 0xd9;
  const magicMediaType = hasPngMagic ? 'image/png' : hasJpegMagic ? 'image/jpeg' : null;

  if (extensionMediaType === null && magicMediaType === null) return null;
  if (extensionMediaType !== magicMediaType) {
    throw new Error('Image extension and magic bytes do not match');
  }
  return extensionMediaType;
}

function validateImageSafetyAttestations(record, imageArtifacts, index) {
  const attestations = record.image_safety_attestations;
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
      || !isDeepStrictEqual(Object.keys(attestation).sort(), expectedKeys)
      || typeof attestation.artifact_path !== 'string'
      || seenPaths.has(attestation.artifact_path)) {
      throw new Error(`Run record ${index + 1} has invalid image safety attestation`);
    }
    seenPaths.add(attestation.artifact_path);
  }

  for (const { artifactPath, candidate, mediaType } of imageArtifacts) {
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
    const digest = createHash('sha256').update(readFileSync(candidate)).digest('hex');
    if (!isSha256(attestation.sha256) || attestation.sha256 !== digest) {
      throw new Error(`Run record ${index + 1} image safety attestation sha256 mismatch`);
    }
  }
  if (seenPaths.size !== imageArtifacts.length) {
    throw new Error(`Run record ${index + 1} has invalid image safety attestation references`);
  }
}

function scanInputDirectoryForSecrets(directory, rootDirectory = directory, imagePaths = []) {
  const entries = readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);

  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error('Input directory contains an unsafe symbolic link');
    }
    if (entry.isDirectory()) {
      scanInputDirectoryForSecrets(candidate, rootDirectory, imagePaths);
    } else if (entry.isFile()) {
      if (assertArtifactHasNoSecrets(candidate) !== null) {
        imagePaths.push(path.relative(rootDirectory, candidate).split(path.sep).join('/'));
      }
    }
  }
  return imagePaths;
}

function validateAuthoritativeCounts(authoritativeBackend, index) {
  const claimed = authoritativeBackend.claimed_counts;
  const observed = authoritativeBackend.observed_counts;
  if (!isPlainObject(claimed) || !isPlainObject(observed)) {
    throw new Error(`Run record ${index + 1} has invalid authoritative backend counts`);
  }

  const claimedKeys = Object.keys(claimed).sort();
  const observedKeys = Object.keys(observed).sort();
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

function validateRawPassEvidence(record, inputDirectory, index) {
  for (const criterion of ['SC1', 'SC2', 'SC5']) {
    if (record.checks[criterion].status === 'PASS') {
      validateRawBinding(
        record,
        record.checks[criterion].artifact_paths,
        inputDirectory,
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
      inputDirectory,
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
      inputDirectory,
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
      inputDirectory,
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
      inputDirectory,
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
      inputDirectory,
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
  inputDirectory,
  index,
  claimName,
  expected,
  selectCandidate,
) {
  for (const artifactPath of artifactPaths) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(path.resolve(inputDirectory, artifactPath), 'utf8'));
    } catch {
      continue;
    }
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
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && Number.isFinite(Date.parse(value));
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
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, runIds]) => ({
      category,
      count: runIds.length,
      run_ids: [...runIds].sort(),
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
      artifact_paths: record.artifact_paths,
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
      artifact_paths: [...new Set(blockedCriteria.flatMap(
        (criterion) => record.checks[criterion].artifact_paths,
      ))].sort(),
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
    const artifactPaths = [...new Set(criteriaNotTested.flatMap(
      (criterion) => record.checks[criterion].artifact_paths,
    ))].sort();
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
  return [...new Set(artifactPaths)].sort();
}

function getFailureCategory(failure) {
  if (isPlainObject(failure) && isSafeIdentifier(failure.category)) {
    return failure.category;
  }
  return 'UNCLASSIFIED_FAILURE';
}

function buildFailureRecord(record) {
  const failure = record.failure;
  const diagnostics = Object.hasOwn(failure, 'diagnostics')
    ? Object.fromEntries(Object.keys(failure.diagnostics).sort().map(
      (key) => [key, copySafeDiagnosticValue(failure.diagnostics[key])],
    ))
    : null;

  return {
    artifact_paths: [...record.artifact_paths].sort(),
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
  );

  return `${lines.join('\n')}\n`;
}

function main() {
  const { input, output } = parseArguments(process.argv.slice(2));
  const receipt = buildReceipt(readRecords(input));
  mkdirSync(output, { recursive: true });
  writeFileSync(
    path.join(output, 'sc1-sc5-evidence-receipt.json'),
    `${JSON.stringify(receipt, null, 2)}\n`,
  );
  writeFileSync(
    path.join(output, 'sc1-sc5-evidence-receipt.md'),
    buildMarkdown(receipt),
  );
}

main();
