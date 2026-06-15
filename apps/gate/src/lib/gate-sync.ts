import {
  canonicalJsonBytes,
  ed25519SignDetached,
  randomBytes,
  toBase64Url,
  type CanonicalJsonValue,
} from '@face-pass/shared';

import type {
  GateCheckinPayload,
  GateRevocationRequestPayload,
  SignedGateCheckin,
  SignedGateRevocationRequest,
} from './types.ts';

const RETRY_DELAYS_MS = [5_000, 15_000, 60_000, 300_000, 900_000] as const;
const FRESH_MS = 5 * 60 * 1000;
const CRITICAL_MS = 30 * 60 * 1000;

export type RevocationCacheState = 'critical' | 'fresh' | 'stale';
export type SyncFailureDisposition = 'blocked' | 'retry';

function uuidV4(bytes: Uint8Array): string {
  if (bytes.length !== 16) throw new RangeError('UUID entropy must contain 16 bytes.');
  const value = Uint8Array.from(bytes);
  value[6] = ((value[6] ?? 0) & 0x0f) | 0x40;
  value[8] = ((value[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(value, (byte) => byte.toString(16).padStart(2, '0')).join('');
  value.fill(0);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function canonicalCheckinBytes(value: GateCheckinPayload): Uint8Array {
  return canonicalJsonBytes({
    decision: value.decision,
    event_id: value.event_id,
    gate_timestamp: value.gate_timestamp,
    idempotency_key: value.idempotency_key,
    nonce: value.nonce,
    pass_id: value.pass_id,
  } satisfies CanonicalJsonValue);
}

export function canonicalRevocationRequestBytes(
  value: GateRevocationRequestPayload,
): Uint8Array {
  return canonicalJsonBytes({
    event_id: value.event_id,
    gate_timestamp: value.gate_timestamp,
    idempotency_key: value.idempotency_key,
    key_version: value.key_version,
    nonce: value.nonce,
  } satisfies CanonicalJsonValue);
}

async function requestIdentity(
  nonceBytes?: Uint8Array,
  idempotencyKey?: string,
): Promise<{ idempotencyKey: string; nonce: string }> {
  const generatedNonce = nonceBytes ?? await randomBytes(16);
  const generatedUuid = idempotencyKey ? null : await randomBytes(16);

  try {
    return {
      idempotencyKey: idempotencyKey ?? uuidV4(generatedUuid!),
      nonce: await toBase64Url(generatedNonce),
    };
  } finally {
    if (!nonceBytes) generatedNonce.fill(0);
    generatedUuid?.fill(0);
  }
}

export async function createSignedCheckin({
  eventId,
  gateTimestamp,
  idempotencyKey,
  nonceBytes,
  passId,
  privateKey,
}: {
  eventId: string;
  gateTimestamp: string;
  idempotencyKey?: string;
  nonceBytes?: Uint8Array;
  passId: string;
  privateKey: Uint8Array;
}): Promise<SignedGateCheckin> {
  const identity = await requestIdentity(nonceBytes, idempotencyKey);
  const payload: GateCheckinPayload = {
    decision: 'ACCEPT',
    event_id: eventId,
    gate_timestamp: gateTimestamp,
    idempotency_key: identity.idempotencyKey,
    nonce: identity.nonce,
    pass_id: passId,
  };
  const signature = await ed25519SignDetached(canonicalCheckinBytes(payload), privateKey);

  try {
    return { ...payload, signature: await toBase64Url(signature) };
  } finally {
    signature.fill(0);
  }
}

export async function createSignedRevocationRequest({
  eventId,
  gateTimestamp,
  idempotencyKey,
  keyVersion,
  nonceBytes,
  privateKey,
}: {
  eventId: string;
  gateTimestamp: string;
  idempotencyKey?: string;
  keyVersion: number;
  nonceBytes?: Uint8Array;
  privateKey: Uint8Array;
}): Promise<SignedGateRevocationRequest> {
  const identity = await requestIdentity(nonceBytes, idempotencyKey);
  const payload: GateRevocationRequestPayload = {
    event_id: eventId,
    gate_timestamp: gateTimestamp,
    idempotency_key: identity.idempotencyKey,
    key_version: keyVersion,
    nonce: identity.nonce,
  };
  const signature = await ed25519SignDetached(
    canonicalRevocationRequestBytes(payload),
    privateKey,
  );

  try {
    return { ...payload, signature: await toBase64Url(signature) };
  } finally {
    signature.fill(0);
  }
}

export function nextRetryDelayMs(attemptCount: number, jitter = Math.random() * 2 - 1): number {
  const index = Math.min(Math.max(0, Math.trunc(attemptCount)), RETRY_DELAYS_MS.length - 1);
  const base = RETRY_DELAYS_MS[index] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]!;
  const boundedJitter = Math.max(-1, Math.min(1, jitter));
  return Math.round(base * (1 + boundedJitter * 0.2));
}

export function syncFailureDisposition(error: {
  code: string;
  status: number;
}): SyncFailureDisposition {
  if (error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500) {
    return 'retry';
  }
  return 'blocked';
}

export function cacheFreshness(
  lastSyncAt: string | null,
  nowMs = Date.now(),
): { ageMs: number | null; state: RevocationCacheState } {
  if (!lastSyncAt) return { ageMs: null, state: 'critical' };
  const timestamp = Date.parse(lastSyncAt);
  if (!Number.isFinite(timestamp)) return { ageMs: null, state: 'critical' };
  const ageMs = Math.max(0, nowMs - timestamp);
  if (ageMs <= FRESH_MS) return { ageMs, state: 'fresh' };
  if (ageMs <= CRITICAL_MS) return { ageMs, state: 'stale' };
  return { ageMs, state: 'critical' };
}

export function formatCacheAge(ageMs: number | null): string {
  if (ageMs === null) return 'Never refreshed';
  if (ageMs < 60_000) return 'Less than 1 minute old';
  const minutes = Math.floor(ageMs / 60_000);
  return `${minutes} minute${minutes === 1 ? '' : 's'} old`;
}
