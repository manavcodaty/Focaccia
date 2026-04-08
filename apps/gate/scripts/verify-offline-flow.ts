import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';

import {
  cancelableTemplateV1,
  canonicalJsonBytes,
  canonicalJsonStringify,
  ed25519Keypair,
  ed25519SignDetached,
  prepareCrypto,
  toBase64Url,
  x25519Keypair,
  x25519Seal,
  type PassPayload,
} from '@face-pass/shared';

import { GateRepository } from '../src/lib/gate-db.ts';
import {
  decisionToLogEntry,
  destroyPendingVerification,
  finalizeOfflineVerification,
  prepareOfflineVerification,
} from '../src/lib/offline-verifier.ts';
import { parseProvisioningQrPayload } from '../src/lib/provisioning.ts';
import type { SqlDriver, SqlRunResult, SqlValue } from '../src/lib/sqlite-port.ts';
import type { StoredGateConfig } from '../src/lib/types.ts';

class NodeSqliteDriver implements SqlDriver {
  database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
  }

  async close(): Promise<void> {
    this.database.close();
  }

  async exec(sql: string): Promise<void> {
    this.database.exec(sql);
  }

  async getAll<T>(sql: string, params: readonly SqlValue[] = []): Promise<T[]> {
    return this.database.prepare(sql).all(...params) as T[];
  }

  async getFirst<T>(sql: string, params: readonly SqlValue[] = []): Promise<T | null> {
    return (this.database.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  async run(sql: string, params: readonly SqlValue[] = []): Promise<SqlRunResult> {
    const result = this.database.prepare(sql).run(...params) as { changes?: number };
    return { changes: result.changes ?? 0 };
  }
}

function mockEmbedding(dimensions = 512): Float32Array {
  return Float32Array.from(
    { length: dimensions },
    (_, index) => Math.sin(index * 0.37) * 0.6 + Math.cos(index * 0.11) * 0.4,
  );
}

function secureRandomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);

  crypto.getRandomValues(bytes);
  return bytes;
}

async function buildSignedToken({
  embedding,
  eventId,
  eventSalt,
  gatePublicKey,
  nowUnix,
  passId,
  signingPrivateKey,
}: {
  embedding: ArrayLike<number>;
  eventId: string;
  eventSalt: Uint8Array;
  gatePublicKey: Uint8Array;
  nowUnix: number;
  passId: string;
  signingPrivateKey: Uint8Array;
}): Promise<{ payload: PassPayload; token: string }> {
  const template = await cancelableTemplateV1(embedding, eventSalt);

  try {
    const encryptedTemplate = await x25519Seal(template, gatePublicKey);

    try {
      const payload: PassPayload = {
        enc_template: await toBase64Url(encryptedTemplate),
        event_id: eventId,
        exp: nowUnix + 3600,
        iat: nowUnix - 30,
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
        const token = `${await toBase64Url(payloadBytes)}.${await toBase64Url(signature)}`;

        return { payload, token };
      } finally {
        signature.fill(0);
      }
    } finally {
      encryptedTemplate.fill(0);
    }
  } finally {
    template.fill(0);
  }
}

async function main(): Promise<void> {
  await prepareCrypto();

  const database = new DatabaseSync(':memory:');
  const repository = new GateRepository(new NodeSqliteDriver(database));

  await repository.migrate();

  const eventId = 'evt_gate_offline_demo';
  const nowUnix = Math.floor(Date.now() / 1000);
  const eventSalt = secureRandomBytes(32);
  const signingKeys = await ed25519Keypair();
  const gateKeys = await x25519Keypair();
  const provisioningQr = canonicalJsonStringify({
    ends_at: new Date((nowUnix + 7200) * 1000).toISOString(),
    event_id: eventId,
    event_salt: await toBase64Url(eventSalt),
    issued_at: new Date(nowUnix * 1000).toISOString(),
    kind: 'gate-provisioning',
    name: 'Offline Gate Verification',
    pk_sign_event: await toBase64Url(signingKeys.publicKey),
    starts_at: new Date((nowUnix - 300) * 1000).toISOString(),
    v: 1,
  });
  const provisioningPayload = parseProvisioningQrPayload(provisioningQr);
  const storedGate: StoredGateConfig = {
    ends_at: provisioningPayload.ends_at,
    event_id: provisioningPayload.event_id,
    event_name: provisioningPayload.name,
    event_salt: provisioningPayload.event_salt,
    last_revocation_sync_at: null,
    pk_gate_event: await toBase64Url(gateKeys.publicKey),
    pk_sign_event: provisioningPayload.pk_sign_event,
    policy: {
      liveness_timeout_ms: 5000,
      match_threshold: 80,
      queue_code_enabled: true,
      queue_code_digits: 8,
      single_entry: true,
      typed_token_fallback: true,
    },
    provisioned_at: new Date().toISOString(),
    starts_at: provisioningPayload.starts_at,
  };

  await repository.saveGateConfig(storedGate);

  const enrolledEmbedding = mockEmbedding();
  const firstPassId = await toBase64Url(secureRandomBytes(16));
  const firstToken = await buildSignedToken({
    embedding: enrolledEmbedding,
    eventId,
    eventSalt,
    gatePublicKey: gateKeys.publicKey,
    nowUnix,
    passId: firstPassId,
    signingPrivateKey: signingKeys.privateKey,
  });
  const firstPrepared = await prepareOfflineVerification({
    checkReplay: (passId) => repository.isPassUsed(eventId, passId),
    checkRevoked: (passId) => repository.isPassRevoked(eventId, passId),
    event: storedGate,
    gatePrivateKey: gateKeys.privateKey,
    scanStartedAtMs: Date.now() - 42,
    token: firstToken.token,
  });

  assert.equal(firstPrepared.ok, true, 'first token should survive offline checks');

  if (!firstPrepared.ok) {
    throw new Error('Expected the first verification to reach the liveness stage.');
  }

  const acceptedDecision = await finalizeOfflineVerification({
    liveEmbedding: mockEmbedding(),
    livenessMs: 240,
    pending: firstPrepared.pending,
  });

  assert.equal(acceptedDecision.accepted, true, 'matching embedding should accept');
  assert.equal(acceptedDecision.reasonCode, 'ACCEPT');
  assert.equal(acceptedDecision.hammingDistance, 0, 'same embedding should produce identical template');
  await repository.markPassUsed(eventId, firstPassId, new Date().toISOString());
  await repository.insertLog(decisionToLogEntry(acceptedDecision));
  destroyPendingVerification(firstPrepared.pending);

  const replayPrepared = await prepareOfflineVerification({
    checkReplay: (passId) => repository.isPassUsed(eventId, passId),
    checkRevoked: (passId) => repository.isPassRevoked(eventId, passId),
    event: storedGate,
    gatePrivateKey: gateKeys.privateKey,
    scanStartedAtMs: Date.now() - 18,
    token: firstToken.token,
  });

  assert.equal(replayPrepared.ok, false, 'second use should reject as replay');

  if (replayPrepared.ok) {
    throw new Error('Replay path unexpectedly reached liveness.');
  }

  assert.equal(replayPrepared.decision.reasonCode, 'REPLAY_USED');
  await repository.insertLog(decisionToLogEntry(replayPrepared.decision));

  const revokedPassId = await toBase64Url(secureRandomBytes(16));
  const revokedToken = await buildSignedToken({
    embedding: enrolledEmbedding,
    eventId,
    eventSalt,
    gatePublicKey: gateKeys.publicKey,
    nowUnix,
    passId: revokedPassId,
    signingPrivateKey: signingKeys.privateKey,
  });

  await repository.replaceRevocations(
    eventId,
    [
      {
        pass_id: revokedPassId,
        revoked_at: new Date().toISOString(),
      },
    ],
    new Date().toISOString(),
  );

  const revokedPrepared = await prepareOfflineVerification({
    checkReplay: (passId) => repository.isPassUsed(eventId, passId),
    checkRevoked: (passId) => repository.isPassRevoked(eventId, passId),
    event: storedGate,
    gatePrivateKey: gateKeys.privateKey,
    scanStartedAtMs: Date.now() - 14,
    token: revokedToken.token,
  });

  assert.equal(revokedPrepared.ok, false, 'revoked pass should reject before liveness');

  if (revokedPrepared.ok) {
    throw new Error('Revoked pass unexpectedly reached liveness.');
  }

  assert.equal(revokedPrepared.decision.reasonCode, 'REVOKED');
  await repository.insertLog(decisionToLogEntry(revokedPrepared.decision));

  const stats = await repository.getStats();

  assert.equal(stats.usedPassCount, 1);
  assert.equal(stats.revocationCount, 1);
  assert.equal(stats.logCount, 3);

  const csv = await repository.exportLogsCsv();

  assert.match(csv, /ACCEPT/);
  assert.match(csv, /REPLAY_USED/);
  assert.match(csv, /REVOKED/);

  console.log('offline gate verification passed');
  console.log(`event_id=${eventId}`);
  console.log(`accepted_pass_id=${firstPassId}`);
  console.log(`csv_lines=${csv.split('\n').length}`);

  await repository.close();
  eventSalt.fill(0);
  signingKeys.privateKey.fill(0);
  signingKeys.publicKey.fill(0);
  gateKeys.privateKey.fill(0);
  gateKeys.publicKey.fill(0);
  enrolledEmbedding.fill(0);
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
