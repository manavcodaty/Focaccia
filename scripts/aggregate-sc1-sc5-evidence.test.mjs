import assert from 'node:assert/strict';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const reducerPath = path.join(scriptsDirectory, 'aggregate-sc1-sc5-evidence.mjs');
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
        artifact_paths: ['artifacts/journey.json'],
        status: 'PASS',
      },
      SC4: {
        artifact_paths: ['artifacts/journey.json'],
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
      reason: 'The zero-cost security preflight prohibited remote dispatch.',
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
  const root = mkdtempSync(path.join(tmpdir(), 'focaccia-sc1-sc5-test-'));
  const input = path.join(root, 'input');
  const output = path.join(root, 'receipt');
  const artifacts = path.join(input, 'artifacts');
  mkdirSync(artifacts, { recursive: true });

  writeFileSync(
    path.join(artifacts, 'backend-counts.json'),
    `${JSON.stringify({
      accepted_check_ins: 1,
      checked_in_tickets: 1,
      synchronized_check_ins: 1,
    })}\n`,
  );
  writeFileSync(path.join(artifacts, 'journey.json'), '{"journey":"complete"}\n');
  writeFileSync(path.join(artifacts, 'privacy.json'), '{"central_biometric_rows":0}\n');
  writeFileSync(path.join(artifacts, 'security.json'), '{"replay":"rejected"}\n');

  records.forEach((record, index) => {
    writeFileSync(
      path.join(input, `run-${String(index + 1).padStart(2, '0')}.json`),
      `${JSON.stringify(record, null, 2)}\n`,
    );
  });

  return { input, output, root };
}

function runReducer(input, output) {
  return spawnSync(process.execPath, [reducerPath, '--input', input, '--output', output], {
    encoding: 'utf8',
  });
}

function writeBackendCounts(fixture, counts) {
  writeFileSync(
    path.join(fixture.input, 'artifacts/backend-counts.json'),
    `${JSON.stringify(counts)}\n`,
  );
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
        category: 'SHOULD_NOT_EXIST',
        reason: 'A PASS record cannot retain a failure.',
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

test('permits a pre-creation target failure with nullable isolation identities without counting it', () => {
  const record = passRecord({
    attendee_id_hash: null,
    event_id: null,
    failure: {
      category: 'PRE_CREATION_SETUP',
      diagnostics: { phase: 'fixture_setup' },
      reason: 'Fixture creation failed before target identities existed.',
      stage: 'PRE_CREATION',
    },
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

test('rejects nullable target identities outside a structured pre-creation failure', async (t) => {
  const cases = [
    ['PASS record', passRecord({ event_id: null })],
    ['post-creation failure', passRecord({
      event_id: null,
      failure: {
        category: 'POST_CREATION_FAILURE',
        reason: 'The event identity should already exist.',
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
      category: 'QUEUE_PERSISTENCE',
      diagnostics: {
        assertion: 'pending_queue_after_restart',
        expected: 1,
        observed: 0,
      },
      reason: 'The controlled queue persistence assertion failed.',
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
      category: 'QUEUE_PERSISTENCE',
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
      category: 'QUEUE_PERSISTENCE',
      diagnostics: {
        assertion: 'pending_queue_after_restart',
        expected: 1,
        observed: 0,
      },
      reason: 'The controlled queue persistence assertion failed.',
      run_id: 'run-failed-001',
      workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1003',
    }]);

    const serializedOutput = `${JSON.stringify(receipt)}${readFileSync(
      path.join(fixture.output, 'sc1-sc5-evidence-receipt.md'),
      'utf8',
    )}`;
    assert.match(serializedOutput, /QUEUE_PERSISTENCE/);
    assert.match(serializedOutput, /controlled queue persistence assertion failed/i);
    assert.match(serializedOutput, /pending_queue_after_restart/);
    assert.match(serializedOutput, /artifacts\/journey\.json/);
    assert.match(serializedOutput, /actions\/runs\/1003/);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('derives overall FAIL when any target criterion fails despite a PARTIAL record status', () => {
  const record = passRecord({
    failure: {
      category: 'SECURITY_SCENARIO_FAILURE',
      reason: 'A required security scenario did not match its expected decision.',
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
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(
      readFileSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
    );
    assert.equal(receipt.status, 'FAIL');
    assert.equal(receipt.criteria.SC4.status, 'FAIL');
    assert.equal(receipt.criteria.SC4.numerator, 0);
    assert.equal(receipt.criteria.SC4.observed_denominator, 1);

    const markdown = readFileSync(
      path.join(fixture.output, 'sc1-sc5-evidence-receipt.md'),
      'utf8',
    );
    assert.match(markdown, /Overall status: `FAIL`/);
    assert.match(markdown, /\| SC4 \| 0 \| 1 \| 10 \| `FAIL` \|/);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('derives criterion and overall FAIL from a failed supporting evidence section', () => {
  const record = passRecord({
    failure: {
      category: 'PRIVACY_AUDIT_FAILURE',
      reason: 'The retained-evidence audit section failed.',
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
    assert.equal(result.status, 0, result.stderr);
    const receipt = JSON.parse(
      readFileSync(path.join(fixture.output, 'sc1-sc5-evidence-receipt.json'), 'utf8'),
    );
    assert.equal(receipt.criteria.SC3.status, 'FAIL');
    assert.equal(receipt.criteria.SC3.results[0].status, 'FAIL');
    assert.equal(receipt.status, 'FAIL');
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
      category: 'PRIVACY_AUDIT_NOT_RUN',
      reason: 'The privacy audit was not run for this target observation.',
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
      artifact_paths: ['artifacts/journey.json'],
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
          category: 'SC1_NOT_EVALUATED',
          reason: 'SC1 is excluded to isolate SC5 backend validation.',
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
      category: 'RUNNER_CAPACITY',
      reason: 'The target workflow was blocked after dispatch.',
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
      category: 'RUNNER_CAPACITY',
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
    assert.deepEqual(receipt.criteria.SC3.results[0].artifact_paths, [
      'artifacts/journey.json',
      'artifacts/privacy.json',
    ]);
    assert.deepEqual(receipt.criteria.SC4.results[0].artifact_paths, [
      'artifacts/journey.json',
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
    assert.match(result.stderr, /authoritative backend artifact count mismatch/i);
    assert.equal(existsSync(fixture.output), false);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});
