#!/usr/bin/env node

import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const CRITERIA = ['SC1', 'SC2', 'SC3', 'SC4', 'SC5'];
const REQUIRED_RUNS = 10;
const ALLOWED_STATUSES = ['PASS', 'PARTIAL', 'FAIL', 'NOT_TESTED', 'BLOCKED'];
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
  scanInputDirectoryForSecrets(inputDirectory);

  const records = recordNames
    .map((name) => {
      const record = JSON.parse(readFileSync(path.join(inputDirectory, name), 'utf8'));
      assertNoSecrets(record);
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

  return records.sort((left, right) => {
    if (left.run_id < right.run_id) return -1;
    if (left.run_id > right.run_id) return 1;
    return 0;
  });
}

function validateRequiredFields(record, index, inputDirectory) {
  if (!isPlainObject(record)) {
    throw new Error(`Run record ${index + 1} must be an object`);
  }
  const isBlockedControl = record.record_type === 'blocked_preflight_control'
    && record.counts_toward_target === false;
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
    const nullIsAllowed = isBlockedControl && controlNullableFields.has(field);
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

  const identifierFields = isBlockedControl ? ['run_id'] : ['run_id', 'event_id', 'ticket_id'];
  for (const field of identifierFields) {
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
  validateArtifactPathList(record.artifact_paths, 'artifact_paths', index);
  validateAuthoritativeCounts(record.authoritative_backend, index);
  validateSuccessfulBackendClaims(record, index);
  validateSuccessfulAuditClaims(record, index);
  const passRecordIsConsistent = record.mutable_state_isolated
    && CRITERIA.every((criterion) => record.checks[criterion].status === 'PASS')
    && ['security_matrix', 'privacy_audit', 'authoritative_backend']
      .every((sectionName) => record[sectionName].status === 'PASS');
  if (record.status === 'PASS' && !passRecordIsConsistent) {
    throw new Error(`Run record ${index + 1} is an internally inconsistent PASS record`);
  }
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
  validateArtifactFiles(record.artifact_paths, inputDirectory, index);
  validateAuthoritativeArtifactCounts(record, inputDirectory, index);

  if (record.status !== 'PASS' && !hasExplicitFailure(record.failure)) {
    throw new Error(`Run record ${index + 1} is non-PASS but has no explicit failure`);
  }

  return record;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExplicitFailure(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  return isPlainObject(value) && Object.keys(value).length > 0;
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

function validateArtifactFiles(artifactPaths, inputDirectory, index) {
  const inputRoot = realpathSync(inputDirectory);

  for (const artifactPath of artifactPaths) {
    const isNormalizedRelativePath = !path.isAbsolute(artifactPath)
      && !artifactPath.includes('\\')
      && artifactPath.length <= 1024
      && /^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(artifactPath)
      && artifactPath === path.posix.normalize(artifactPath)
      && !artifactPath.split('/').some((part) => part === '' || part === '.' || part === '..');
    if (!isNormalizedRelativePath) {
      throw new Error(`Run record ${index + 1} has invalid artifact_paths reference`);
    }

    try {
      const candidate = path.resolve(inputRoot, artifactPath);
      const candidateRealPath = realpathSync(candidate);
      const staysInsideInput = candidateRealPath.startsWith(`${inputRoot}${path.sep}`);
      const stats = lstatSync(candidate);
      if (!staysInsideInput || stats.isSymbolicLink() || !stats.isFile()) {
        throw new Error('unsafe artifact');
      }
      assertArtifactHasNoSecrets(candidate);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Secret-bearing input rejected')) {
        throw error;
      }
      throw new Error(`Run record ${index + 1} has invalid artifact_paths reference`);
    }
  }
}

function assertArtifactHasNoSecrets(artifactPath) {
  const bytes = readFileSync(artifactPath);
  if (bytes.includes(0)) return;

  const text = bytes.toString('utf8');
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
    return;
  }

  assertNoSecrets(text);
  const assignmentRules = [
    ['password', /\b(?:password|passwd|passphrase)\b\s*[:=]\s*(?!\[?(?:REDACTED|REMOVED|MASKED)\]?|\*{3,})\S+/i],
    ['service-role', /\bservice[_-]?role[_-]?(?:key|secret|token)\b\s*[:=]\s*\S+/i],
    ['private-key', /\bprivate[_-]?key\b\s*[:=]\s*\S+/i],
    ['full-token', /\b(?:access|refresh|auth|bearer|github|full)[_-]?token\b\s*[:=]\s*\S+/i],
    ['provisioning-payload', /\b(?:provisioning|qr)(?:[_-]qr)?[_-]payload\b\s*[:=]\s*\S+/i],
  ];
  for (const [category, pattern] of assignmentRules) {
    if (pattern.test(text)) throwSecretError(category);
  }
}

function scanInputDirectoryForSecrets(directory) {
  const entries = readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);

  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error('Input directory contains an unsafe symbolic link');
    }
    if (entry.isDirectory()) {
      scanInputDirectoryForSecrets(candidate);
    } else if (entry.isFile()) {
      assertArtifactHasNoSecrets(candidate);
    }
  }
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

function validateAuthoritativeArtifactCounts(record, inputDirectory, index) {
  if (record.authoritative_backend.status !== 'PASS') return;

  const expected = record.authoritative_backend.observed_counts;
  const metricNames = Object.keys(expected).sort();
  let foundCountArtifact = false;

  for (const artifactPath of record.authoritative_backend.artifact_paths) {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(path.resolve(inputDirectory, artifactPath), 'utf8'));
    } catch {
      continue;
    }
    const candidate = isPlainObject(parsed?.observed_counts)
      ? parsed.observed_counts
      : isPlainObject(parsed?.counts)
        ? parsed.counts
        : parsed;
    if (!isPlainObject(candidate)
      || !metricNames.every((metric) => Object.hasOwn(candidate, metric))) {
      continue;
    }

    foundCountArtifact = true;
    if (metricNames.some((metric) => candidate[metric] !== expected[metric])) {
      throw new Error(
        `Run record ${index + 1} has an authoritative backend artifact count mismatch`,
      );
    }
  }

  if (!foundCountArtifact) {
    throw new Error(
      `Run record ${index + 1} is missing authoritative backend artifact counts`,
    );
  }
}

function validateSuccessfulBackendClaims(record, index) {
  const observed = record.authoritative_backend.observed_counts;
  const sc1IsSuccessful = record.checks.SC1.status === 'PASS';
  const sc5IsSuccessful = record.checks.SC5.status === 'PASS';
  const lacksAuthoritativeEvidence = record.authoritative_backend.status !== 'PASS'
    || (sc1IsSuccessful && (!Number.isInteger(observed.successful_check_ins)
      || observed.successful_check_ins < 1))
    || (sc5IsSuccessful && (!Number.isInteger(observed.synchronized_check_ins)
      || observed.synchronized_check_ins < 1));

  if ((sc1IsSuccessful || sc5IsSuccessful) && lacksAuthoritativeEvidence) {
    throw new Error(
      `Run record ${index + 1} requires authoritative backend evidence for successful SC1 check-in and SC5 synchronization claims`,
    );
  }
}

function validateSuccessfulAuditClaims(record, index) {
  if (record.checks.SC3.status === 'PASS'
    && record.privacy_audit.reusable_biometrics_centrally_stored !== false) {
    throw new Error(
      `Run record ${index + 1} has unsupported SC3 PASS in privacy_audit`,
    );
  }

  if (record.checks.SC4.status === 'PASS') {
    for (const field of ['copied_pass_rejected', 'replay_rejected']) {
      if (record.security_matrix[field] !== 'PASS') {
        throw new Error(
          `Run record ${index + 1} has unsupported SC4 PASS in security_matrix.${field}`,
        );
      }
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
  const controlRecords = records.filter((record) => record.counts_toward_target === false);
  const criteria = Object.fromEntries(CRITERIA.map((criterion) => {
    const results = targetRecords.map((record) => ({
      artifact_paths: getCriterionArtifactPaths(record, criterion),
      run_id: record.run_id,
      status: record.checks[criterion].status,
      workflow_run_url: record.workflow_run_url,
    }));
    const observed = results.filter((result) => !['BLOCKED', 'NOT_TESTED'].includes(result.status));

    return [criterion, {
      numerator: observed.filter((result) => result.status === 'PASS').length,
      observed_denominator: observed.length,
      required_denominator: REQUIRED_RUNS,
      results,
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

  const status = targetRecords.length === 0
    && controlRecords.some((record) => record.status === 'BLOCKED')
    ? 'BLOCKED'
    : targetRecords.some((record) => record.status === 'FAIL')
    ? 'FAIL'
    : targetRecords.length > 0 && targetRecords.every((record) => record.status === 'BLOCKED')
      ? 'BLOCKED'
    : targetRecords.length >= REQUIRED_RUNS
      && targetRecords.every((record) => record.status === 'PASS')
      ? 'PASS'
      : 'PARTIAL';

  const blockedControlScenarios = controlRecords
    .filter((record) => record.status === 'BLOCKED')
    .map((record) => ({
      artifact_paths: record.artifact_paths,
      category: getFailureCategory(record.failure),
      counts_toward_target: false,
      run_id: record.run_id,
      workflow_run_url: record.workflow_run_url,
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
    evidence_completeness: {
      complete: criteriaWithRequiredObservations === CRITERIA.length
        && targetRecords.length >= REQUIRED_RUNS,
      control_records: controlRecords.length,
      criteria_with_required_observations: criteriaWithRequiredObservations,
      records_validated: records.length,
      target_observations_missing: Math.max(0, REQUIRED_RUNS - targetRecords.length),
      traceable_results: traceableResults,
    },
    evidence_scope: {
      repeated_fixture_runs: 'controlled software repeatability only',
      unestablished: UNESTABLISHED_EVIDENCE,
      latency_policy: 'never infer latency from zero or missing fields',
    },
    failure_categories: failureCategories,
    not_tested_scenarios: notTestedScenarios,
    status,
    target: {
      observed_target_runs: targetRecords.length,
      remaining_required_runs: Math.max(0, REQUIRED_RUNS - targetRecords.length),
      required_runs: REQUIRED_RUNS,
    },
  };
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

function buildMarkdown(receipt) {
  const lines = [
    '# SC1-SC5 Cloud Evidence Receipt',
    '',
    `Overall status: \`${receipt.status}\``,
    '',
    `Evidence completeness: ${receipt.target.observed_target_runs} of ${receipt.target.required_runs} target observations`,
    '',
    '## Criterion counts',
    '',
    '| Criterion | Numerator | Observed denominator | Required denominator |',
    '| --- | ---: | ---: | ---: |',
  ];

  for (const criterion of CRITERIA) {
    const summary = receipt.criteria[criterion];
    lines.push(
      `| ${criterion} | ${summary.numerator} | ${summary.observed_denominator} | ${summary.required_denominator} |`,
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
