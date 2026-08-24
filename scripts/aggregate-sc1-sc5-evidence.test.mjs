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
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const reducerPath = path.join(scriptsDirectory, 'aggregate-sc1-sc5-evidence.mjs');

function passRecord(overrides = {}) {
  const artifactPaths = [
    'artifacts/backend-counts.json',
    'artifacts/journey.json',
    'artifacts/privacy.json',
    'artifacts/security.json',
  ];

  return {
    artifact_paths: artifactPaths,
    attendee_id_hash: 'b'.repeat(64),
    authoritative_backend: {
      artifact_paths: ['artifacts/backend-counts.json'],
      claimed_counts: {
        successful_check_ins: 1,
        synchronized_check_ins: 1,
      },
      observed_counts: {
        successful_check_ins: 1,
        synchronized_check_ins: 1,
      },
      status: 'PASS',
    },
    checks: Object.fromEntries(
      ['SC1', 'SC2', 'SC3', 'SC4', 'SC5'].map((criterion) => [
        criterion,
        {
          artifact_paths: ['artifacts/journey.json'],
          status: 'PASS',
        },
      ]),
    ),
    commit_sha: 'a'.repeat(40),
    counts_toward_target: true,
    event_id: 'event-001',
    failure: null,
    fixture_sha256: 'c'.repeat(64),
    gate_key_fingerprint: 'd'.repeat(64),
    mutable_state_isolated: true,
    network_loss_method: 'stopped_macOS_relay',
    organizer_id_hash: 'e'.repeat(64),
    privacy_audit: {
      artifact_paths: ['artifacts/privacy.json'],
      reusable_biometrics_centrally_stored: false,
      status: 'PASS',
    },
    provisioning_mode: 'e2e_payload_injection',
    provisioning_qr_camera_scan: false,
    run_id: 'run-001',
    runner_os: 'macOS-15',
    security_matrix: {
      artifact_paths: ['artifacts/security.json'],
      copied_pass_rejected: 'PASS',
      replay_rejected: 'PASS',
      status: 'PASS',
    },
    started_at: '2026-08-24T00:00:00.000Z',
    status: 'PASS',
    ticket_id: 'ticket-001',
    workflow_run_url: 'https://github.com/example/Focaccia/actions/runs/1001',
    ...overrides,
  };
}

function blockedControlRecord(overrides = {}) {
  const record = passRecord({
    attendee_id_hash: null,
    authoritative_backend: {
      artifact_paths: ['artifacts/security.json'],
      claimed_counts: {
        successful_check_ins: 0,
        synchronized_check_ins: 0,
      },
      observed_counts: {
        successful_check_ins: 0,
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
  for (const criterion of ['SC1', 'SC2', 'SC3', 'SC4', 'SC5']) {
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
    `${JSON.stringify({ successful_check_ins: 1, synchronized_check_ins: 1 })}\n`,
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

    for (const criterion of ['SC1', 'SC2', 'SC3', 'SC4', 'SC5']) {
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
  record.authoritative_backend.observed_counts.successful_check_ins = 0;
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

test('rejects internally inconsistent PASS records', async (t) => {
  const cases = [
    ['failed criterion', (record) => { record.checks.SC4.status = 'FAIL'; }],
    ['partial security matrix', (record) => { record.security_matrix.status = 'PARTIAL'; }],
    ['partial privacy audit', (record) => { record.privacy_audit.status = 'PARTIAL'; }],
    ['non-isolated state', (record) => { record.mutable_state_isolated = false; }],
  ];

  for (const [name, mutate] of cases) {
    await t.test(name, () => {
      const record = passRecord();
      mutate(record);
      const fixture = makeFixture([record]);
      try {
        const result = runReducer(fixture.input, fixture.output);
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /PASS record/i);
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

    const serializedOutput = `${JSON.stringify(receipt)}${readFileSync(
      path.join(fixture.output, 'sc1-sc5-evidence-receipt.md'),
      'utf8',
    )}`;
    assert.match(serializedOutput, /QUEUE_PERSISTENCE/);
    assert.doesNotMatch(serializedOutput, /controlled queue persistence assertion failed/i);
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
    assert.deepEqual(receipt.target, {
      observed_target_runs: 0,
      remaining_required_runs: 10,
      required_runs: 10,
    });
    for (const criterion of ['SC1', 'SC2', 'SC3', 'SC4', 'SC5']) {
      assert.equal(receipt.criteria[criterion].numerator, 0);
      assert.equal(receipt.criteria[criterion].observed_denominator, 0);
      assert.deepEqual(receipt.criteria[criterion].results, []);
    }
    assert.equal(receipt.blocked_scenarios.length, 1);
    assert.equal(receipt.blocked_scenarios[0].counts_toward_target, false);
    assert.equal(receipt.blocked_scenarios[0].workflow_run_url, null);
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
  delete record.authoritative_backend.claimed_counts.successful_check_ins;
  delete record.authoritative_backend.observed_counts.successful_check_ins;
  const fixture = makeFixture([record]);

  try {
    const result = runReducer(fixture.input, fixture.output);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /authoritative backend evidence.*SC1/i);
  } finally {
    rmSync(fixture.root, { force: true, recursive: true });
  }
});

test('rejects SC3-SC4 PASS claims without explicit audit support', async (t) => {
  const cases = [
    ['privacy_audit', (record) => {
      delete record.privacy_audit.reusable_biometrics_centrally_stored;
    }],
    ['security_matrix.copied_pass_rejected', (record) => {
      record.security_matrix.copied_pass_rejected = 'NOT_TESTED';
    }],
    ['security_matrix.replay_rejected', (record) => {
      record.security_matrix.replay_rejected = 'FAIL';
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
    `${JSON.stringify({ successful_check_ins: 0, synchronized_check_ins: 0 })}\n`,
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
