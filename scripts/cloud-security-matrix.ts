import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cancelableTemplateV1,
  canonicalJsonBytes,
  ed25519Keypair,
  ed25519SignDetached,
  prepareCrypto,
  toBase64Url,
  x25519Keypair,
  x25519Seal,
  type PassPayload,
} from '../packages/shared/dist/index.js';

import {
  destroyPendingVerification,
  finalizeOfflineVerification,
  prepareOfflineVerification,
} from '../apps/gate/src/lib/offline-verifier.ts';
import type { StoredGateConfig } from '../apps/gate/src/lib/types.ts';

const SCENARIOS = [
  'genuine_unused_accept',
  'replayed_or_copied',
  'modified_or_tampered',
  'wrong_event',
  'expired_or_out_of_window',
  'cancelled_or_revoked_after_refresh',
] as const;

type Scenario = typeof SCENARIOS[number];

interface BuildOptions {
  eventId: string;
  inputIdentityPrefix: string;
  now?: Date;
}

interface ScenarioRow {
  backend_consequence: string;
  expected: 'ACCEPT' | 'REJECT';
  input_identity: string;
  observed: 'ACCEPT' | 'REJECT';
  reason_code: string;
  scenario: Scenario;
  status: 'PASS';
  timestamp: string;
}

interface SecurityHarnessResult {
  scenarios: ScenarioRow[];
  stale_cache_limitation: {
    represented: true;
    status: 'NOT_TESTED';
  };
  status: 'PARTIAL';
}

function secureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function mockEmbedding(): Float32Array {
  return Float32Array.from(
    { length: 512 },
    (_value, index) => Math.sin(index * 0.37) * 0.6 + Math.cos(index * 0.11) * 0.4,
  );
}

function assertSafeIdentifier(value: string, label: string): void {
  if (!/^[A-Za-z0-9._:-]{1,200}$/.test(value)) {
    throw new Error(`${label} must be a safe identifier.`);
  }
}

async function buildSignedToken({
  embedding,
  eventId,
  eventSalt,
  expiresAt,
  gatePublicKey,
  issuedAt,
  passId,
  signingPrivateKey,
}: {
  embedding: ArrayLike<number>;
  eventId: string;
  eventSalt: Uint8Array;
  expiresAt: number;
  gatePublicKey: Uint8Array;
  issuedAt: number;
  passId: string;
  signingPrivateKey: Uint8Array;
}): Promise<string> {
  const template = await cancelableTemplateV1(embedding, eventSalt);
  try {
    const encryptedTemplate = await x25519Seal(template, gatePublicKey);
    try {
      const payload: PassPayload = {
        enc_template: await toBase64Url(encryptedTemplate),
        event_id: eventId,
        exp: expiresAt,
        iat: issuedAt,
        nonce: await toBase64Url(secureRandomBytes(12)),
        pass_id: passId,
        single_use: true,
        v: 1,
      };
      const payloadBytes = canonicalJsonBytes(
        payload as unknown as Record<string, boolean | number | string>,
      );
      const signature = await ed25519SignDetached(payloadBytes, signingPrivateKey);
      try {
        return `${await toBase64Url(payloadBytes)}.${await toBase64Url(signature)}`;
      } finally {
        signature.fill(0);
        payloadBytes.fill(0);
      }
    } finally {
      encryptedTemplate.fill(0);
    }
  } finally {
    template.fill(0);
  }
}

function tamperSignature(token: string): string {
  const [payload, signature] = token.split('.');
  assert.ok(payload && signature, 'Expected a two-part signed pass token.');
  const replacement = signature[0] === 'A' ? 'B' : 'A';
  return `${payload}.${replacement}${signature.slice(1)}`;
}

function timestampFor(now: Date, index: number): string {
  return new Date(now.getTime() + (index + 1) * 1_000).toISOString();
}

function rejectedRow({
  identityPrefix,
  index,
  now,
  reasonCode,
  scenario,
}: {
  identityPrefix: string;
  index: number;
  now: Date;
  reasonCode: string;
  scenario: Exclude<Scenario, 'genuine_unused_accept'>;
}): ScenarioRow {
  return {
    backend_consequence: 'offline_harness_rejection_no_backend_write',
    expected: 'REJECT',
    input_identity: `${identityPrefix}:${scenario}`,
    observed: 'REJECT',
    reason_code: reasonCode,
    scenario,
    status: 'PASS',
    timestamp: timestampFor(now, index),
  };
}

export async function buildOfflineSecurityScenarios({
  eventId,
  inputIdentityPrefix,
  now = new Date(),
}: BuildOptions): Promise<SecurityHarnessResult> {
  assertSafeIdentifier(eventId, 'eventId');
  assertSafeIdentifier(inputIdentityPrefix, 'inputIdentityPrefix');
  if (Number.isNaN(now.getTime())) throw new Error('now must be a valid date.');

  await prepareCrypto();
  const nowUnix = Math.floor(now.getTime() / 1_000);
  const eventSalt = secureRandomBytes(32);
  const signingKeys = await ed25519Keypair();
  const gateKeys = await x25519Keypair();
  const embedding = mockEmbedding();

  const storedGate: StoredGateConfig = {
    ends_at: new Date((nowUnix + 7_200) * 1_000).toISOString(),
    event_id: eventId,
    event_name: 'SC1-SC5 security harness',
    event_salt: await toBase64Url(eventSalt),
    gate_device_id: null,
    key_version: 1,
    last_revocation_sync_at: now.toISOString(),
    pk_gate_event: await toBase64Url(gateKeys.publicKey),
    pk_sign_event: await toBase64Url(signingKeys.publicKey),
    policy: {
      liveness_timeout_ms: 5_000,
      match_threshold: 80,
      queue_code_enabled: true,
      queue_code_digits: 8,
      single_entry: true,
      typed_token_fallback: true,
    },
    provisioned_at: now.toISOString(),
    starts_at: new Date((nowUnix - 300) * 1_000).toISOString(),
    sync_public_key: null,
  };

  try {
    const passId = await toBase64Url(secureRandomBytes(16));
    const validToken = await buildSignedToken({
      embedding,
      eventId,
      eventSalt,
      expiresAt: nowUnix + 3_600,
      gatePublicKey: gateKeys.publicKey,
      issuedAt: nowUnix - 30,
      passId,
      signingPrivateKey: signingKeys.privateKey,
    });

    const genuine = await prepareOfflineVerification({
      checkReplay: async () => false,
      checkRevoked: async () => false,
      event: storedGate,
      gatePrivateKey: gateKeys.privateKey,
      now,
      token: validToken,
    });
    assert.equal(genuine.ok, true, 'Genuine pass did not reach liveness.');
    if (!genuine.ok) throw new Error('Genuine pass did not reach liveness.');
    const accepted = await finalizeOfflineVerification({
      liveEmbedding: embedding,
      livenessMs: 1,
      pending: genuine.pending,
    });
    destroyPendingVerification(genuine.pending);
    assert.equal(accepted.reasonCode, 'ACCEPT', 'Genuine pass was not accepted.');

    const rows: ScenarioRow[] = [{
      backend_consequence: 'offline_harness_accept_only_no_backend_write',
      expected: 'ACCEPT',
      input_identity: `${inputIdentityPrefix}:genuine_unused_accept`,
      observed: 'ACCEPT',
      reason_code: accepted.reasonCode,
      scenario: 'genuine_unused_accept',
      status: 'PASS',
      timestamp: timestampFor(now, 0),
    }];

    const replay = await prepareOfflineVerification({
      checkReplay: async () => true,
      checkRevoked: async () => false,
      event: storedGate,
      gatePrivateKey: gateKeys.privateKey,
      now,
      token: validToken,
    });
    assert.equal(replay.ok, false, 'Replay unexpectedly reached liveness.');
    if (replay.ok) throw new Error('Replay unexpectedly reached liveness.');
    rows.push(rejectedRow({
      identityPrefix: inputIdentityPrefix,
      index: 1,
      now,
      reasonCode: replay.decision.reasonCode,
      scenario: 'replayed_or_copied',
    }));

    const tampered = await prepareOfflineVerification({
      checkReplay: async () => false,
      checkRevoked: async () => false,
      event: storedGate,
      gatePrivateKey: gateKeys.privateKey,
      now,
      token: tamperSignature(validToken),
    });
    assert.equal(tampered.ok, false, 'Tampered pass unexpectedly reached liveness.');
    if (tampered.ok) throw new Error('Tampered pass unexpectedly reached liveness.');
    rows.push(rejectedRow({
      identityPrefix: inputIdentityPrefix,
      index: 2,
      now,
      reasonCode: tampered.decision.reasonCode,
      scenario: 'modified_or_tampered',
    }));

    const wrongEventToken = await buildSignedToken({
      embedding,
      eventId: `${eventId}-other`,
      eventSalt,
      expiresAt: nowUnix + 3_600,
      gatePublicKey: gateKeys.publicKey,
      issuedAt: nowUnix - 30,
      passId: await toBase64Url(secureRandomBytes(16)),
      signingPrivateKey: signingKeys.privateKey,
    });
    const wrongEvent = await prepareOfflineVerification({
      checkReplay: async () => false,
      checkRevoked: async () => false,
      event: storedGate,
      gatePrivateKey: gateKeys.privateKey,
      now,
      token: wrongEventToken,
    });
    assert.equal(wrongEvent.ok, false, 'Wrong-event pass unexpectedly reached liveness.');
    if (wrongEvent.ok) throw new Error('Wrong-event pass unexpectedly reached liveness.');
    rows.push(rejectedRow({
      identityPrefix: inputIdentityPrefix,
      index: 3,
      now,
      reasonCode: wrongEvent.decision.reasonCode,
      scenario: 'wrong_event',
    }));

    const expiredToken = await buildSignedToken({
      embedding,
      eventId,
      eventSalt,
      expiresAt: nowUnix - 1,
      gatePublicKey: gateKeys.publicKey,
      issuedAt: nowUnix - 3_600,
      passId: await toBase64Url(secureRandomBytes(16)),
      signingPrivateKey: signingKeys.privateKey,
    });
    const expired = await prepareOfflineVerification({
      checkReplay: async () => false,
      checkRevoked: async () => false,
      event: storedGate,
      gatePrivateKey: gateKeys.privateKey,
      now,
      token: expiredToken,
    });
    assert.equal(expired.ok, false, 'Expired pass unexpectedly reached liveness.');
    if (expired.ok) throw new Error('Expired pass unexpectedly reached liveness.');
    rows.push(rejectedRow({
      identityPrefix: inputIdentityPrefix,
      index: 4,
      now,
      reasonCode: expired.decision.reasonCode,
      scenario: 'expired_or_out_of_window',
    }));

    const revokedToken = await buildSignedToken({
      embedding,
      eventId,
      eventSalt,
      expiresAt: nowUnix + 3_600,
      gatePublicKey: gateKeys.publicKey,
      issuedAt: nowUnix - 30,
      passId: await toBase64Url(secureRandomBytes(16)),
      signingPrivateKey: signingKeys.privateKey,
    });
    const revoked = await prepareOfflineVerification({
      checkReplay: async () => false,
      checkRevoked: async () => true,
      event: storedGate,
      gatePrivateKey: gateKeys.privateKey,
      now,
      token: revokedToken,
    });
    assert.equal(revoked.ok, false, 'Revoked pass unexpectedly reached liveness.');
    if (revoked.ok) throw new Error('Revoked pass unexpectedly reached liveness.');
    rows.push(rejectedRow({
      identityPrefix: inputIdentityPrefix,
      index: 5,
      now,
      reasonCode: revoked.decision.reasonCode,
      scenario: 'cancelled_or_revoked_after_refresh',
    }));

    return {
      scenarios: rows,
      stale_cache_limitation: {
        represented: true,
        status: 'NOT_TESTED',
      },
      status: 'PARTIAL',
    };
  } finally {
    eventSalt.fill(0);
    signingKeys.privateKey.fill(0);
    signingKeys.publicKey.fill(0);
    gateKeys.privateKey.fill(0);
    gateKeys.publicKey.fill(0);
    embedding.fill(0);
  }
}

function parseCliArguments(argv: string[]): { eventId: string; inputIdentityPrefix: string; output: string } {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith('--') || !value) throw new Error('Invalid command arguments.');
    values.set(flag, value);
  }
  const eventId = values.get('--event-id');
  const inputIdentityPrefix = values.get('--input-identity-prefix');
  const output = values.get('--output');
  if (!eventId || !inputIdentityPrefix || !output || values.size !== 3) {
    throw new Error('Required arguments: --event-id, --input-identity-prefix, --output.');
  }
  return { eventId, inputIdentityPrefix, output: path.resolve(output) };
}

async function main(): Promise<void> {
  const { eventId, inputIdentityPrefix, output } = parseCliArguments(process.argv.slice(2));
  const result = await buildOfflineSecurityScenarios({ eventId, inputIdentityPrefix });
  await writeFile(output, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  console.log(`Wrote ${result.scenarios.length} safe security scenario summaries.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
