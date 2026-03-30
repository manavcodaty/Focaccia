import type { EventPolicyConfig, GateBundle, PassPayload } from '@face-pass/shared';

export type GateReasonCode =
  | 'ACCEPT'
  | 'BAD_TOKEN'
  | 'BAD_SIGNATURE'
  | 'WRONG_EVENT'
  | 'NOT_YET_VALID'
  | 'EXPIRED'
  | 'REPLAY_USED'
  | 'REVOKED'
  | 'DECRYPT_FAIL'
  | 'LIVENESS_FAIL'
  | 'MATCH_FAIL'
  | 'MANUAL_OVERRIDE'
  | 'SYSTEM_ERROR';

export type GateOutcome = 'ACCEPT' | 'REJECT';

export type LivenessChallengeType = 'blink-twice' | 'look-up' | 'turn-left';

export interface OrganizerAuthState {
  accessToken: string;
  email: string;
  userId: string;
}

export interface ProvisioningQrPayload {
  event_id: string;
  event_salt: string;
  issued_at: string;
  kind: 'gate-provisioning';
  name: string;
  pk_gate_event?: string;
  pk_sign_event: string;
  starts_at: string;
  ends_at: string;
  v: 1;
}

export interface StoredGateConfig extends GateBundle {
  event_name: string;
  last_revocation_sync_at: string | null;
  provisioned_at: string;
}

export interface FacePoint {
  x: number;
  y: number;
}

export interface FaceBounds {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface FaceSnapshot {
  bounds: FaceBounds;
  faceCount: number;
  frameHeight: number;
  frameWidth: number;
  leftEye: FacePoint;
  leftEyeOpenProbability: number | null;
  pitchAngle: number;
  rightEye: FacePoint;
  rightEyeOpenProbability: number | null;
  rollAngle: number;
  trackedAt: number;
  yawAngle: number;
}

export interface StageTimings {
  decode_ms: number;
  decrypt_ms: number;
  liveness_ms: number;
  match_ms: number;
  replay_ms: number;
  revocation_ms: number;
  scan_ms: number;
  total_ms: number;
  verify_ms: number;
}

export interface PendingVerification {
  decryptedTemplate: Uint8Array;
  event: StoredGateConfig;
  passRef: string;
  payload: PassPayload;
  timings: Omit<StageTimings, 'liveness_ms' | 'match_ms' | 'total_ms'>;
  token: string;
}

export interface VerificationDecision {
  accepted: boolean;
  event_id: string;
  hammingDistance: number | null;
  hint: string;
  outcome: GateOutcome;
  pass_id: string | null;
  pass_ref: string | null;
  reasonCode: GateReasonCode;
  timings: StageTimings;
}

export interface GateLogEntry {
  event_id: string;
  hamming_distance: number | null;
  outcome: GateOutcome;
  pass_id: string | null;
  pass_ref: string | null;
  reason_code: GateReasonCode;
  recorded_at: string;
  timings: StageTimings;
}

export interface GateLogRow {
  decode_ms: number;
  decrypt_ms: number;
  id: number;
  event_id: string;
  hamming_distance: number | null;
  liveness_ms: number;
  match_ms: number;
  outcome: GateOutcome;
  pass_id: string | null;
  pass_ref: string | null;
  reason_code: GateReasonCode;
  recorded_at: string;
  replay_ms: number;
  revocation_ms: number;
  scan_ms: number;
  total_ms: number;
  verify_ms: number;
}

export interface GateStats {
  lastRecordedAt: string | null;
  logCount: number;
  revocationCount: number;
  usedPassCount: number;
}

export interface GateConfigRow {
  ends_at: string;
  event_id: string;
  event_name: string;
  event_salt: string;
  k_code_event: string | null;
  last_revocation_sync_at: string | null;
  liveness_timeout_ms: number;
  match_threshold: number;
  pk_gate_event: string;
  pk_sign_event: string;
  provisioned_at: string;
  queue_code_digits: number | null;
  queue_code_enabled: number;
  single_entry: number;
  starts_at: string;
  typed_token_fallback: number;
}

export function configRowToStoredGateConfig(row: GateConfigRow): StoredGateConfig {
  const policy: EventPolicyConfig = {
    liveness_timeout_ms: row.liveness_timeout_ms,
    match_threshold: row.match_threshold,
    queue_code_enabled: row.queue_code_enabled === 1,
    single_entry: true,
    typed_token_fallback: true,
  };

  if (row.queue_code_digits !== null) {
    policy.queue_code_digits = row.queue_code_digits;
  }

  const config: StoredGateConfig = {
    ends_at: row.ends_at,
    event_id: row.event_id,
    event_name: row.event_name,
    event_salt: row.event_salt,
    last_revocation_sync_at: row.last_revocation_sync_at,
    pk_gate_event: row.pk_gate_event,
    pk_sign_event: row.pk_sign_event,
    policy,
    provisioned_at: row.provisioned_at,
    starts_at: row.starts_at,
  };

  if (row.k_code_event) {
    config.k_code_event = row.k_code_event;
  }

  return config;
}

export function createEmptyTimings(scanMs = 0): StageTimings {
  return {
    decode_ms: 0,
    decrypt_ms: 0,
    liveness_ms: 0,
    match_ms: 0,
    replay_ms: 0,
    revocation_ms: 0,
    scan_ms: scanMs,
    total_ms: scanMs,
    verify_ms: 0,
  };
}
