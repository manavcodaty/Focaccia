import type { EnrollmentBundle, GateBundle, PassPayload } from './face-pass-shared.ts';

export interface EventRecord {
  created_by: string;
  ends_at: string;
  event_id: string;
  event_salt: string;
  join_code: string;
  name: string;
  pk_gate_event: string | null;
  pk_sign_event: string;
  starts_at: string;
}

export interface SecretRecord {
  event_id: string;
  k_code_event_ciphertext: string | null;
  sk_sign_event_ciphertext: string;
}

export interface CreateEventRequest {
  event_id: string;
  name: string;
  starts_at: string;
  ends_at: string;
}

export interface CreateEventResponse {
  ends_at: string;
  event_id: string;
  event_salt: string;
  join_code: string;
  pk_sign_event: string;
  starts_at: string;
}

export interface ProvisionGateRequest {
  device_name?: string;
  event_id: string;
  pk_gate_event: string;
}

export interface ProvisionGateResponse extends GateBundle {}

export interface EnrollmentBundleResponse extends EnrollmentBundle {}

export interface IssuePassRequest {
  payload: PassPayload;
}

export interface IssuePassResponse {
  queue_code?: string;
  signature: string;
}

export interface RevokePassRequest {
  event_id: string;
  pass_id: string;
}
