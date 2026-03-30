export interface EventRecord {
  created_at: string;
  ends_at: string;
  event_id: string;
  event_salt: string;
  join_code: string;
  name: string;
  pk_gate_event: string | null;
  pk_sign_event: string;
  starts_at: string;
}

export interface RevocationRecord {
  event_id: string;
  pass_id: string;
  revoked_at: string;
}

export interface GateLogRecord {
  csv_url: string | null;
  event_id: string;
  id: string;
  uploaded_at: string;
}

export interface DashboardEventSummary extends EventRecord {
  logCount: number;
  revocationCount: number;
}

export interface CreateEventResult {
  ends_at: string;
  event_id: string;
  event_salt: string;
  join_code: string;
  pk_sign_event: string;
  starts_at: string;
}

export interface ProvisioningPayload {
  ends_at: string;
  event_id: string;
  event_salt: string;
  issued_at: string;
  kind: "gate-provisioning";
  name: string;
  pk_gate_event?: string;
  pk_sign_event: string;
  starts_at: string;
  v: 1;
}
