import type { EnrollmentBundle, GateBundle, PassPayload } from './face-pass-shared.ts';

export interface EventRecord {
  capacity: number;
  created_by: string;
  deleted_at: string | null;
  description: string;
  ends_at: string;
  event_id: string;
  event_salt: string;
  is_listed: boolean;
  location: string;
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
  capacity: number;
  description: string;
  event_id: string;
  is_listed: boolean;
  location: string;
  name: string;
  starts_at: string;
  ends_at: string;
}

export interface CreateEventResponse {
  capacity: number;
  ends_at: string;
  event_id: string;
  event_salt: string;
  pk_sign_event: string;
  starts_at: string;
}

export interface DeleteEventRequest {
  event_id: string;
}

export interface DeleteEventResponse {
  event_id: string;
}

export interface ProvisionGateRequest {
  device_name?: string;
  event_id: string;
  pk_gate_event: string;
  sync_public_key: string;
}

export interface ProvisionGateResponse extends GateBundle {}

export interface EnrollmentBundleResponse extends EnrollmentBundle {}

export interface IssuePassRequest {
  payload: PassPayload;
  ticket_id: string;
}

export interface IssuePassResponse {
  queue_code?: string;
  signature: string;
}

export interface RevokePassRequest {
  event_id: string;
  pass_id: string;
}
