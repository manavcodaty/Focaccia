import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const reducerPath = path.join(scriptsDirectory, 'aggregate-sc1-sc5-evidence.mjs');
const CRITERIA = ['SC1', 'SC2', 'SC3', 'SC4', 'SC5'];
const RAW_EVIDENCE_SCHEMA_VERSION = 'sc1-sc5-raw-evidence-v1';
const VALID_PNG = createTinyPng();
const JPEG_SHAPED_EVIDENCE = createJpegShapedEvidence();
const SECURITY_SCENARIOS = [
  'genuine_unused_accept',
  'replayed_or_copied',
  'modified_or_tampered',
  'wrong_event',
  'expired_or_out_of_window',
  'cancelled_or_revoked_after_refresh',
  'duplicate_synchronisation',
];

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  return pngChunkBytes(Buffer.from(type, 'ascii'), data);
}

function pngChunkBytes(typeBytes, data = Buffer.alloc(0)) {
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBytes.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 8 + data.length);
  return chunk;
}

function createTinyPng(options = {}) {
  const {
    bitDepth = 8,
    colorType = 6,
    compressionMethod = 0,
    filterMethod = 0,
    height = 1,
    idatPayload,
    idatSplitAt,
    interlaceMethod = 0,
    scanlines,
    width = 1,
  } = options;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([bitDepth, colorType, compressionMethod, filterMethod, interlaceMethod], 8);

  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType] ?? 1;
  const rowBytes = Math.ceil(width * channels * bitDepth / 8);
  const rawScanlines = scanlines ?? Buffer.concat(
    Array.from({ length: height }, () => Buffer.alloc(1 + rowBytes)),
  );
  const compressed = idatPayload ?? deflateSync(rawScanlines);
  const palette = Object.hasOwn(options, 'palette')
    ? options.palette
    : colorType === 3
      ? Buffer.alloc(3 * 2 ** bitDepth)
      : null;
  const idatChunks = Number.isInteger(idatSplitAt)
    ? [compressed.subarray(0, idatSplitAt), compressed.subarray(idatSplitAt)]
    : [compressed];

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    ...(palette === null ? [] : [pngChunk('PLTE', palette)]),
    ...idatChunks.map((data) => pngChunk('IDAT', data)),
    pngChunk('IEND'),
  ]);
}

function insertBeforePngIend(png, chunk) {
  return Buffer.concat([png.subarray(0, png.length - 12), chunk, png.subarray(png.length - 12)]);
}

function insertAfterPngIhdr(png, chunk) {
  return Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)]);
}

function jpegSegment(marker, data) {
  const segment = Buffer.alloc(4 + data.length);
  segment.set([0xff, marker], 0);
  segment.writeUInt16BE(data.length + 2, 2);
  data.copy(segment, 4);
  return segment;
}

function createJpegShapedEvidence() {
  const jfif = Buffer.from([
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01,
    0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ]);
  const quantizationTable = Buffer.from([0x00, ...Array(64).fill(1)]);
  const startOfFrame = Buffer.from([8, 0, 1, 0, 1, 1, 1, 0x11, 0]);
  const huffmanCounts = [1, ...Array(15).fill(0)];
  const dcHuffmanTable = Buffer.from([0x00, ...huffmanCounts, 0x00]);
  const acHuffmanTable = Buffer.from([0x10, ...huffmanCounts, 0x00]);
  const startOfScan = Buffer.from([1, 1, 0x00, 0, 63, 0]);
  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    jpegSegment(0xe0, jfif),
    jpegSegment(0xdb, quantizationTable),
    jpegSegment(0xc0, startOfFrame),
    jpegSegment(0xc4, dcHuffmanTable),
    jpegSegment(0xc4, acHuffmanTable),
    jpegSegment(0xda, startOfScan),
    Buffer.from([0x00]),
    Buffer.from([0xff, 0xd9]),
  ]);
}

function hashIdentity(value) {
  return createHash('sha256').update(value).digest('hex');
}

function passRecord(overrides = {}) {
  const { identity_seed: explicitIdentitySeed, ...recordOverrides } = overrides;
  const runId = recordOverrides.run_id ?? 'run-001';
  const identitySeed = explicitIdentitySeed ?? runId;
  const artifactPaths = [
    'artifacts/backend-counts.json',
    'artifacts/journey.json',
    'artifacts/privacy.json',
    'artifacts/security.json',
  ];

  return {
    artifact_paths: artifactPaths,
    attendee_id_hash: hashIdentity(`attendee:${identitySeed}`),
    authoritative_backend: {
      artifact_paths: ['artifacts/backend-counts.json'],
      claimed_counts: {
        accepted_check_ins: 1,
        checked_in_tickets: 1,
        synchronized_check_ins: 1,
      },
      observed_counts: {
        accepted_check_ins: 1,
        checked_in_tickets: 1,
        synchronized_check_ins: 1,
      },
      status: 'PASS',
    },
    checks: {
      SC1: {
        artifact_paths: ['artifacts/journey.json'],
        assertions: {
          attendee_authenticated: true,
          dashboard_updated: true,
          enrollment_completed: true,
          foreign_claim_ownership_rejected: true,
          foreign_ticket_ownership_rejected: true,
          gate_verification_succeeded: true,
          intended_free_claim_succeeded: true,
          organizer_event_created: true,
          organizer_event_listed: true,
          owned_ticket_recovered: true,
          pass_issued: true,
        },
        status: 'PASS',
      },
      SC2: {
        artifact_paths: ['artifacts/journey.json'],
        assertions: {
          fresh_revocation_state: true,
          no_live_backend_decision_path: true,
          offline_evidence_present: true,
          valid_pass_accepted: true,
        },
        network_evidence_scope: 'relay_or_simulator',
        status: 'PASS',
      },
      SC3: {
        artifact_paths: ['artifacts/privacy.json'],
        status: 'PASS',
      },
      SC4: {
        artifact_paths: ['artifacts/security.json'],
        status: 'PASS',
      },
      SC5: {
        artifact_paths: ['artifacts/journey.json'],
        assertions: {
          after_restart_offline: true,
          after_restart_pending_queue_count: 1,
          before_restart_pending_queue_count: 1,
          dashboard_update_count: 1,
          idempotent_retry_no_duplicate: true,
          original_gate_time: '2026-08-24T00:00:00.000Z',
          queue_cleared: true,
          signed_reconnect_sync: true,
        },
        status: 'PASS',
      },
    },
    commit_sha: 'a'.repeat(40),
    counts_toward_target: true,
    event_id: `event-${identitySeed}`,
    failure: null,
    fixture_sha256: 'c'.repeat(64),
    gate_key_fingerprint: hashIdentity(`gate:${identitySeed}`),
    mutable_state_isolated: true,
    network_loss_method: 'stopped_macOS_relay',
    organizer_id_hash: hashIdentity(`organizer:${identitySeed}`),
    privacy_audit: {
      artifact_paths: ['artifacts/privacy.json'],
      encrypted_gate_bound_payload_classification: 'encrypted_event_specific_gate_bound_non_reusable',
      forbidden_reusable_biometrics_count: 0,
      reusable_biometrics_centrally_stored: false,
      source_only: false,
      status: 'PASS',
      surfaces: [
        'schema',
        'rows',
        'api_responses',
        'server_logs',
        'csv_exports',
        'retained_evidence',
      ].map((surface) => ({ scanned: true, surface })),
    },
    provisioning_mode: 'e2e_payload_injection',
    provisioning_qr_camera_scan: false,
    run_id: runId,
    runner_os: 'macOS-15',
    security_matrix: {
      artifact_paths: ['artifacts/security.json'],
      scenarios: SECURITY_SCENARIOS.map((scenario, index) => ({
        backend_consequence: scenario === 'genuine_unused_accept'
          ? 'one_check_in_recorded'
          : 'no_additional_check_in',
        expected: scenario === 'genuine_unused_accept' ? 'ACCEPT' : 'REJECT',
        input_identity: `${identitySeed}:${scenario}`,
        observed: scenario === 'genuine_unused_accept' ? 'ACCEPT' : 'REJECT',
        reason_code: `SCENARIO_${index + 1}_EXPECTED`,
        scenario,
        status: 'PASS',
        timestamp: `2026-08-24T00:00:${String(index + 1).padStart(2, '0')}.000Z`,
      })),
      stale_cache_limitation: {
        represented: true,
        status: 'NOT_TESTED',
      },
      status: 'PASS',
    },
    started_at: '2026-08-24T00:00:00.000Z',
    status: 'PASS',
    ticket_id: `ticket-${identitySeed}`,
    workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1001',
    ...recordOverrides,
  };
}

function blockedControlRecord(overrides = {}) {
  const record = passRecord({
    attendee_id_hash: null,
    authoritative_backend: {
      artifact_paths: ['artifacts/security.json'],
      claimed_counts: {
        accepted_check_ins: 0,
        checked_in_tickets: 0,
        synchronized_check_ins: 0,
      },
      observed_counts: {
        accepted_check_ins: 0,
        checked_in_tickets: 0,
        synchronized_check_ins: 0,
      },
      status: 'BLOCKED',
    },
    counts_toward_target: false,
    event_id: null,
    failure: {
      category: 'REMOTE_DISPATCH_PROHIBITED',
      diagnostics: {
        diagnostic_codes: [
          'MISSING_USER_PLAN_SCOPE',
          'MISSING_READ_PACKAGES_SCOPE',
          'NOT_AUTHORIZED_TO_DISPATCH',
          'NOT_AUTHORIZED_TO_PUSH',
          'NO_TARGET_OBSERVATIONS',
        ],
      },
      reason_code: 'ZERO_COST_UNVERIFIED',
    },
    fixture_sha256: null,
    gate_key_fingerprint: null,
    mutable_state_isolated: false,
    network_loss_method: 'NOT_TESTED',
    organizer_id_hash: null,
    provisioning_mode: 'NOT_TESTED',
    record_type: 'blocked_preflight_control',
    run_id: 'blocked-preflight-001',
    status: 'BLOCKED',
    ticket_id: null,
    workflow_run_url: null,
    ...overrides,
  });
  for (const criterion of CRITERIA) {
    record.checks[criterion] = {
      artifact_paths: ['artifacts/security.json'],
      status: 'BLOCKED',
    };
  }
  record.security_matrix = {
    artifact_paths: ['artifacts/security.json'],
    status: 'BLOCKED',
  };
  record.privacy_audit = {
    artifact_paths: ['artifacts/security.json'],
    status: 'NOT_TESTED',
  };
  return record;
}

function makeFixture(records) {
  const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'focaccia-sc1-sc5-test-')));
  const input = path.join(root, 'input');
  const output = path.join(root, 'receipt');
  const artifacts = path.join(input, 'artifacts');
  mkdirSync(artifacts, { recursive: true });

  const rawRuns = Object.fromEntries(records.map((record) => [record.run_id, {
    authoritative_backend: record.authoritative_backend,
    checks: {
      SC1: record.checks.SC1,
      SC2: record.checks.SC2,
      SC5: record.checks.SC5,
    },
    privacy_audit: record.privacy_audit,
    security_matrix: record.security_matrix,
  }]));
  const writeRawArtifact = (name, selectRunEvidence) => {
    const runs = Object.fromEntries(Object.entries(rawRuns).map(
      ([runId, evidence]) => [runId, selectRunEvidence(evidence)],
    ));
    writeFileSync(
      path.join(artifacts, name),
      `${JSON.stringify({ schema_version: RAW_EVIDENCE_SCHEMA_VERSION, runs }, null, 2)}\n`,
    );
  };
  writeRawArtifact('backend-counts.json', (evidence) => ({
    authoritative_backend: evidence.authoritative_backend,
  }));
  writeRawArtifact('journey.json', (evidence) => ({ checks: evidence.checks }));
  writeRawArtifact('privacy.json', (evidence) => ({
    privacy_audit: evidence.privacy_audit,
  }));
  writeRawArtifact('security.json', (evidence) => ({
    security_matrix: evidence.security_matrix,
  }));

  records.forEach((record, index) => {
    writeFileSync(
      path.join(input, `run-${String(index + 1).padStart(2, '0')}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  });

  return { input, output, root };
}

function runReducer(input, output, environment = {}) {
  return spawnSync(process.execPath, [reducerPath, '--input', input, '--output', output], {
    encoding: 'utf8',
    env: { ...process.env, ...environment },
  });
}

function listFixtureFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = path.join(directory, entry.name);
    return entry.isDirectory() ? listFixtureFiles(candidate) : [candidate];
  });
}

function writeBackendCounts(fixture, counts) {
  const artifactPath = path.join(fixture.input, 'artifacts/backend-counts.json');
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  const [runId] = Object.keys(artifact.runs);
  artifact.runs[runId].authoritative_backend.claimed_counts = counts;
  artifact.runs[runId].authoritative_backend.observed_counts = counts;
  writeFileSync(
    artifactPath,
    `${JSON.stringify(artifact, null, 2)}\n`,
  );
}

function mutateRawRunSection(fixture, artifactName, runId, mutate) {
  const artifactPath = path.join(fixture.input, 'artifacts', artifactName);
  const artifact = JSON.parse(readFileSync(artifactPath, 'utf8'));
  mutate(artifact.runs[runId]);
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
}

function addImageEvidence(record, artifactPath, bytes, mediaType, attestationOverrides = {}) {
  record.artifact_paths = [...record.artifact_paths, artifactPath];
  record.checks.SC1.artifact_paths = [...record.checks.SC1.artifact_paths, artifactPath];
  record.image_safety_attestations = [{
    artifact_path: artifactPath,
    media_type: mediaType,
    redaction_status: 'PASS',
    review_method: 'MANUAL_VISUAL_SECRET_REVIEW_AND_REDACTION',
    sha256: createHash('sha256').update(bytes).digest('hex'),
    visual_secret_review_status: 'PASS',
    ...attestationOverrides,
  }];
}

function writeFixtureArtifact(fixture, artifactPath, bytes) {
  const destination = path.join(fixture.input, artifactPath);
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, bytes);
}

test('accepts one complete PASS run as one of ten required observations', () => {
  const fixture = makeFixture([passRecord()]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);

    const receipt = JSON.parse(
      readFileSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
    );
    assert.equal(receipt.status, 'PARTIAL');
    assert.deepEqual(receipt.target, {
      observed_target_runs: 1,
      remaining_required_runs: 9,
      required_runs: 10,
    });
    assert.equal(receipt.evaluated_commit_sha, 'a'.repeat(40));

    for (const criterion of ['SC1', 'SC2', 'SC3', 'SC4', 'SC5']) {
      assert.equal(receipt.criteria[criterion].status, 'PARTIAL');
      assert.equal(receipt.criteria[criterion].numerator, 1);
      assert.equal(receipt.criteria[criterion].observed_denominator, 1);
      assert.equal(receipt.criteria[criterion].required_denominator, 10);
      assert.equal(receipt.criteria[criterion].results[0].run_id, 'run-001');
      assert.equal(
        receipt.criteria[criterion].results[0].workflow_run_url,
        'https://github.com/example/Focaccia/actions/runs/1001',
      );
      assert.ok(receipt.criteria[criterion].results[0].artifact_paths.length > 0);
    }
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects aliased or nested input and output directories', async (t) => {
  const cases = [
    ['same directory', (fixture) => fixture.input],
    ['output nested inside input', (fixture) => path.join(fixture.input, 'receipt')],
    ['input nested inside output', (fixture) => fixture.root],
  ];

  for (const [name, selectOutput] of cases) {
    await t.test(name, () => {
      const fixture = makeFixture([passRecord()]);
      const output = selectOutput(fixture);
      try {
        const result = runReducer(fixture.input, output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /input and output directories must be separate/i);
        assert.equal(
          existsSync(path.join(output, 'sc1-sc5-evidence-receipt.json')),
          false,
        );
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects symlinked output directories and output ancestors', async (t) => {
  const cases = [
    ['output directory', false],
    ['output ancestor', true],
  ];

  for (const [name, nested] of cases) {
    await t.test(name, () => {
      const fixture = makeFixture([passRecord()]);
      const realOutput = path.join(fixture.root, `real-${name.replace(' ', '-')}`);
      const outputLink = path.join(fixture.root, `linked-${name.replace(' ', '-')}`);
      mkdirSync(realOutput, { recursive: true });
      symlinkSync(realOutput, outputLink);
      const output = nested ? path.join(outputLink, 'receipt') : outputLink;
      try {
        const result = runReducer(fixture.input, output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /unsafe.*symlink|symlink.*output/i);
        assert.equal(existsSync(path.join(realOutput, 'sc1-sc5-evidence-receipt.json')), false);
        assert.equal(existsSync(path.join(realOutput, 'receipt')), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects symlinked receipt destinations without overwriting their targets', async (t) => {
  for (const receiptName of [
    'sc1-sc5-evidence-receipt.json',
    'sc1-sc5-evidence-receipt.md',
  ]) {
    await t.test(receiptName, () => {
      const fixture = makeFixture([passRecord()]);
      mkdirSync(fixture.output, { recursive: true });
      const target = path.join(fixture.root, `outside-${path.extname(receiptName).slice(1)}`);
      const original = `DO_NOT_OVERWRITE_${path.extname(receiptName).slice(1).toUpperCase()}`;
      writeFileSync(target, original);
      symlinkSync(target, path.join(fixture.output, receiptName));
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /unsafe symlinked receipt destination/i);
        assert.equal(readFileSync(target, 'utf8'), original);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('atomically replaces normal receipts on rerun with private file modes', () => {
  const fixture = makeFixture([passRecord()]);
  try {
    const first = runReducer(fixture.input, fixture.output);
    assert.equal(first.status, 0, first.stderr);
    const receiptNames = [
      'sc1-sc5-evidence-receipt.json',
      'sc1-sc5-evidence-receipt.md',
    ];
    const firstContents = receiptNames.map((name) => readFileSync(
      path.join(fixture.output, name),
      'utf8',
    ));

    const second = runReducer(fixture.input, fixture.output);
    assert.equal(second.status, 0, second.stderr);
    assert.deepEqual(
      receiptNames.map((name) => readFileSync(path.join(fixture.output, name), 'utf8')),
      firstContents,
    );
    for (const name of receiptNames) {
      assert.equal(statSync(path.join(fixture.output, name)).mode & 0o777, 0o600);
    }
    assert.deepEqual(readdirSync(fixture.output).sort(), receiptNames.sort());
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects each PASS section when its raw machine-readable evidence diverges', async (t) => {
  const cases = [
    ['SC1', 'journey.json', (raw) => { raw.checks.SC1.assertions.dashboard_updated = false; }],
    ['SC2', 'journey.json', (raw) => {
      raw.checks.SC2.assertions.offline_evidence_present = false;
    }],
    ['SC5', 'journey.json', (raw) => {
      raw.checks.SC5.assertions.after_restart_pending_queue_count = 0;
    }],
    ['privacy_audit', 'privacy.json', (raw) => { raw.privacy_audit.source_only = true; }],
    ['security_matrix', 'security.json', (raw) => {
      raw.security_matrix.scenarios[0].observed = 'REJECT';
    }],
    ['authoritative_backend', 'backend-counts.json', (raw) => {
      raw.authoritative_backend.observed_counts.accepted_check_ins = 0;
    }],
  ];

  for (const [claim, artifactName, mutate] of cases) {
    await t.test(claim, () => {
      const fixture = makeFixture([passRecord()]);
      mutateRawRunSection(fixture, artifactName, 'run-001', mutate);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(`raw evidence.*${claim}`, 'i'));
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects placeholder JSON instead of treating filenames as substantive evidence', async (t) => {
  const cases = [
    ['journey.json', { journey: 'complete' }],
    ['privacy.json', { central_biometric_rows: 0 }],
    ['security.json', { replay: 'rejected' }],
    ['backend-counts.json', { accepted_check_ins: 1 }],
  ];

  for (const [artifactName, placeholder] of cases) {
    await t.test(artifactName, () => {
      const fixture = makeFixture([passRecord()]);
      writeFileSync(
        path.join(fixture.input, 'artifacts', artifactName),
        `${JSON.stringify(placeholder)}\n`,
      );

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /raw evidence/i);
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('writes a traceable Markdown receipt for every criterion result', () => {
  const fixture = makeFixture([passRecord()]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);

    const markdown = readFileSync(
      path.join(fixture.output, 'sc1-sc5-evidence-receipt.md'),
      'utf8',
    );
    assert.match(markdown, /^# SC1-SC5 Cloud Evidence Receipt$/m);
    assert.match(markdown, /Overall status: `PARTIAL`/);
    assert.match(markdown, /Evaluated commit: `a{40}`/);
    assert.match(markdown, /\| SC1 \| 1 \| 1 \| 10 \|/);
    assert.match(
      markdown,
      /\[workflow run\]\(https:\/\/github\.com\/example\/Focaccia\/actions\/runs\/1001\)/,
    );
    assert.match(markdown, /`artifacts\/journey\.json`/);
    assert.match(markdown, /Evidence completeness: 1 of 10 target observations/);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('states the controlled-evidence boundary without inferring latency', () => {
  const fixture = makeFixture([passRecord()]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
    const markdown = readFileSync(
      path.join(fixture.output, 'sc1-sc5-evidence-receipt.md'),
      'utf8',
    );
    const receipt = JSON.parse(readFileSync(
      path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'),
      'utf8',
    ));

    assert.match(
      markdown,
      /Repeated fixture-driven runs assess controlled software repeatability only\./,
    );
    for (const unestablished of [
      'real-camera capture',
      'camera QR scanning',
      'physical radio loss',
      'participant FAR/FRR/EER',
      'demographic fairness',
      'sophisticated PAD',
      'user acceptance',
      'public deployment',
    ]) {
      assert.match(markdown, new RegExp(`${unestablished.replaceAll('/', '\\/')} remains unestablished`));
    }
    assert.match(markdown, /Latency is never inferred from zero or missing fields\./);
    assert.equal(
      receipt.evidence_scope.image_review_trust_boundary,
      'only canonical stripped, structurally decoded PNG image evidence is supported; reducer accepts only IHDR, IDAT, and IEND chunks and verifies PNG chunk framing, CRCs, exact zlib-decoded scanline structure, hash, path, media type, and attestation, but cannot independently determine whether pixel content contains secrets; visual redaction and secret review is an attested trust boundary, not automated proof',
    );
    assert.match(markdown, /only canonical stripped, structurally decoded PNG image evidence is supported/i);
    assert.match(markdown, /exact zlib-decoded scanline structure/i);
    assert.match(markdown, /cannot independently determine whether pixel content contains secrets/i);
    assert.match(markdown, /attested trust boundary, not automated proof/i);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects an incomplete run record without writing a receipt', () => {
  const fixture = makeFixture([passRecord({ organizer_id_hash: undefined })]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /organizer_id_hash/);
    assert.equal(
      existsSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json')),
      false,
    );
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects a run whose commit SHA is not fully pinned', () => {
  const fixture = makeFixture([passRecord({ commit_sha: 'abc1234' })]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /commit_sha/);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects workflow metadata that does not identify a concrete run', () => {
  const fixture = makeFixture([passRecord({
    workflow_run_url: 'https://github.com/example/Focaccia/actions',
  })]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /workflow_run_url/);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects a status outside the required closed vocabulary', () => {
  const fixture = makeFixture([passRecord({ status: 'SUCCESS' })]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /status/);
    assert.match(result.stderr, /PASS\|PARTIAL\|FAIL\|NOT_TESTED\|BLOCKED/);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects an invalid SC1-SC5 check status', () => {
  const record = passRecord();
  record.checks.SC3.status = 'UNKNOWN';
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /checks\.SC3\.status/);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects every non-PASS record without an explicit failure', () => {
  const record = passRecord({ status: 'FAIL' });
  record.checks.SC2.status = 'FAIL';
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /explicit failure/);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('requires an explicit failure field that is null only for PASS records', async (t) => {
  await t.test('missing failure field', () => {
    const record = passRecord();
    delete record.failure;
    const fixture = makeFixture([record]);

    try {
      const result = runReducer(fixture.input, fixture.output);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /missing required field: failure/i);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });

  await t.test('PASS with a failure', () => {
    const fixture = makeFixture([passRecord({
      failure: {
        category: 'VALIDATION_FAILURE',
        reason_code: 'UNSAFE_PUBLISHED_ARTIFACTS',
      },
    })]);

    try {
      const result = runReducer(fixture.input, fixture.output);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /PASS.*failure must be null/i);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });
});

test('permits a pre-creation target failure with nullable identities and fixture hash without counting it', () => {
  const record = passRecord({
    attendee_id_hash: null,
    event_id: null,
    failure: {
      category: 'WORKFLOW_FAILURE',
      diagnostics: { diagnostic_codes: ['NO_TARGET_OBSERVATIONS'] },
      reason_code: 'PRE_CREATION_FAILURE',
      stage: 'PRE_CREATION',
    },
    fixture_sha256: null,
    gate_key_fingerprint: null,
    mutable_state_isolated: false,
    organizer_id_hash: null,
    run_id: 'run-pre-creation-failure',
    status: 'FAIL',
    ticket_id: null,
    workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1120',
  });
  for (const criterion of CRITERIA) {
    record.checks[criterion].status = 'NOT_TESTED';
  }
  for (const section of ['authoritative_backend', 'privacy_audit', 'security_matrix']) {
    record[section].status = 'NOT_TESTED';
  }
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(
      readFileSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
    );
    assert.equal(receipt.status, 'FAIL');
    assert.equal(receipt.target.observed_target_runs, 0);
    for (const criterion of CRITERIA) {
      assert.equal(receipt.criteria[criterion].status, 'NOT_TESTED');
      assert.equal(receipt.criteria[criterion].observed_denominator, 0);
      assert.equal(receipt.criteria[criterion].results[0].status, 'NOT_TESTED');
    }
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('never counts a PRE_CREATION failure with populated identities as an observation', () => {
  const record = passRecord({
    failure: {
      category: 'WORKFLOW_FAILURE',
      diagnostics: { diagnostic_codes: ['NO_TARGET_OBSERVATIONS'] },
      reason_code: 'PRE_CREATION_FAILURE',
      stage: 'PRE_CREATION',
    },
    run_id: 'run-pre-creation-populated-identities',
    status: 'FAIL',
    workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1121',
  });
  for (const criterion of CRITERIA) record.checks[criterion].status = 'NOT_TESTED';
  for (const section of ['authoritative_backend', 'privacy_audit', 'security_matrix']) {
    record[section].status = 'NOT_TESTED';
  }
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(readFileSync(
      path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'),
      'utf8',
    ));
    assert.equal(receipt.target.observed_target_runs, 0);
    assert.equal(receipt.target.remaining_required_runs, 10);
    assert.equal(receipt.evidence_completeness.complete, false);
    assert.equal(receipt.evidence_completeness.target_observations_missing, 10);
    for (const criterion of CRITERIA) {
      assert.equal(receipt.criteria[criterion].observed_denominator, 0);
      assert.equal(receipt.criteria[criterion].results[0].counts_as_observation, false);
    }
    assert.deepEqual(receipt.failure_records[0].diagnostics, {
      diagnostic_codes: ['NO_TARGET_OBSERVATIONS'],
    });
    assert.equal(receipt.failure_records[0].reason_code, 'PRE_CREATION_FAILURE');
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects nullable target identities outside a structured pre-creation failure', async (t) => {
  const cases = [
    ['PASS record', passRecord({ event_id: null })],
    ['post-creation failure', passRecord({
      event_id: null,
      failure: {
        category: 'WORKFLOW_FAILURE',
        reason_code: 'CRITERION_EVIDENCE_INCOMPLETE',
        stage: 'POST_CREATION',
      },
      status: 'FAIL',
    })],
  ];

  for (const [name, record] of cases) {
    await t.test(name, () => {
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /event_id/);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects duplicate run IDs', () => {
  const fixture = makeFixture([
    passRecord(),
    passRecord({ workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1002' }),
  ]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate run_id/i);
    assert.equal(
      existsSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json')),
      false,
    );
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects duplicate target isolation identities', async (t) => {
  const identityFields = [
    'workflow_run_url',
    'event_id',
    'organizer_id_hash',
    'attendee_id_hash',
    'ticket_id',
    'gate_key_fingerprint',
  ];

  for (const field of identityFields) {
    await t.test(field, () => {
      const first = passRecord({
        run_id: 'run-isolation-a',
        workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1101',
      });
      const second = passRecord({
        run_id: 'run-isolation-b',
        workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1102',
      });
      second[field] = first[field];
      const fixture = makeFixture([first, second]);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(`duplicate target ${field}`, 'i'));
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects target records from mixed pinned commits', () => {
  const fixture = makeFixture([
    passRecord({
      run_id: 'run-commit-a',
      workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1111',
    }),
    passRecord({
      commit_sha: 'b'.repeat(40),
      run_id: 'run-commit-b',
      workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1112',
    }),
  ]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /single pinned commit_sha/i);
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects malformed scalar contract metadata', async (t) => {
  const cases = [
    ['run_id', ''],
    ['event_id', ''],
    ['organizer_id_hash', 'not-a-hash'],
    ['attendee_id_hash', 'not-a-hash'],
    ['gate_key_fingerprint', 'not-a-fingerprint'],
    ['fixture_sha256', 'not-a-hash'],
    ['mutable_state_isolated', 'true'],
    ['provisioning_qr_camera_scan', 'false'],
    ['runner_os', ''],
    ['started_at', '24 August 2026'],
    ['provisioning_mode', ''],
    ['network_loss_method', ''],
  ];

  for (const [field, value] of cases) {
    await t.test(field, () => {
      const fixture = makeFixture([passRecord({ [field]: value })]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(field));
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects normalized or out-of-range RFC3339 timestamps', async (t) => {
  const invalidTimestamps = [
    ['nonexistent calendar day', '2026-02-30T00:00:00.000Z'],
    ['hour 24', '2026-08-24T24:00:00.000Z'],
    ['minute 60', '2026-08-24T23:60:00.000Z'],
    ['second 60', '2026-08-24T23:59:60.000Z'],
    ['offset hour 24', '2026-08-24T23:59:59.000+24:00'],
    ['offset minute 60', '2026-08-24T23:59:59.000+04:60'],
  ];

  for (const [name, startedAt] of invalidTimestamps) {
    await t.test(name, () => {
      const fixture = makeFixture([passRecord({ started_at: startedAt })]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /invalid started_at/i);
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('accepts a real leap day and a valid RFC3339 offset', () => {
  const fixture = makeFixture([passRecord({
    started_at: '2024-02-29T23:59:59.123456789+14:30',
  })]);
  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects malformed structured evidence sections', async (t) => {
  const cases = [
    ['security_matrix', (record) => { record.security_matrix = []; }],
    ['privacy_audit', (record) => { record.privacy_audit = []; }],
    ['authoritative_backend', (record) => { record.authoritative_backend = []; }],
    ['artifact_paths', (record) => { record.artifact_paths = []; }],
    ['checks.SC4.artifact_paths', (record) => { delete record.checks.SC4.artifact_paths; }],
    ['security_matrix.status', (record) => { record.security_matrix.status = 'UNKNOWN'; }],
    ['privacy_audit.status', (record) => { record.privacy_audit.status = 'UNKNOWN'; }],
    ['authoritative_backend.status', (record) => {
      record.authoritative_backend.status = 'UNKNOWN';
    }],
  ];

  for (const [field, mutate] of cases) {
    await t.test(field, () => {
      const record = passRecord();
      mutate(record);
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(field.replaceAll('.', '\\.')));
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects duplicate artifact paths in manifests and evidence sections', async (t) => {
  const cases = [
    ['record manifest', (record) => {
      record.artifact_paths = [...record.artifact_paths, record.artifact_paths[0]];
    }],
    ['criterion section', (record) => {
      record.checks.SC1.artifact_paths = [
        ...record.checks.SC1.artifact_paths,
        record.checks.SC1.artifact_paths[0],
      ];
    }],
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const record = passRecord();
      mutate(record);
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /duplicate.*artifact_paths/i);
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('enforces finite reducer resource budgets with lower test limits', async (t) => {
  await t.test('record count', () => {
    const fixture = makeFixture([
      passRecord({ run_id: 'run-budget-1' }),
      passRecord({
        run_id: 'run-budget-2',
        workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1002',
      }),
    ]);
    try {
      const result = runReducer(fixture.input, fixture.output, {
        SC1_SC5_TEST_MAX_RECORDS: '1',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /record count.*budget/i);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });

  await t.test('recursive file count', () => {
    const fixture = makeFixture([passRecord()]);
    const fileCount = listFixtureFiles(fixture.input).length;
    try {
      const result = runReducer(fixture.input, fixture.output, {
        SC1_SC5_TEST_MAX_RECURSIVE_FILES: String(fileCount - 1),
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /file count.*budget/i);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });

  await t.test('recursive depth', () => {
    const fixture = makeFixture([passRecord()]);
    writeFixtureArtifact(
      fixture,
      'artifacts/level-one/level-two/probe.txt',
      Buffer.from('safe evidence'),
    );
    try {
      const result = runReducer(fixture.input, fixture.output, {
        SC1_SC5_TEST_MAX_RECURSION_DEPTH: '1',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /recursion depth.*budget/i);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });

  await t.test('per-file bytes', () => {
    const fixture = makeFixture([passRecord()]);
    const largestFile = Math.max(...listFixtureFiles(fixture.input).map(
      (file) => statSync(file).size,
    ));
    try {
      const result = runReducer(fixture.input, fixture.output, {
        SC1_SC5_TEST_MAX_FILE_BYTES: String(largestFile - 1),
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /per-file.*budget/i);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });

  await t.test('total bytes', () => {
    const fixture = makeFixture([passRecord()]);
    const totalBytes = listFixtureFiles(fixture.input).reduce(
      (total, file) => total + statSync(file).size,
      0,
    );
    try {
      const result = runReducer(fixture.input, fixture.output, {
        SC1_SC5_TEST_MAX_TOTAL_BYTES: String(totalBytes - 1),
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /total bytes.*budget/i);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });

  await t.test('artifact paths per record', () => {
    const fixture = makeFixture([passRecord()]);
    try {
      const result = runReducer(fixture.input, fixture.output, {
        SC1_SC5_TEST_MAX_ARTIFACT_PATHS_PER_RECORD: '3',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /artifact_paths.*budget/i);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });

  await t.test('record JSON bytes', () => {
    const fixture = makeFixture([passRecord()]);
    const recordFile = path.join(fixture.input, 'run-01.json');
    try {
      const result = runReducer(fixture.input, fixture.output, {
        SC1_SC5_TEST_MAX_RECORD_JSON_BYTES: String(statSync(recordFile).size - 1),
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /record JSON.*budget/i);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });

  await t.test('PNG compressed bytes', () => {
    const record = passRecord();
    addImageEvidence(record, 'artifacts/budget.png', VALID_PNG, 'image/png');
    const fixture = makeFixture([record]);
    writeFixtureArtifact(fixture, 'artifacts/budget.png', VALID_PNG);
    try {
      const result = runReducer(fixture.input, fixture.output, {
        SC1_SC5_TEST_MAX_PNG_COMPRESSED_BYTES: '1',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /PNG compressed.*budget/i);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });

  await t.test('PNG decoded bytes', () => {
    const record = passRecord();
    addImageEvidence(record, 'artifacts/budget.png', VALID_PNG, 'image/png');
    const fixture = makeFixture([record]);
    writeFixtureArtifact(fixture, 'artifacts/budget.png', VALID_PNG);
    try {
      const result = runReducer(fixture.input, fixture.output, {
        SC1_SC5_TEST_MAX_PNG_DECODED_BYTES: '4',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /PNG decoded.*budget/i);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });
});

test('bounds directory entries globally before top-level or recursive materialization', async (t) => {
  await t.test('top-level record enumeration counts empty directories', () => {
    const root = realpathSync(mkdtempSync(path.join(tmpdir(), 'sc1-sc5-entry-budget-')));
    const input = path.join(root, 'input');
    const output = path.join(root, 'output');
    mkdirSync(input);
    mkdirSync(path.join(input, 'empty-a'));
    mkdirSync(path.join(input, 'empty-b'));

    try {
      const result = runReducer(input, output, {
        SC1_SC5_TEST_MAX_INPUT_ENTRIES: '1',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /input entry count.*budget/i);
      assert.equal(existsSync(output), false);
    } finally {
      rmSync(root, { force: true, recursive: true });
    }
  });

  await t.test('recursive scanning uses the same budget for empty directories', () => {
    const fixture = makeFixture([passRecord()]);
    mkdirSync(path.join(fixture.input, 'artifacts/empty-a'));
    mkdirSync(path.join(fixture.input, 'artifacts/empty-b'));

    try {
      const result = runReducer(fixture.input, fixture.output, {
        SC1_SC5_TEST_MAX_INPUT_ENTRIES: '7',
      });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /input entry count.*budget/i);
      assert.equal(existsSync(fixture.output), false);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });
});

test('rejects unsafe or missing artifact references', async (t) => {
  const cases = [
    ['parent traversal', '../outside.log'],
    ['absolute path', '/tmp/outside.log'],
    ['missing file', 'artifacts/missing.json'],
  ];

  for (const [name, unsafePath] of cases) {
    await t.test(name, () => {
      const record = passRecord();
      record.artifact_paths.push(unsafePath);
      record.checks.SC1.artifact_paths = [unsafePath];
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /artifact_paths/);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects evidence sections that cite artifacts outside the record manifest', () => {
  const record = passRecord();
  record.checks.SC2.artifact_paths = ['artifacts/unmanifested.json'];
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /checks\.SC2\.artifact_paths/);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects mismatched authoritative backend counts', () => {
  const record = passRecord();
  record.authoritative_backend.observed_counts.accepted_check_ins = 0;
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /authoritative backend count mismatch/i);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('requires authoritative backend evidence for successful check-in and sync claims', () => {
  const record = passRecord();
  record.authoritative_backend.status = 'NOT_TESTED';
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /authoritative backend evidence.*SC1.*SC5/i);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects SC1 PASS without every explicit end-to-end journey assertion', async (t) => {
  const requiredAssertions = [
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

  for (const assertion of requiredAssertions) {
    await t.test(assertion, () => {
      const record = passRecord();
      delete record.checks.SC1.assertions[assertion];
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(`checks\\.SC1\\.assertions\\.${assertion}`));
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('requires exactly one accepted check-in and checked-in ticket for SC1 PASS', async (t) => {
  for (const metric of ['accepted_check_ins', 'checked_in_tickets']) {
    await t.test(metric, () => {
      const record = passRecord();
      record.authoritative_backend.claimed_counts[metric] = 2;
      record.authoritative_backend.observed_counts[metric] = 2;
      const fixture = makeFixture([record]);
      writeBackendCounts(fixture, record.authoritative_backend.observed_counts);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(`exactly one.*${metric}`, 'i'));
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects SC2 PASS without explicit fresh offline verification evidence', async (t) => {
  const requiredAssertions = [
    'fresh_revocation_state',
    'no_live_backend_decision_path',
    'valid_pass_accepted',
    'offline_evidence_present',
  ];

  for (const assertion of requiredAssertions) {
    await t.test(assertion, () => {
      const record = passRecord();
      record.checks.SC2.assertions[assertion] = false;
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(`checks\\.SC2\\.assertions\\.${assertion}`));
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects SC2 PASS that lacks a real relay/simulator network-loss method boundary', async (t) => {
  const cases = [
    ['placeholder network method', (record) => { record.network_loss_method = 'NOT_TESTED'; }],
    ['physical-radio scope', (record) => {
      record.checks.SC2.network_evidence_scope = 'physical_radio';
    }],
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const record = passRecord();
      mutate(record);
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /SC2.*(?:network_loss_method|network_evidence_scope)/i);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects internally inconsistent PASS records', async (t) => {
  const cases = [
    ['failed criterion', /PASS record/i, (record) => { record.checks.SC4.status = 'FAIL'; }],
    ['partial security matrix', /security_matrix\.status for SC4 PASS/i, (record) => {
      record.security_matrix.status = 'PARTIAL';
    }],
    ['partial privacy audit', /privacy_audit\.status for SC3 PASS/i, (record) => {
      record.privacy_audit.status = 'PARTIAL';
    }],
    ['non-isolated state', /PASS record/i, (record) => {
      record.mutable_state_isolated = false;
    }],
  ];

  for (const [name, expectedError, mutate] of cases) {
    await t.test(name, () => {
      const record = passRecord();
      mutate(record);
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, expectedError);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('accepts a deliberately failed fixture and aggregates its failure category', () => {
  const record = passRecord({
    failure: {
      category: 'RECONNECT_TIMEOUT',
      diagnostics: {
        expected_count: 1,
        observed_count: 0,
        reconnect_completed: false,
      },
      reason_code: 'RECONNECT_DID_NOT_COMPLETE',
    },
    run_id: 'run-failed-001',
    status: 'FAIL',
    workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1003',
  });
  record.checks.SC5.status = 'FAIL';
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(
      readFileSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
    );
    assert.equal(receipt.status, 'FAIL');
    assert.equal(receipt.criteria.SC5.numerator, 0);
    assert.equal(receipt.criteria.SC5.observed_denominator, 1);
    assert.deepEqual(receipt.failure_categories, [{
      category: 'RECONNECT_TIMEOUT',
      count: 1,
      run_ids: ['run-failed-001'],
    }]);
    assert.deepEqual(receipt.failure_records, [{
      artifact_paths: [
        'artifacts/backend-counts.json',
        'artifacts/journey.json',
        'artifacts/privacy.json',
        'artifacts/security.json',
      ],
      category: 'RECONNECT_TIMEOUT',
      diagnostics: {
        expected_count: 1,
        observed_count: 0,
        reconnect_completed: false,
      },
      reason_code: 'RECONNECT_DID_NOT_COMPLETE',
      run_id: 'run-failed-001',
      workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1003',
    }]);

    const serializedOutput = `${JSON.stringify(receipt)}${readFileSync(
      path.join(fixture.output, 'sc1-sc5-evidence-receipt.md'),
      'utf8',
    )}`;
    assert.match(serializedOutput, /RECONNECT_TIMEOUT/);
    assert.match(serializedOutput, /RECONNECT_DID_NOT_COMPLETE/);
    assert.match(serializedOutput, /reconnect_completed/);
    assert.match(serializedOutput, /expected_count/);
    assert.match(serializedOutput, /artifacts\/journey\.json/);
    assert.match(serializedOutput, /actions\/runs\/1003/);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects unsafe free-form failure details without echoing their values', async (t) => {
  const cases = [
    ['reason', 'OPAQUE_PASSWORD_SENTINEL_8c3n', {
      reason: 'OPAQUE_PASSWORD_SENTINEL_8c3n',
    }],
    ['message', 'PROVISIONING_SENTINEL_7m2q', {
      message: 'PROVISIONING_SENTINEL_7m2q',
    }],
    ['details', 'OPAQUE_TOKEN_SENTINEL_9v4p', {
      details: 'OPAQUE_TOKEN_SENTINEL_9v4p',
    }],
    ['credential URL', 'https://user:credential@example.invalid/failure', {
      diagnostics: { assertion: 'https://user:credential@example.invalid/failure' },
    }],
    ['query-secret URL', 'https://example.invalid/failure?token=query-secret', {
      diagnostics: { assertion: 'https://example.invalid/failure?token=query-secret' },
    }],
    ['email', 'private.operator@example.invalid', {
      diagnostics: { assertion: 'private.operator@example.invalid' },
    }],
    ['high-entropy opaque value', 'aB3dE5fG7hJ9kL2mN4pQ6rS8tU1vW3xY5zA7cD9e', {
      diagnostics: { assertion: 'aB3dE5fG7hJ9kL2mN4pQ6rS8tU1vW3xY5zA7cD9e' },
    }],
  ];

  for (const [name, sentinel, unsafeFields] of cases) {
    await t.test(name, () => {
      const record = passRecord({
        failure: {
          category: 'VALIDATION_FAILURE',
          reason_code: 'UNSAFE_PUBLISHED_ARTIFACTS',
          ...unsafeFields,
        },
        status: 'PARTIAL',
      });
      record.checks.SC3.status = 'NOT_TESTED';
      record.privacy_audit.status = 'NOT_TESTED';
      const fixture = makeFixture([record]);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /invalid failure schema/i);
        assert.doesNotMatch(result.stderr, new RegExp(sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.doesNotMatch(result.stdout, new RegExp(sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects failure values outside the finite evaluator code sets without echoing them', async (t) => {
  const cases = [
    ['unknown category', 'UNKNOWN_CATEGORY_SENTINEL', (failure) => {
      failure.category = 'UNKNOWN_CATEGORY_SENTINEL';
    }],
    ['unknown reason code', 'UNKNOWN_REASON_SENTINEL', (failure) => {
      failure.reason_code = 'UNKNOWN_REASON_SENTINEL';
    }],
    ['unknown diagnostic code', 'UNKNOWN_DIAGNOSTIC_CODE_SENTINEL', (failure) => {
      failure.diagnostics = { diagnostic_codes: ['UNKNOWN_DIAGNOSTIC_CODE_SENTINEL'] };
    }],
    ['short password-like value', 'hunter2', (failure) => {
      failure.diagnostics = { expected_count: 'hunter2' };
    }],
    ['short secret-like value', 'SECRET_123', (failure) => {
      failure.diagnostics = { observed_count: 'SECRET_123' };
    }],
    ['short payload-like value', 'qrBlob', (failure) => {
      failure.diagnostics = { retry_count: 'qrBlob' };
    }],
    ['negative count', null, (failure) => {
      failure.diagnostics = { observed_count: -1 };
    }],
  ];

  for (const [name, sentinel, mutate] of cases) {
    await t.test(name, () => {
      const failure = {
        category: 'VALIDATION_FAILURE',
        reason_code: 'UNSAFE_PUBLISHED_ARTIFACTS',
      };
      mutate(failure);
      const record = passRecord({ failure, status: 'PARTIAL' });
      record.checks.SC3.status = 'NOT_TESTED';
      record.privacy_audit.status = 'NOT_TESTED';
      const fixture = makeFixture([record]);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /invalid failure schema/i);
        if (sentinel !== null) {
          const escapedSentinel = sentinel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          assert.doesNotMatch(`${result.stderr}${result.stdout}`, new RegExp(escapedSentinel));
        }
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects a PARTIAL target record whose criterion evidence requires FAIL', () => {
  const record = passRecord({
    failure: {
      category: 'CRITERION_FAILURE',
      reason_code: 'REQUIRED_SCENARIO_NOT_TESTED',
    },
    run_id: 'run-criterion-fail',
    status: 'PARTIAL',
    workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1005',
  });
  record.checks.SC4.status = 'FAIL';
  record.security_matrix.status = 'FAIL';
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /top-level status.*expected FAIL/i);
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects a PARTIAL target record whose supporting section requires FAIL', () => {
  const record = passRecord({
    failure: {
      category: 'CRITERION_FAILURE',
      reason_code: 'CRITERION_EVIDENCE_INCOMPLETE',
    },
    run_id: 'run-section-fail',
    status: 'PARTIAL',
    workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1006',
  });
  record.checks.SC3.status = 'PARTIAL';
  record.privacy_audit.status = 'FAIL';
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /top-level status.*expected FAIL/i);
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects PARTIAL or NOT_TESTED target status when every evidence status is PASS', async (t) => {
  for (const status of ['PARTIAL', 'NOT_TESTED']) {
    await t.test(status, () => {
      const fixture = makeFixture([passRecord({
        failure: {
          category: 'VALIDATION_FAILURE',
          reason_code: 'UNSAFE_PUBLISHED_ARTIFACTS',
        },
        status,
      })]);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /top-level status.*expected PASS/i);
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects ten all-PASS evidence records mislabeled PARTIAL before aggregation', () => {
  const records = Array.from({ length: 10 }, (_, index) => passRecord({
    failure: {
      category: 'VALIDATION_FAILURE',
      reason_code: 'UNSAFE_PUBLISHED_ARTIFACTS',
    },
    run_id: `run-inconsistent-${String(index + 1).padStart(2, '0')}`,
    status: 'PARTIAL',
    workflow_run_url: `https://github.com/example/Focaccia/actions/runs/${1501 + index}`,
  }));
  const fixture = makeFixture(records);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /top-level status.*expected PASS/i);
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('emits NOT_TESTED when every target criterion and section is NOT_TESTED', () => {
  const record = passRecord({
    failure: {
      category: 'CRITERION_FAILURE',
      reason_code: 'REQUIRED_SCENARIO_NOT_TESTED',
    },
    run_id: 'run-not-tested',
    status: 'NOT_TESTED',
    workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1515',
  });
  for (const criterion of CRITERIA) record.checks[criterion].status = 'NOT_TESTED';
  for (const section of ['authoritative_backend', 'privacy_audit', 'security_matrix']) {
    record[section].status = 'NOT_TESTED';
  }
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(
      readFileSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
    );
    assert.equal(receipt.status, 'NOT_TESTED');
    for (const criterion of CRITERIA) {
      assert.equal(receipt.criteria[criterion].status, 'NOT_TESTED');
    }
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('does not aggregate PASS when a target record is BLOCKED', () => {
  const records = Array.from({ length: 10 }, (_, index) => passRecord({
    run_id: `run-complete-${String(index + 1).padStart(2, '0')}`,
    workflow_run_url: `https://github.com/example/Focaccia/actions/runs/${1521 + index}`,
  }));
  const blocked = passRecord({
    failure: {
      category: 'WORKFLOW_FAILURE',
      reason_code: 'WORKFLOW_TIMEOUT',
    },
    run_id: 'run-blocked-after-completions',
    status: 'BLOCKED',
    workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1531',
  });
  for (const criterion of CRITERIA) blocked.checks[criterion].status = 'BLOCKED';
  for (const section of ['authoritative_backend', 'privacy_audit', 'security_matrix']) {
    blocked[section].status = 'BLOCKED';
  }
  const fixture = makeFixture([...records, blocked]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(
      readFileSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
    );
    assert.equal(receipt.status, 'BLOCKED');
    assert.notEqual(receipt.status, 'PASS');
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('derives criterion-level PASS only from ten independent observations', () => {
  const records = Array.from({ length: 10 }, (_, index) => passRecord({
    run_id: `run-target-${String(index + 1).padStart(2, '0')}`,
    workflow_run_url: `https://github.com/example/Focaccia/actions/runs/${1201 + index}`,
  }));
  const fixture = makeFixture(records);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(
      readFileSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
    );
    assert.equal(receipt.status, 'PASS');
    assert.equal(receipt.evaluated_commit_sha, 'a'.repeat(40));
    assert.equal(receipt.target.observed_target_runs, 10);
    for (const criterion of CRITERIA) {
      assert.equal(receipt.criteria[criterion].status, 'PASS');
      assert.equal(receipt.criteria[criterion].numerator, 10);
      assert.equal(receipt.criteria[criterion].observed_denominator, 10);
    }
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects ten records that differ only by run ID and workflow URL', () => {
  const records = Array.from({ length: 10 }, (_, index) => passRecord({
    identity_seed: 'shared-target-identity',
    run_id: `run-reused-${String(index + 1).padStart(2, '0')}`,
    workflow_run_url: `https://github.com/example/Focaccia/actions/runs/${1301 + index}`,
  }));
  const fixture = makeFixture(records);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /duplicate target (?:event_id|organizer_id_hash|attendee_id_hash|ticket_id|gate_key_fingerprint)/i);
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('emits a truthful BLOCKED receipt for a zero-target preflight control', () => {
  const fixture = makeFixture([blockedControlRecord()]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(
      readFileSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
    );
    assert.equal(receipt.status, 'BLOCKED');
    assert.equal(receipt.evaluated_commit_sha, 'a'.repeat(40));
    assert.deepEqual(receipt.target, {
      observed_target_runs: 0,
      remaining_required_runs: 10,
      required_runs: 10,
    });
    for (const criterion of ['SC1', 'SC2', 'SC3', 'SC4', 'SC5']) {
      assert.equal(receipt.criteria[criterion].status, 'BLOCKED');
      assert.equal(receipt.criteria[criterion].numerator, 0);
      assert.equal(receipt.criteria[criterion].observed_denominator, 0);
      assert.deepEqual(receipt.criteria[criterion].results, []);
    }
    assert.equal(receipt.blocked_scenarios.length, 1);
    assert.equal(receipt.blocked_scenarios[0].counts_toward_target, false);
    assert.equal(receipt.blocked_scenarios[0].workflow_run_url, null);
    assert.equal(receipt.blocked_scenarios[0].workflow_state, 'NOT_DISPATCHED');
    assert.deepEqual(receipt.blocked_scenarios[0].provenance, {
      commit_sha: 'a'.repeat(40),
      record_type: 'blocked_preflight_control',
      runner_os: 'macOS-15',
      started_at: '2026-08-24T00:00:00.000Z',
    });
    assert.deepEqual(receipt.not_tested_scenarios, []);

    const markdown = readFileSync(
      path.join(fixture.output, 'sc1-sc5-evidence-receipt.md'),
      'utf8',
    );
    assert.match(markdown, /zero target observations/i);
    assert.match(markdown, /truthful `BLOCKED` receipt/i);
    assert.doesNotMatch(markdown, /Overall status: `PASS`/);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('reports target criteria that were explicitly not tested', () => {
  const record = passRecord({
    failure: {
      category: 'CRITERION_FAILURE',
      reason_code: 'REQUIRED_SCENARIO_NOT_TESTED',
    },
    run_id: 'run-partial-001',
    status: 'PARTIAL',
    workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1004',
  });
  record.checks.SC3.status = 'NOT_TESTED';
  record.privacy_audit.status = 'NOT_TESTED';
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(
      readFileSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
    );
    assert.equal(receipt.status, 'PARTIAL');
    assert.equal(receipt.criteria.SC3.observed_denominator, 0);
    assert.equal(receipt.criteria.SC3.numerator, 0);
    assert.deepEqual(receipt.not_tested_scenarios, [{
      artifact_paths: ['artifacts/privacy.json'],
      criteria: ['SC3'],
      counts_toward_target: true,
      run_id: 'run-partial-001',
      workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1004',
    }]);

    const markdown = readFileSync(
      path.join(fixture.output, 'sc1-sc5-evidence-receipt.md'),
      'utf8',
    );
    assert.match(markdown, /`NOT_TESTED`/);
    assert.match(markdown, /`SC3`/);
    assert.doesNotMatch(markdown, /Zero target observations/i);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects secret-bearing records without printing secret values', async (t) => {
  const cases = [
    ['password', 'PASSWORD_SENTINEL_7q2m', { password: 'PASSWORD_SENTINEL_7q2m' }],
    [
      'service-role',
      'SERVICE_ROLE_SENTINEL_4v8k',
      { supabase_service_role_key: 'SERVICE_ROLE_SENTINEL_4v8k' },
    ],
    [
      'private-key',
      'PRIVATE_KEY_SENTINEL_9w3p',
      { signing_private_key: 'PRIVATE_KEY_SENTINEL_9w3p' },
    ],
    [
      'full-token',
      'Bearer FULL_TOKEN_SENTINEL_6n5rABCDEFGHIJKLMN',
      { access_token: 'Bearer FULL_TOKEN_SENTINEL_6n5rABCDEFGHIJKLMN' },
    ],
    [
      'provisioning-payload',
      'PROVISIONING_PAYLOAD_SENTINEL_2x7c',
      { provisioning_payload: 'PROVISIONING_PAYLOAD_SENTINEL_2x7c' },
    ],
  ];

  for (const [category, sentinel, diagnostics] of cases) {
    await t.test(category, () => {
      const fixture = makeFixture([passRecord({ diagnostics })]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(category));
        assert.doesNotMatch(result.stderr, new RegExp(sentinel));
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects secret-bearing artifacts without printing secret values', async (t) => {
  const cases = [
    ['password', 'ARTIFACT_PASSWORD_SENTINEL_3d9k', { password: 'ARTIFACT_PASSWORD_SENTINEL_3d9k' }],
    [
      'service-role',
      'ARTIFACT_SERVICE_ROLE_SENTINEL_5j2v',
      { service_role_key: 'ARTIFACT_SERVICE_ROLE_SENTINEL_5j2v' },
    ],
    [
      'private-key',
      'ARTIFACT_PRIVATE_KEY_SENTINEL_8p4x',
      { private_key: 'ARTIFACT_PRIVATE_KEY_SENTINEL_8p4x' },
    ],
    [
      'full-token',
      'Bearer ARTIFACT_FULL_TOKEN_SENTINEL_1m6qABCDEFGH',
      { access_token: 'Bearer ARTIFACT_FULL_TOKEN_SENTINEL_1m6qABCDEFGH' },
    ],
    [
      'provisioning-payload',
      'ARTIFACT_PROVISIONING_PAYLOAD_SENTINEL_7c5n',
      { provisioning_payload: 'ARTIFACT_PROVISIONING_PAYLOAD_SENTINEL_7c5n' },
    ],
  ];

  for (const [category, sentinel, artifact] of cases) {
    await t.test(category, () => {
      const fixture = makeFixture([passRecord()]);
      writeFileSync(
        path.join(fixture.input, 'artifacts/journey.json'),
        `${JSON.stringify(artifact)}\n`,
      );
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(category));
        assert.doesNotMatch(result.stderr, new RegExp(sentinel));
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects secret assignments in every parsed string without echoing values', async (t) => {
  const cases = [
    [
      'runner_os password assignment',
      'password',
      'hunter2',
      (record, sentinel) => { record.runner_os = `macOS password=${sentinel}`; },
    ],
    [
      'message service-role assignment',
      'service-role',
      'SERVICE_ROLE_ASSIGNMENT_SENTINEL_2h8m',
      (record, sentinel) => {
        record.metadata = { message: `service_role_key=${sentinel}` };
      },
    ],
    [
      'detail private-key assignment',
      'private-key',
      'PRIVATE_KEY_ASSIGNMENT_SENTINEL_5k3p',
      (record, sentinel) => { record.metadata = { detail: `private_key: ${sentinel}` }; },
    ],
    [
      'message full-token assignment',
      'full-token',
      'FULL_TOKEN_ASSIGNMENT_SENTINEL_9v6q',
      (record, sentinel) => { record.metadata = { message: `fullPassToken=${sentinel}` }; },
    ],
    [
      'detail provisioning-payload assignment',
      'provisioning-payload',
      'PROVISIONING_ASSIGNMENT_SENTINEL_4c7n',
      (record, sentinel) => {
        record.metadata = { detail: `provisioning_payload=${sentinel}` };
      },
    ],
  ];

  for (const [name, category, sentinel, mutate] of cases) {
    await t.test(name, () => {
      const record = passRecord();
      mutate(record, sentinel);
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(category));
        assert.doesNotMatch(`${result.stderr}${result.stdout}`, new RegExp(sentinel));
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('allows safe prose that names secret categories without assigning values', () => {
  const fixture = makeFixture([passRecord({
    review_note: 'password, service-role, private-key, full-token, and provisioning-payload categories reviewed without retained values',
  })]);
  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('accepts checksum-bound fully decoded PNG evidence with substantive safety attestations', async (t) => {
  const cases = [
    ['RGBA scanline', 'artifacts/gate-capture.png', VALID_PNG],
    [
      'split IDAT chunks and filters 0 through 4',
      'artifacts/filtered-capture.png',
      createTinyPng({
        height: 5,
        idatSplitAt: 3,
        scanlines: Buffer.concat(
          Array.from({ length: 5 }, (_, filter) => Buffer.from([filter, 0, 0, 0, 0])),
        ),
      }),
    ],
    [
      '16-bit grayscale scanline',
      'artifacts/grayscale-capture.png',
      createTinyPng({ bitDepth: 16, colorType: 0, scanlines: Buffer.from([0, 0, 0]) }),
    ],
  ];

  for (const [name, artifactPath, bytes] of cases) {
    await t.test(name, () => {
      const record = passRecord();
      addImageEvidence(record, artifactPath, bytes, 'image/png');
      const fixture = makeFixture([record]);
      writeFixtureArtifact(fixture, artifactPath, bytes);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.equal(result.status, 0, result.stderr);
        const receipt = JSON.parse(readFileSync(
          path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'),
          'utf8',
        ));
        assert.ok(receipt.criteria.SC1.results[0].artifact_paths.includes(artifactPath));
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects CRC-correct PNGs with invalid decoded pixel streams', async (t) => {
  const trailingStreamSentinel = 'PNG_IDAT_TRAILING_SENTINEL_4m7q';
  const cases = [
    ['invalid zlib payload', createTinyPng({ idatPayload: Buffer.from([0x78, 0x9c, 0x00]) }), null],
    ['truncated decompressed data', createTinyPng({ scanlines: Buffer.alloc(4) }), null],
    ['extra decompressed data', createTinyPng({ scanlines: Buffer.alloc(6) }), null],
    [
      'dimension and row mismatch',
      createTinyPng({ scanlines: Buffer.alloc(5), width: 2 }),
      null,
    ],
    ['illegal row filter byte', createTinyPng({ scanlines: Buffer.from([5, 0, 0, 0, 0]) }), null],
    [
      'trailing data inside the IDAT zlib stream',
      createTinyPng({
        idatPayload: Buffer.concat([
          deflateSync(Buffer.alloc(5)),
          Buffer.from(trailingStreamSentinel),
        ]),
      }),
      trailingStreamSentinel,
    ],
  ];

  for (const [name, bytes, sentinel] of cases) {
    await t.test(name, () => {
      const artifactPath = 'artifacts/pixel-stream.png';
      const record = passRecord();
      addImageEvidence(record, artifactPath, bytes, 'image/png');
      const fixture = makeFixture([record]);
      writeFixtureArtifact(fixture, artifactPath, bytes);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /invalid PNG pixel stream/i);
        if (sentinel !== null) {
          assert.doesNotMatch(`${result.stderr}${result.stdout}`, new RegExp(sentinel));
        }
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects unsupported PNG headers and indexed color', async (t) => {
  const cases = [
    ['Adam7 interlace', createTinyPng({ interlaceMethod: 1 }), /invalid PNG structure/i],
    ['unsupported compression method', createTinyPng({ compressionMethod: 1 }), /invalid PNG structure/i],
    ['unsupported filter method', createTinyPng({ filterMethod: 1 }), /invalid PNG structure/i],
    [
      'illegal color and bit-depth combination',
      createTinyPng({ bitDepth: 4, colorType: 2 }),
      /invalid PNG structure/i,
    ],
    [
      'dimension above the decoder bound',
      createTinyPng({ scanlines: Buffer.from([0]), width: 8_193 }),
      /invalid PNG structure/i,
    ],
    [
      'indexed color even with a complete palette',
      createTinyPng({
        bitDepth: 2,
        colorType: 3,
        palette: Buffer.alloc(12),
        scanlines: Buffer.from([0, 0x1b]),
        width: 4,
      }),
      /invalid PNG structure/i,
    ],
  ];

  for (const [name, bytes, expectedError] of cases) {
    await t.test(name, () => {
      const artifactPath = 'artifacts/header.png';
      const record = passRecord();
      addImageEvidence(record, artifactPath, bytes, 'image/png');
      const fixture = makeFixture([record]);
      writeFixtureArtifact(fixture, artifactPath, bytes);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, expectedError);
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects every non-canonical PNG chunk without echoing hidden data', async (t) => {
  const plteSentinel = 'PNG_PLTE_SECRET_SENTINEL_8f2k';
  const plteData = Buffer.from(plteSentinel.padEnd(
    Math.ceil(plteSentinel.length / 3) * 3,
    '_',
  ));
  const cases = [
    ['PLTE', pngChunk('PLTE', plteData), plteSentinel],
    ['ancillary pHYs', pngChunk('pHYs', Buffer.from([...Buffer.from('PHYSKEY8'), 0])), 'PHYSKEY8'],
    ['text', pngChunk('tEXt', Buffer.from('PNG_TEXT_SECRET_SENTINEL_4q9m')), 'PNG_TEXT_SECRET_SENTINEL_4q9m'],
    ['unknown ancillary', pngChunk('ruSt', Buffer.from('PNG_UNKNOWN_SECRET_SENTINEL_6n3v')), 'PNG_UNKNOWN_SECRET_SENTINEL_6n3v'],
  ];

  for (const [name, chunk, sentinel] of cases) {
    await t.test(name, () => {
      const bytes = insertAfterPngIhdr(VALID_PNG, chunk);
      const artifactPath = 'artifacts/non-canonical.png';
      const record = passRecord();
      addImageEvidence(record, artifactPath, bytes, 'image/png');
      const fixture = makeFixture([record]);
      writeFixtureArtifact(fixture, artifactPath, bytes);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /non-canonical PNG chunk/i);
        assert.doesNotMatch(`${result.stderr}${result.stdout}`, new RegExp(sentinel));
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects high-bit PNG chunk type aliases before ASCII conversion', () => {
  const highBitPlteAlias = Buffer.from([0xd0, 0xcc, 0xd4, 0xc5]);
  const bytes = insertAfterPngIhdr(
    VALID_PNG,
    pngChunkBytes(highBitPlteAlias, Buffer.alloc(3)),
  );
  const artifactPath = 'artifacts/high-bit-chunk.png';
  const record = passRecord();
  addImageEvidence(record, artifactPath, bytes, 'image/png');
  const fixture = makeFixture([record]);
  writeFixtureArtifact(fixture, artifactPath, bytes);
  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /invalid PNG chunk type/i);
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects malformed PNG structure despite a matching image attestation', async (t) => {
  const badCrc = Buffer.from(VALID_PNG);
  badCrc[32] ^= 0xff;
  const badLength = Buffer.from(VALID_PNG);
  badLength.writeUInt32BE(0xffffffff, 8);
  const missingIdat = Buffer.concat([
    VALID_PNG.subarray(0, 33),
    pngChunk('IEND'),
  ]);
  const cases = [
    ['signature only', VALID_PNG.subarray(0, 8)],
    ['truncated chunk', VALID_PNG.subarray(0, -4)],
    ['bad CRC', badCrc],
    ['out-of-bounds chunk length', badLength],
    ['zero dimensions', createTinyPng({ width: 0 })],
    ['missing IDAT', missingIdat],
  ];

  for (const [name, bytes] of cases) {
    await t.test(name, () => {
      const artifactPath = 'artifacts/structural.png';
      const record = passRecord();
      addImageEvidence(record, artifactPath, bytes, 'image/png');
      const fixture = makeFixture([record]);
      writeFixtureArtifact(fixture, artifactPath, bytes);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /invalid PNG structure/i);
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects PNG text and comment chunks without echoing payloads', async (t) => {
  for (const chunkType of ['tEXt', 'zTXt', 'iTXt', 'cOMM']) {
    await t.test(chunkType, () => {
      const sentinel = `PNG_METADATA_SENTINEL_${chunkType}`;
      const bytes = insertBeforePngIend(VALID_PNG, pngChunk(chunkType, Buffer.from(sentinel)));
      const artifactPath = 'artifacts/metadata.png';
      const record = passRecord();
      addImageEvidence(record, artifactPath, bytes, 'image/png');
      const fixture = makeFixture([record]);
      writeFixtureArtifact(fixture, artifactPath, bytes);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /non-canonical PNG chunk/i);
        assert.doesNotMatch(`${result.stderr}${result.stdout}`, new RegExp(sentinel));
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects PNG trailing bytes and appended polyglot secrets without echoing them', async (t) => {
  const cases = [
    ['trailing byte', Buffer.concat([VALID_PNG, Buffer.from([0x00])]), null],
    [
      'polyglot secret',
      Buffer.concat([VALID_PNG, Buffer.from('PNG_POLYGLOT_SECRET_SENTINEL_6j4q')]),
      'PNG_POLYGLOT_SECRET_SENTINEL_6j4q',
    ],
  ];

  for (const [name, bytes, sentinel] of cases) {
    await t.test(name, () => {
      const artifactPath = 'artifacts/trailing.png';
      const record = passRecord();
      addImageEvidence(record, artifactPath, bytes, 'image/png');
      const fixture = makeFixture([record]);
      writeFixtureArtifact(fixture, artifactPath, bytes);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /invalid PNG structure/i);
        if (sentinel !== null) {
          assert.doesNotMatch(`${result.stderr}${result.stdout}`, new RegExp(sentinel));
        }
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects JPEG evidence unconditionally even when checksum-bound and attested', async (t) => {
  const sentinel = 'JPEG_UNSUPPORTED_SENTINEL_3p8v';
  const cases = [
    ['JPG extension', 'artifacts/capture.jpg', JPEG_SHAPED_EVIDENCE, 'image/jpeg', null],
    ['JPEG extension', 'artifacts/capture.jpeg', JPEG_SHAPED_EVIDENCE, 'image/jpeg', null],
    [
      'JPEG with appended secret',
      'artifacts/appended.jpeg',
      Buffer.concat([JPEG_SHAPED_EVIDENCE, Buffer.from(sentinel)]),
      'image/jpeg',
      sentinel,
    ],
    ['JPEG magic under PNG extension', 'artifacts/mislabeled.png', JPEG_SHAPED_EVIDENCE, 'image/jpeg', null],
    ['image/jpeg attestation on PNG', 'artifacts/capture.png', VALID_PNG, 'image/jpeg', null],
  ];

  for (const [name, artifactPath, bytes, mediaType, secretSentinel] of cases) {
    await t.test(name, () => {
      const record = passRecord();
      addImageEvidence(record, artifactPath, bytes, mediaType);
      const fixture = makeFixture([record]);
      writeFixtureArtifact(fixture, artifactPath, bytes);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /unsupported JPEG evidence/i);
        if (secretSentinel !== null) {
          assert.doesNotMatch(`${result.stderr}${result.stdout}`, new RegExp(secretSentinel));
        }
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects PNG extension or magic-byte mismatches', async (t) => {
  const cases = [
    ['text with PNG extension', 'artifacts/capture.png', Buffer.from('not an image'), 'image/png'],
  ];

  for (const [name, artifactPath, bytes, mediaType] of cases) {
    await t.test(name, () => {
      const record = passRecord();
      addImageEvidence(record, artifactPath, bytes, mediaType);
      const fixture = makeFixture([record]);
      writeFixtureArtifact(fixture, artifactPath, bytes);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /image.*(?:extension|magic)|magic.*image/i);
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects missing, mismatched, or non-PASS image safety attestations', async (t) => {
  const cases = [
    ['missing audit', undefined, /missing image safety attestation/i],
    ['hash mismatch', { sha256: '0'.repeat(64) }, /image safety attestation.*sha256/i],
    [
      'redaction audit failed',
      { redaction_status: 'FAIL' },
      /image safety attestation.*PASS/i,
    ],
    [
      'visual secret review failed',
      { visual_secret_review_status: 'FAIL' },
      /image safety attestation.*PASS/i,
    ],
  ];

  for (const [name, attestationOverrides, expectedError] of cases) {
    await t.test(name, () => {
      const record = passRecord();
      addImageEvidence(record, 'artifacts/capture.png', VALID_PNG, 'image/png', {
        ...attestationOverrides,
      });
      if (attestationOverrides === undefined) delete record.image_safety_attestations;
      const fixture = makeFixture([record]);
      writeFixtureArtifact(fixture, 'artifacts/capture.png', VALID_PNG);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, expectedError);
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects arbitrary binary and symbolic-link evidence', async (t) => {
  await t.test('arbitrary binary', () => {
    const record = passRecord();
    const artifactPath = 'artifacts/capture.bin';
    record.artifact_paths.push(artifactPath);
    const fixture = makeFixture([record]);
    writeFixtureArtifact(fixture, artifactPath, Buffer.from([0x00, 0xff, 0x01, 0xfe]));

    try {
      const result = runReducer(fixture.input, fixture.output);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /unsupported.*binary|NUL-bearing/i);
      assert.equal(existsSync(fixture.output), false);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });

  await t.test('symbolic link', () => {
    const record = passRecord();
    const artifactPath = 'artifacts/capture.png';
    addImageEvidence(record, artifactPath, VALID_PNG, 'image/png');
    const fixture = makeFixture([record]);
    symlinkSync(path.join(fixture.input, 'artifacts/journey.json'), path.join(fixture.input, artifactPath));

    try {
      const result = runReducer(fixture.input, fixture.output);
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /symbolic link|invalid artifact_paths reference/i);
      assert.equal(existsSync(fixture.output), false);
    } finally {
      rmSync(fixture.root, { force: true, recursive: true });
    }
  });
});

test('rejects NUL-bearing artifacts without scanning around or echoing their contents', () => {
  const sentinel = 'NUL_SECRET_SENTINEL_5p9w';
  const fixture = makeFixture([passRecord()]);
  writeFileSync(
    path.join(fixture.input, 'artifacts/journey.json'),
    Buffer.from(`evidence-before\u0000${sentinel}`),
  );

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /NUL-bearing|unsupported binary/i);
    assert.doesNotMatch(result.stderr, new RegExp(sentinel));
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects unsupported non-UTF-8 binary artifacts fail-closed', () => {
  const fixture = makeFixture([passRecord()]);
  writeFileSync(
    path.join(fixture.input, 'artifacts/journey.json'),
    Buffer.from([0xff, 0xfe, 0xfd]),
  );

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /unsupported binary/i);
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects opaque pass-token keys in JSON without printing token values', async (t) => {
  const keyForms = ['pass_token', 'full_pass_token', 'passToken', 'fullPassToken'];

  for (const key of keyForms) {
    await t.test(key, () => {
      const sentinel = `OPAQUE_PASS_TOKEN_SENTINEL_${key}`;
      const fixture = makeFixture([passRecord()]);
      writeFileSync(
        path.join(fixture.input, 'artifacts/journey.json'),
        `${JSON.stringify({ [key]: sentinel })}\n`,
      );

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /full-token/);
        assert.doesNotMatch(result.stderr, new RegExp(sentinel));
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects historical baseline files instead of normalizing them', () => {
  const fixture = makeFixture([passRecord()]);
  renameSync(
    path.join(fixture.input, 'run-01.json'),
    path.join(fixture.input, 'historical-baseline.json'),
  );

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /historical baseline/i);
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects historical baseline metadata under neutral filenames', async (t) => {
  const cases = [
    ['record_type', { record_type: 'historical_baseline' }],
    ['equivalent nested metadata', {
      metadata: { evidence_role: 'historical-baseline' },
    }],
  ];

  for (const [name, metadata] of cases) {
    await t.test(name, () => {
      const fixture = makeFixture([passRecord(metadata)]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /historical baseline/i);
        assert.equal(existsSync(fixture.output), false);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('sorts results by run ID for deterministic output', () => {
  const fixture = makeFixture([
    passRecord({
      run_id: 'run-zeta',
      workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1010',
    }),
    passRecord({
      run_id: 'run-alpha',
      workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1009',
    }),
  ]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
    const firstJson = readFileSync(
      path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'),
      'utf8',
    );
    const firstMarkdown = readFileSync(
      path.join(fixture.output, 'sc1-sc5-evidence-receipt.md'),
      'utf8',
    );
    const receipt = JSON.parse(firstJson);
    assert.deepEqual(
      receipt.criteria.SC1.results.map((entry) => entry.run_id),
      ['run-alpha', 'run-zeta'],
    );

    const secondOutput = path.join(fixture.root, 'receipt-second');
    const secondResult = runReducer(fixture.input, secondOutput);
    assert.equal(secondResult.status, 0, secondResult.stderr);
    assert.equal(
      readFileSync(path.join(secondOutput, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
      firstJson,
    );
    assert.equal(
      readFileSync(path.join(secondOutput, 'sc1-sc5-evidence-receipt.md'), 'utf8'),
      firstMarkdown,
    );
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('produces identical receipts for permuted filenames, paths, and diagnostic codes', () => {
  const makeControl = (artifactPaths, diagnosticCodes) => blockedControlRecord({
    artifact_paths: artifactPaths,
    failure: {
      category: 'REMOTE_DISPATCH_PROHIBITED',
      diagnostics: { diagnostic_codes: diagnosticCodes },
      reason_code: 'ZERO_COST_UNVERIFIED',
    },
  });
  const fixtureA = makeFixture([makeControl(
    ['artifacts/security.json', 'artifacts/journey.json'],
    ['NOT_AUTHORIZED_TO_PUSH', 'MISSING_USER_PLAN_SCOPE', 'NOT_AUTHORIZED_TO_PUSH'],
  )]);
  const fixtureB = makeFixture([makeControl(
    ['artifacts/journey.json', 'artifacts/security.json'],
    ['MISSING_USER_PLAN_SCOPE', 'NOT_AUTHORIZED_TO_PUSH'],
  )]);
  renameSync(
    path.join(fixtureA.input, 'run-01.json'),
    path.join(fixtureA.input, 'z-control.json'),
  );
  renameSync(
    path.join(fixtureB.input, 'run-01.json'),
    path.join(fixtureB.input, 'a-control.json'),
  );

  try {
    const resultA = runReducer(fixtureA.input, fixtureA.output);
    const resultB = runReducer(fixtureB.input, fixtureB.output);
    assert.equal(resultA.status, 0, resultA.stderr);
    assert.equal(resultB.status, 0, resultB.stderr);
    const jsonA = readFileSync(
      path.join(fixtureA.output, 'sc1-sc5-evidence-receipt.json'),
      'utf8',
    );
    const jsonB = readFileSync(
      path.join(fixtureB.output, 'sc1-sc5-evidence-receipt.json'),
      'utf8',
    );
    const markdownA = readFileSync(
      path.join(fixtureA.output, 'sc1-sc5-evidence-receipt.md'),
      'utf8',
    );
    const markdownB = readFileSync(
      path.join(fixtureB.output, 'sc1-sc5-evidence-receipt.md'),
      'utf8',
    );
    assert.equal(jsonB, jsonA);
    assert.equal(markdownB, markdownA);
    const receipt = JSON.parse(jsonA);
    assert.deepEqual(receipt.blocked_scenarios[0].artifact_paths, [
      'artifacts/journey.json',
      'artifacts/security.json',
    ]);
    assert.deepEqual(receipt.failure_records[0].diagnostics.diagnostic_codes, [
      'MISSING_USER_PLAN_SCOPE',
      'NOT_AUTHORIZED_TO_PUSH',
    ]);
  } finally {
    rmSync(fixtureA.root, { force: true, recursive: true });
    rmSync(fixtureB.root, { force: true, recursive: true });
  }
});

test('records evidence completeness and scope in the JSON receipt', () => {
  const fixture = makeFixture([passRecord()]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(
      readFileSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
    );
    assert.deepEqual(receipt.evidence_completeness, {
      complete: false,
      control_records: 0,
      criteria_with_required_observations: 0,
      records_validated: 1,
      target_observations_missing: 9,
      traceable_results: 5,
    });
    assert.equal(
      receipt.evidence_scope.repeated_fixture_runs,
      'controlled software repeatability only',
    );
    assert.deepEqual(receipt.evidence_scope.unestablished, [
      'real-camera capture',
      'camera QR scanning',
      'physical radio loss',
      'participant FAR/FRR/EER',
      'demographic fairness',
      'sophisticated PAD',
      'user acceptance',
      'public deployment',
    ]);
    assert.equal(
      receipt.evidence_scope.latency_policy,
      'never infer latency from zero or missing fields',
    );
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects an input directory with no target or control records', () => {
  const fixture = makeFixture([]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /no target or control records/i);
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects an unreferenced secret-bearing artifact', () => {
  const sentinel = 'UNREFERENCED_PASSWORD_SENTINEL_4k8s';
  const fixture = makeFixture([passRecord()]);
  writeFileSync(
    path.join(fixture.input, 'artifacts/unreferenced.json'),
    `${JSON.stringify({ password: sentinel })}\n`,
  );

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /password/);
    assert.doesNotMatch(result.stderr, new RegExp(sentinel));
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects successful claims with missing authoritative metrics', () => {
  const record = passRecord();
  delete record.authoritative_backend.claimed_counts.accepted_check_ins;
  delete record.authoritative_backend.observed_counts.accepted_check_ins;
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /authoritative backend evidence.*SC1/i);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects SC3 PASS without every scanned privacy surface', async (t) => {
  const requiredSurfaces = [
    'schema',
    'rows',
    'api_responses',
    'server_logs',
    'csv_exports',
    'retained_evidence',
  ];

  for (const surface of requiredSurfaces) {
    await t.test(surface, () => {
      const record = passRecord();
      record.privacy_audit.surfaces = record.privacy_audit.surfaces.filter(
        (entry) => entry.surface !== surface,
      );
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(`privacy_audit\\.surfaces.*${surface}`, 'i'));
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects SC3 PASS with incomplete or source-only privacy conclusions', async (t) => {
  const cases = [
    ['surface not scanned', 'privacy_audit.surfaces', (record) => {
      record.privacy_audit.surfaces[0].scanned = false;
    }],
    ['forbidden biometric count', 'privacy_audit.forbidden_reusable_biometrics_count', (record) => {
      record.privacy_audit.forbidden_reusable_biometrics_count = 1;
    }],
    ['payload not classified', 'privacy_audit.encrypted_gate_bound_payload_classification', (record) => {
      record.privacy_audit.encrypted_gate_bound_payload_classification = 'unknown';
    }],
    ['central reusable biometric storage', 'privacy_audit.reusable_biometrics_centrally_stored', (record) => {
      record.privacy_audit.reusable_biometrics_centrally_stored = true;
    }],
    ['source-only review', 'privacy_audit.source_only', (record) => {
      record.privacy_audit.source_only = true;
    }],
  ];

  for (const [name, field, mutate] of cases) {
    await t.test(name, () => {
      const record = passRecord();
      mutate(record);
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(field.replaceAll('.', '\\.')));
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects SC4 PASS without every required security scenario row', async (t) => {
  for (const scenario of SECURITY_SCENARIOS) {
    await t.test(scenario, () => {
      const record = passRecord();
      record.security_matrix.scenarios = record.security_matrix.scenarios.filter(
        (row) => row.scenario !== scenario,
      );
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(`security_matrix\\.scenarios.*${scenario}`, 'i'));
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('rejects incomplete or semantically false SC4 scenario rows', async (t) => {
  const cases = [
    ['input identity', (row) => { row.input_identity = ''; }],
    ['expected decision', (row) => { row.expected = 'UNKNOWN'; }],
    ['observed decision', (row) => { row.observed = 'REJECT'; }],
    ['reason code', (row) => { row.reason_code = ''; }],
    ['timestamp', (row) => { row.timestamp = 'yesterday'; }],
    ['backend consequence', (row) => { row.backend_consequence = ''; }],
    ['row status', (row) => { row.status = 'FAIL'; }],
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const record = passRecord();
      mutate(record.security_matrix.scenarios[0]);
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /security_matrix\.scenarios/i);
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('requires the stale-cache limitation separately from SC4 scenario rows', () => {
  const record = passRecord();
  delete record.security_matrix.stale_cache_limitation;
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /security_matrix\.stale_cache_limitation/i);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects SC5 PASS without the exact restart, reconnect, and idempotency lifecycle', async (t) => {
  const cases = [
    ['before_restart_pending_queue_count', (assertions) => {
      assertions.before_restart_pending_queue_count = 2;
    }],
    ['original_gate_time', (assertions) => { assertions.original_gate_time = 'unknown'; }],
    ['after_restart_pending_queue_count', (assertions) => {
      assertions.after_restart_pending_queue_count = 0;
    }],
    ['after_restart_offline', (assertions) => { assertions.after_restart_offline = false; }],
    ['signed_reconnect_sync', (assertions) => { assertions.signed_reconnect_sync = false; }],
    ['queue_cleared', (assertions) => { assertions.queue_cleared = false; }],
    ['dashboard_update_count', (assertions) => { assertions.dashboard_update_count = 2; }],
    ['idempotent_retry_no_duplicate', (assertions) => {
      assertions.idempotent_retry_no_duplicate = false;
    }],
  ];

  for (const [field, mutate] of cases) {
    await t.test(field, () => {
      const record = passRecord();
      mutate(record.checks.SC5.assertions);
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(`checks\\.SC5\\.assertions\\.${field}`));
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('requires exactly one synchronized and accepted backend effect for SC5 PASS', async (t) => {
  for (const metric of [
    'synchronized_check_ins',
    'accepted_check_ins',
    'checked_in_tickets',
  ]) {
    await t.test(metric, () => {
      const record = passRecord({
        failure: {
          category: 'CRITERION_FAILURE',
          reason_code: 'REQUIRED_SCENARIO_NOT_TESTED',
        },
        status: 'PARTIAL',
      });
      record.checks.SC1.status = 'NOT_TESTED';
      record.authoritative_backend.claimed_counts[metric] = 2;
      record.authoritative_backend.observed_counts[metric] = 2;
      const fixture = makeFixture([record]);
      writeBackendCounts(fixture, record.authoritative_backend.observed_counts);

      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, new RegExp(`SC5.*exactly one.*${metric}`, 'i'));
      } finally {
        rmSync(fixture.root, { force: true, recursive: true });
      }
    });
  }
});

test('reports a blocked target run separately from a blocked preflight control', () => {
  const record = passRecord({
    failure: {
      category: 'WORKFLOW_FAILURE',
      reason_code: 'WORKFLOW_TIMEOUT',
    },
    run_id: 'run-blocked-001',
    status: 'BLOCKED',
    workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1011',
  });
  record.checks.SC2.status = 'BLOCKED';
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(
      readFileSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
    );
    assert.equal(receipt.status, 'BLOCKED');
    assert.deepEqual(receipt.blocked_scenarios, [{
      artifact_paths: ['artifacts/journey.json'],
      category: 'WORKFLOW_FAILURE',
      counts_toward_target: true,
      criteria: ['SC2'],
      run_id: 'run-blocked-001',
      workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1011',
    }]);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects artifact names containing Markdown control characters', () => {
  const unsafeArtifact = 'artifacts/unsafe`|reference.json';
  const record = passRecord();
  record.artifact_paths.push(unsafeArtifact);
  record.checks.SC1.artifact_paths = [unsafeArtifact];
  const fixture = makeFixture([record]);
  writeFileSync(path.join(fixture.input, unsafeArtifact), '{"safe":true}\n');

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /artifact_paths/);
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('links successful criterion results to their supporting audit artifacts', () => {
  const fixture = makeFixture([passRecord()]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(
      readFileSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
    );
    assert.deepEqual(receipt.criteria.SC1.results[0].artifact_paths, [
      'artifacts/backend-counts.json',
      'artifacts/journey.json',
    ]);
    assert.deepEqual(receipt.criteria.SC2.results[0].artifact_paths, [
      'artifacts/journey.json',
    ]);
    assert.deepEqual(receipt.criteria.SC3.results[0].artifact_paths, [
      'artifacts/privacy.json',
    ]);
    assert.deepEqual(receipt.criteria.SC4.results[0].artifact_paths, [
      'artifacts/security.json',
    ]);
    assert.deepEqual(receipt.criteria.SC5.results[0].artifact_paths, [
      'artifacts/backend-counts.json',
      'artifacts/journey.json',
    ]);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects authoritative counts that disagree with the raw backend artifact', () => {
  const fixture = makeFixture([passRecord()]);
  writeFileSync(
    path.join(fixture.input, 'artifacts/backend-counts.json'),
    `${JSON.stringify({
      accepted_check_ins: 0,
      checked_in_tickets: 0,
      synchronized_check_ins: 0,
    })}\n`,
  );

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /raw evidence.*authoritative_backend/i);
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});
