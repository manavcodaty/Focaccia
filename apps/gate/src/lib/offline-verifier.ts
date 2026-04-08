import {
  blake2b,
  cancelableTemplateV1,
  canonicalJsonBytes,
  ed25519VerifyDetached,
  fromBase64Url,
  hammingDistance,
  toBase64Url,
  x25519SealOpen,
  type PassPayload,
} from '@face-pass/shared';

import {
  createEmptyTimings,
  type GateLogEntry,
  type GateReasonCode,
  type PendingVerification,
  type StageTimings,
  type StoredGateConfig,
  type VerificationDecision,
} from './types.ts';

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const MAX_TOKEN_LENGTH = 4096;
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function unixSeconds(value: Date | string): number {
  const milliseconds = value instanceof Date ? value.getTime() : new Date(value).getTime();

  if (!Number.isFinite(milliseconds)) {
    throw new Error('Expected a valid timestamp.');
  }

  return Math.floor(milliseconds / 1000);
}

function roundDuration(value: number): number {
  return Math.max(0, Math.round(value));
}

function withTotal(timings: StageTimings): StageTimings {
  const total = timings.scan_ms
    + timings.decode_ms
    + timings.verify_ms
    + timings.replay_ms
    + timings.revocation_ms
    + timings.decrypt_ms
    + timings.liveness_ms
    + timings.match_ms;

  return {
    ...timings,
    total_ms: total,
  };
}

function decisionHint(code: GateReasonCode): string {
  switch (code) {
    case 'ACCEPT':
      return 'Pass accepted. Entry recorded locally.';
    case 'BAD_TOKEN':
      return 'The QR payload could not be decoded. Ask the attendee to reopen the pass.';
    case 'BAD_SIGNATURE':
      return 'Signature check failed. This pass was not issued by the event signer.';
    case 'WRONG_EVENT':
      return 'This pass belongs to a different event.';
    case 'NOT_YET_VALID':
      return 'This pass is not active yet.';
    case 'EXPIRED':
      return 'The pass has expired for this event.';
    case 'REPLAY_USED':
      return 'This pass has already been accepted on this gate.';
    case 'REVOKED':
      return 'This pass was revoked during the organizer sync.';
    case 'DECRYPT_FAIL':
      return 'The encrypted template could not be opened on this gate.';
    case 'LIVENESS_FAIL':
      return 'The active liveness challenge was not completed in time.';
    case 'MATCH_FAIL':
      return 'Live face comparison failed the event threshold.';
    case 'MANUAL_OVERRIDE':
      return 'Manual override was used. Review the queue manually.';
    case 'SYSTEM_ERROR':
      return 'The gate hit a local verification error. Retry or switch to fallback handling.';
  }
}

function isPassPayload(value: unknown): value is PassPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const payload = value as Partial<PassPayload>;
  return payload.v === 1 && typeof payload.event_id === 'string';
}

function validatePassPayload(payload: PassPayload): void {
  if (payload.v !== 1) {
    throw new Error('payload.v must be 1.');
  }

  if (!payload.event_id.trim()) {
    throw new Error('payload.event_id is required.');
  }

  if (!payload.single_use) {
    throw new Error('payload.single_use must be true.');
  }

  if (
    !BASE64URL_PATTERN.test(payload.pass_id)
    || !BASE64URL_PATTERN.test(payload.nonce)
    || !BASE64URL_PATTERN.test(payload.enc_template)
  ) {
    throw new Error('payload.pass_id, payload.nonce, and payload.enc_template must be base64url.');
  }

  if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) {
    throw new Error('payload.iat and payload.exp must be integers.');
  }
}

async function passReference(passId: string): Promise<string> {
  const digest = await blake2b(textEncoder.encode(passId), 8);
  return toBase64Url(digest);
}

function buildDecision({
  eventId,
  hammingDistanceValue = null,
  passId = null,
  passRef = null,
  reasonCode,
  timings,
}: {
  eventId: string;
  hammingDistanceValue?: number | null;
  passId?: string | null;
  passRef?: string | null;
  reasonCode: GateReasonCode;
  timings: StageTimings;
}): VerificationDecision {
  return {
    accepted: reasonCode === 'ACCEPT',
    event_id: eventId,
    hammingDistance: hammingDistanceValue,
    hint: decisionHint(reasonCode),
    outcome: reasonCode === 'ACCEPT' ? 'ACCEPT' : 'REJECT',
    pass_id: passId,
    pass_ref: passRef,
    reasonCode,
    timings: withTotal(timings),
  };
}

function buildRejectedDecision(
  gate: StoredGateConfig,
  reasonCode: GateReasonCode,
  timings: StageTimings,
  passId: string | null = null,
  passRef: string | null = null,
): VerificationDecision {
  return buildDecision({
    eventId: gate.event_id,
    passId,
    passRef,
    reasonCode,
    timings,
  });
}

export interface PrepareOfflineVerificationInput {
  checkReplay(passId: string): Promise<boolean>;
  checkRevoked(passId: string): Promise<boolean>;
  event: StoredGateConfig;
  gatePrivateKey: Uint8Array;
  now?: Date;
  scanStartedAtMs?: number;
  token: string;
}

export type PreparedOfflineVerification =
  | {
      decision: VerificationDecision;
      ok: false;
    }
  | {
      ok: true;
      pending: PendingVerification;
    };

async function decodeToken(token: string): Promise<{
  payload: PassPayload;
  payloadBytes: Uint8Array;
  signatureBytes: Uint8Array;
}> {
  if (token.length > MAX_TOKEN_LENGTH) {
    throw new Error('Token exceeds the maximum supported length.');
  }

  const parts = token.trim().split('.');

  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error('Token must contain exactly one payload and one signature segment.');
  }

  const [payloadBytes, signatureBytes] = await Promise.all([
    fromBase64Url(parts[0]),
    fromBase64Url(parts[1]),
  ]);
  const parsedPayload = JSON.parse(textDecoder.decode(payloadBytes)) as unknown;

  if (!isPassPayload(parsedPayload)) {
    throw new Error('Payload was not a valid pass object.');
  }

  validatePassPayload(parsedPayload);

  const canonicalBytes = canonicalJsonBytes(
    parsedPayload as unknown as Record<string, boolean | number | string>,
  );

  if (canonicalBytes.length !== payloadBytes.length) {
    throw new Error('Payload was not encoded as canonical JSON.');
  }

  for (let index = 0; index < canonicalBytes.length; index += 1) {
    if (canonicalBytes[index] !== payloadBytes[index]) {
      throw new Error('Payload was not encoded as canonical JSON.');
    }
  }

  return {
    payload: parsedPayload,
    payloadBytes,
    signatureBytes,
  };
}

export async function prepareOfflineVerification({
  checkReplay,
  checkRevoked,
  event,
  gatePrivateKey,
  now = new Date(),
  scanStartedAtMs = nowMs(),
  token,
}: PrepareOfflineVerificationInput): Promise<PreparedOfflineVerification> {
  const timings = createEmptyTimings(roundDuration(nowMs() - scanStartedAtMs));
  let payload: PassPayload | null = null;
  let payloadBytes: Uint8Array | null = null;
  let signatureBytes: Uint8Array | null = null;
  let passRef: string | null = null;

  try {
    const decodeStartedAt = nowMs();

    try {
      const decoded = await decodeToken(token);

      payload = decoded.payload;
      payloadBytes = decoded.payloadBytes;
      signatureBytes = decoded.signatureBytes;
      passRef = await passReference(payload.pass_id);
    } catch {
      timings.decode_ms = roundDuration(nowMs() - decodeStartedAt);
      return {
        decision: buildRejectedDecision(event, 'BAD_TOKEN', timings),
        ok: false,
      };
    }

    timings.decode_ms = roundDuration(nowMs() - decodeStartedAt);

    const verifyStartedAt = nowMs();
    const signerPublicKey = await fromBase64Url(event.pk_sign_event);
    const verified = await ed25519VerifyDetached(signatureBytes, payloadBytes, signerPublicKey);
    timings.verify_ms = roundDuration(nowMs() - verifyStartedAt);
    signerPublicKey.fill(0);

    if (!verified) {
      return {
        decision: buildRejectedDecision(
          event,
          'BAD_SIGNATURE',
          timings,
          payload.pass_id,
          passRef,
        ),
        ok: false,
      };
    }

    if (payload.event_id !== event.event_id) {
      return {
        decision: buildRejectedDecision(event, 'WRONG_EVENT', timings, payload.pass_id, passRef),
        ok: false,
      };
    }

    const nowUnix = unixSeconds(now);

    if (nowUnix < payload.iat) {
      return {
        decision: buildRejectedDecision(event, 'NOT_YET_VALID', timings, payload.pass_id, passRef),
        ok: false,
      };
    }

    if (nowUnix > payload.exp) {
      return {
        decision: buildRejectedDecision(event, 'EXPIRED', timings, payload.pass_id, passRef),
        ok: false,
      };
    }

    const replayStartedAt = nowMs();
    const alreadyUsed = await checkReplay(payload.pass_id);
    timings.replay_ms = roundDuration(nowMs() - replayStartedAt);

    if (alreadyUsed) {
      return {
        decision: buildRejectedDecision(event, 'REPLAY_USED', timings, payload.pass_id, passRef),
        ok: false,
      };
    }

    const revocationStartedAt = nowMs();
    const isRevoked = await checkRevoked(payload.pass_id);
    timings.revocation_ms = roundDuration(nowMs() - revocationStartedAt);

    if (isRevoked) {
      return {
        decision: buildRejectedDecision(event, 'REVOKED', timings, payload.pass_id, passRef),
        ok: false,
      };
    }

    const decryptStartedAt = nowMs();

    try {
      const [gatePublicKey, encryptedTemplate] = await Promise.all([
        fromBase64Url(event.pk_gate_event),
        fromBase64Url(payload.enc_template),
      ]);
      const decryptedTemplate = await x25519SealOpen(
        encryptedTemplate,
        gatePublicKey,
        gatePrivateKey,
      );

      encryptedTemplate.fill(0);
      gatePublicKey.fill(0);
      timings.decrypt_ms = roundDuration(nowMs() - decryptStartedAt);

      return {
        ok: true,
        pending: {
          decryptedTemplate,
          event,
          passRef,
          payload,
          timings: {
            decode_ms: timings.decode_ms,
            decrypt_ms: timings.decrypt_ms,
            replay_ms: timings.replay_ms,
            revocation_ms: timings.revocation_ms,
            scan_ms: timings.scan_ms,
            verify_ms: timings.verify_ms,
          },
          token,
        },
      };
    } catch {
      timings.decrypt_ms = roundDuration(nowMs() - decryptStartedAt);
      return {
        decision: buildRejectedDecision(event, 'DECRYPT_FAIL', timings, payload.pass_id, passRef),
        ok: false,
      };
    }
  } finally {
    payloadBytes?.fill(0);
    signatureBytes?.fill(0);
  }
}

export async function finalizeOfflineVerification({
  liveEmbedding,
  livenessMs,
  pending,
}: {
  liveEmbedding: ArrayLike<number>;
  livenessMs: number;
  pending: PendingVerification;
}): Promise<VerificationDecision> {
  const timings: StageTimings = {
    decode_ms: pending.timings.decode_ms,
    decrypt_ms: pending.timings.decrypt_ms,
    liveness_ms: Math.max(0, Math.round(livenessMs)),
    match_ms: 0,
    replay_ms: pending.timings.replay_ms,
    revocation_ms: pending.timings.revocation_ms,
    scan_ms: pending.timings.scan_ms,
    total_ms: 0,
    verify_ms: pending.timings.verify_ms,
  };
  const matchStartedAt = nowMs();
  const eventSalt = await fromBase64Url(pending.event.event_salt);
  const liveTemplate = await cancelableTemplateV1(liveEmbedding, eventSalt);

  try {
    const distance = hammingDistance(pending.decryptedTemplate, liveTemplate);
    timings.match_ms = roundDuration(nowMs() - matchStartedAt);

    return buildDecision({
      eventId: pending.event.event_id,
      hammingDistanceValue: distance,
      passId: pending.payload.pass_id,
      passRef: pending.passRef,
      reasonCode:
        distance <= pending.event.policy.match_threshold ? 'ACCEPT' : 'MATCH_FAIL',
      timings,
    });
  } finally {
    eventSalt.fill(0);
    liveTemplate.fill(0);
  }
}

export function recordLivenessFailure(
  pending: PendingVerification,
  livenessMs: number,
): VerificationDecision {
  return buildDecision({
    eventId: pending.event.event_id,
    passId: pending.payload.pass_id,
    passRef: pending.passRef,
    reasonCode: 'LIVENESS_FAIL',
    timings: {
      decode_ms: pending.timings.decode_ms,
      decrypt_ms: pending.timings.decrypt_ms,
      liveness_ms: Math.max(0, Math.round(livenessMs)),
      match_ms: 0,
      replay_ms: pending.timings.replay_ms,
      revocation_ms: pending.timings.revocation_ms,
      scan_ms: pending.timings.scan_ms,
      total_ms: 0,
      verify_ms: pending.timings.verify_ms,
    },
  });
}

export function destroyPendingVerification(pending: PendingVerification | null): void {
  pending?.decryptedTemplate.fill(0);
}

export function decisionToLogEntry(
  decision: VerificationDecision,
  recordedAtIso = new Date().toISOString(),
): GateLogEntry {
  return {
    event_id: decision.event_id,
    hamming_distance: decision.hammingDistance,
    outcome: decision.outcome,
    pass_id: decision.pass_id,
    pass_ref: decision.pass_ref,
    reason_code: decision.reasonCode,
    recorded_at: recordedAtIso,
    timings: decision.timings,
  };
}
