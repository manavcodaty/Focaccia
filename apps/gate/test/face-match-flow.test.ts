import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';

import {
  canonicalJsonSignature,
  cancelableTemplateV1,
  ed25519Keypair,
  ed25519VerifyDetached,
  fromBase64Url,
  hammingDistance,
  prepareCrypto,
  toBase64Url,
  x25519Keypair,
  type EnrollmentBundle,
} from '@face-pass/shared';

import { assembleSignedPassToken, createPassDraftFromEmbedding } from '../../enrollment/src/lib/pass-flow.ts';
import { verifyFaceAndRecord } from '../src/lib/face-verification.ts';
import { GateRepository } from '../src/lib/gate-db.ts';
import { canonicalCheckinBytes } from '../src/lib/gate-sync.ts';
import { destroyPendingVerification, prepareOfflineVerification } from '../src/lib/offline-verifier.ts';
import type { SqlDriver, SqlRunResult, SqlValue } from '../src/lib/sqlite-port.ts';
import type { StoredGateConfig, VerificationDecision } from '../src/lib/types.ts';

class NodeSqliteDriver implements SqlDriver {
  readonly database: DatabaseSync;

  constructor(database: DatabaseSync) {
    this.database = database;
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
    const result = this.database.prepare(sql).run(...params) as { changes: number };
    return { changes: result.changes };
  }

  async transaction<T>(task: (driver: SqlDriver) => Promise<T>): Promise<T> {
    this.database.exec('begin immediate');
    try {
      const result = await task(this);
      this.database.exec('commit');
      return result;
    } catch (error) {
      this.database.exec('rollback');
      throw error;
    }
  }
}

// Synthetic vectors exercise matching logic; their scores do not establish real FaceNet accuracy.
function seededGaussian(seed: number): () => number {
  let state = seed >>> 0;
  const uniform = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) + 0.5) / 4294967296;
  };
  return () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
}

function unit(vector: number[]): Float32Array {
  const norm = Math.hypot(...vector);
  return Float32Array.from(vector, (value) => value / norm);
}

function randomFace(seed: number): Float32Array {
  const next = seededGaussian(seed);
  return unit(Array.from({ length: 512 }, next));
}

/** A new capture of `face` whose cosine similarity to it is about `similarity`. */
function captureOf(face: Float32Array, similarity: number, seed: number): Float32Array {
  const noise = randomFace(seed);
  const spread = Math.sqrt(1 - similarity * similarity);
  return unit(Array.from(face, (value, index) => similarity * value + spread * noise[index]!));
}

const PERSON_1 = randomFace(1);
const PERSON_2 = randomFace(2);

async function setUpEvent() {
  await prepareCrypto();
  const signingKeys = await ed25519Keypair();
  const syncKeys = await ed25519Keypair();
  const gateKeys = await x25519Keypair();
  const nowIso = new Date().toISOString();
  const bundle: EnrollmentBundle = {
    ends_at: new Date(Date.now() + 3_600_000).toISOString(),
    event_id: 'evt_face_match',
    event_salt: await toBase64Url(Uint8Array.from({ length: 32 }, (_, i) => (i * 29 + 7) & 0xff)),
    pk_gate_event: await toBase64Url(gateKeys.publicKey),
    pk_sign_event: await toBase64Url(signingKeys.publicKey),
    starts_at: new Date(Date.now() - 600_000).toISOString(),
  };
  const gate: StoredGateConfig = {
    ends_at: bundle.ends_at,
    event_id: bundle.event_id,
    event_name: 'Face match flow',
    event_salt: bundle.event_salt,
    gate_device_id: null,
    key_version: 1,
    last_revocation_sync_at: nowIso,
    pk_gate_event: bundle.pk_gate_event,
    pk_sign_event: bundle.pk_sign_event,
    policy: {
      liveness_timeout_ms: 5_000,
      match_threshold: 82,
      queue_code_enabled: false,
      single_entry: true,
      typed_token_fallback: true,
    },
    provisioned_at: nowIso,
    starts_at: bundle.starts_at,
    sync_public_key: await toBase64Url(syncKeys.publicKey),
  };
  const repository = new GateRepository(new NodeSqliteDriver(new DatabaseSync(':memory:')));
  await repository.migrate();
  await repository.saveGateConfig(gate);

  /** Enrollment app + issue-pass function: seal the face template and sign the pass. */
  async function enroll(embedding: Float32Array): Promise<{ passId: string; token: string }> {
    const draft = await createPassDraftFromEmbedding({ bundle, embedding });
    try {
      const signature = await toBase64Url(await canonicalJsonSignature(
        draft.payload as unknown as Record<string, boolean | number | string>,
        signingKeys.privateKey,
      ));
      const { token } = await assembleSignedPassToken({ issueResult: { signature }, payload: draft.payload });
      return { passId: draft.payload.pass_id, token };
    } finally {
      draft.template.fill(0);
    }
  }

  /** Gate app: scan + verify the pass, then one face capture decides entry. */
  async function arriveAtGate(token: string, face: Float32Array): Promise<VerificationDecision> {
    const prepared = await prepareOfflineVerification({
      checkReplay: (passId) => repository.isPassUsed(gate.event_id, passId),
      checkRevoked: (passId) => repository.isPassRevoked(gate.event_id, passId),
      event: gate,
      gatePrivateKey: gateKeys.privateKey,
      token,
    });
    if (!prepared.ok) {
      await repository.insertLog({
        event_id: prepared.decision.event_id,
        hamming_distance: prepared.decision.hammingDistance,
        outcome: prepared.decision.outcome,
        pass_id: prepared.decision.pass_id,
        pass_ref: prepared.decision.pass_ref,
        reason_code: prepared.decision.reasonCode,
        recorded_at: new Date().toISOString(),
        timings: prepared.decision.timings,
      });
      return prepared.decision;
    }
    try {
      return await verifyFaceAndRecord({
        faceCaptureMs: 900,
        liveEmbedding: face,
        loadSyncPrivateKey: async () => syncKeys.privateKey.slice(),
        pending: prepared.pending,
        repository,
      });
    } finally {
      destroyPendingVerification(prepared.pending);
    }
  }

  return { arriveAtGate, enroll, gate, repository, syncKeys };
}

test('the enrolled person is admitted and a different person is rejected on the same pass', async () => {
  const { arriveAtGate, enroll, gate, repository, syncKeys } = await setUpEvent();
  const pass = await enroll(PERSON_1);

  const impostor = await arriveAtGate(pass.token, captureOf(PERSON_2, 0.92, 11));
  assert.equal(impostor.accepted, false);
  assert.equal(impostor.outcome, 'REJECT');
  assert.equal(impostor.reasonCode, 'MATCH_FAIL');
  assert.match(impostor.hint, /does not match the person who enrolled this pass/);
  assert.ok(impostor.hammingDistance! > 80, `impostor distance ${impostor.hammingDistance}`);
  assert.equal(await repository.isPassUsed(gate.event_id, pass.passId), false);
  assert.equal((await repository.listDueSyncItems(new Date(Date.now() + 60_000).toISOString())).length, 0);

  const owner = await arriveAtGate(pass.token, captureOf(PERSON_1, 0.8, 12));
  assert.equal(owner.accepted, true);
  assert.equal(owner.outcome, 'ACCEPT');
  assert.equal(owner.reasonCode, 'ACCEPT');
  assert.ok(owner.hammingDistance! <= 80, `owner distance ${owner.hammingDistance}`);
  assert.equal(owner.timings.liveness_ms, 900);
  assert.equal(await repository.isPassUsed(gate.event_id, pass.passId), true);

  const queued = await repository.listDueSyncItems(new Date(Date.now() + 60_000).toISOString());
  assert.equal(queued.length, 1);
  assert.equal(queued[0]!.pass_id, pass.passId);
  assert.equal(await ed25519VerifyDetached(
    await fromBase64Url(queued[0]!.signature),
    canonicalCheckinBytes({
      decision: queued[0]!.decision,
      event_id: queued[0]!.event_id,
      gate_timestamp: queued[0]!.gate_timestamp,
      idempotency_key: queued[0]!.idempotency_key,
      nonce: queued[0]!.nonce,
      pass_id: queued[0]!.pass_id,
    }),
    syncKeys.publicKey,
  ), true);

  const secondEntry = await arriveAtGate(pass.token, captureOf(PERSON_1, 0.85, 13));
  assert.equal(secondEntry.accepted, false);
  assert.equal(secondEntry.reasonCode, 'REPLAY_USED');

  const reasons = (await repository.listLogs()).map((entry) => entry.reason_code).sort();
  assert.deepEqual(reasons, ['ACCEPT', 'MATCH_FAIL', 'REPLAY_USED']);
});

test('each attendee only matches their own pass', async () => {
  const { arriveAtGate, enroll } = await setUpEvent();
  const pass1 = await enroll(PERSON_1);
  const pass2 = await enroll(PERSON_2);

  assert.equal((await arriveAtGate(pass2.token, captureOf(PERSON_1, 0.9, 21))).reasonCode, 'MATCH_FAIL');
  assert.equal((await arriveAtGate(pass1.token, captureOf(PERSON_2, 0.9, 22))).reasonCode, 'MATCH_FAIL');
  assert.equal((await arriveAtGate(pass1.token, captureOf(PERSON_1, 0.9, 23))).reasonCode, 'ACCEPT');
  assert.equal((await arriveAtGate(pass2.token, captureOf(PERSON_2, 0.9, 24))).reasonCode, 'ACCEPT');
});

test('repeated attempts by other people never unlock the pass, and the owner still can', async () => {
  const { arriveAtGate, enroll } = await setUpEvent();
  const pass = await enroll(PERSON_1);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const otherPerson = captureOf(randomFace(1_000 + attempt), 0.85, 100 + attempt);
    const decision = await arriveAtGate(pass.token, otherPerson);
    assert.equal(decision.reasonCode, 'MATCH_FAIL', `attempt ${attempt} distance ${decision.hammingDistance}`);
  }
  assert.equal((await arriveAtGate(pass.token, captureOf(PERSON_1, 0.75, 200))).reasonCode, 'ACCEPT');
});

test('compare nearby thresholds in two-bit steps on synthetic captures', async (t) => {
  await prepareCrypto();
  const salt = Uint8Array.from({ length: 32 }, (_, index) => index + 1);
  const enrolled = await cancelableTemplateV1(PERSON_1, salt);
  const distances: { owner: number; other: number }[] = [];
  for (let seed = 1; seed <= 24; seed += 1) {
    distances.push({
      owner: hammingDistance(enrolled, await cancelableTemplateV1(captureOf(PERSON_1, 0.6, seed), salt)),
      other: hammingDistance(enrolled, await cancelableTemplateV1(randomFace(2000 + seed), salt)),
    });
  }
  for (const threshold of [78, 80, 82, 84]) {
    const owners = distances.filter((value) => value.owner <= threshold).length;
    const others = distances.filter((value) => value.other <= threshold).length;
    t.diagnostic(`synthetic threshold=${threshold}: owner=${owners}/24 other=${others}/24`);
    assert.equal(others, 0);
  }
});
