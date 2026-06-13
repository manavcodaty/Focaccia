export type TicketStatus = "claimed" | "enrolled" | "checked_in" | "cancelled" | "revoked";

export interface EventRecord {
  capacity: number;
  created_at: string;
  description: string;
  ends_at: string;
  event_id: string;
  event_salt: string;
  is_listed: boolean;
  join_code: string;
  location: string;
  name: string;
  pk_gate_event: string | null;
  pk_sign_event: string;
  starts_at: string;
  updated_at: string;
}

export interface RevocationRecord {
  event_id: string;
  id?: string;
  pass_id: string;
  reason?: string | null;
  revoked_at: string;
  ticket_id?: string | null;
}

export interface GateLogRecord {
  csv_url: string | null;
  event_id: string;
  id: string;
  uploaded_at: string;
}

export interface TicketStatusCounts {
  cancelled: number;
  checked_in: number;
  claimed: number;
  enrolled: number;
  revoked: number;
}

export interface DashboardEventSummary extends EventRecord {
  gateLastSeenAt: string | null;
  logCount: number;
  revocationCount: number;
  ticketCounts: TicketStatusCounts;
}

export interface EventTicketType {
  capacity: number | null;
  created_at: string;
  currency: "GBP";
  description: string;
  id: string;
  is_active: boolean;
  is_default: boolean;
  name: string;
  price_pence: number;
  sort_order: number;
  updated_at: string;
}

export interface OrganizerTicket {
  attendee_email: string;
  attendee_name: string;
  attendee_user_id: string;
  cancelled_at: string | null;
  checked_in_at: string | null;
  claim_code_hint: string;
  claimed_at: string;
  created_at: string;
  current_pass_id: string | null;
  enrolled_at: string | null;
  generation_count: number;
  id: string;
  revoked_at: string | null;
  status: TicketStatus;
  ticket_type_id: string;
  ticket_type_name: string;
  ticket_type_price_pence: number;
  updated_at: string;
}

export interface TicketActivity {
  activity_type: string;
  created_at: string;
  from_status: TicketStatus | null;
  id: string;
  metadata: Record<string, unknown>;
  pass_id: string | null;
  ticket_id: string;
  to_status: TicketStatus | null;
}

export interface OrganizerActivity {
  activity_type: string;
  actor_user_id: string;
  created_at: string;
  id: string;
  metadata: Record<string, unknown>;
  resource_id: string;
  resource_type: string;
}

export interface GateCheckin {
  decision: "ACCEPT";
  gate_timestamp: string;
  id: string;
  pass_id: string;
  received_at: string;
  ticket_id: string;
}

export interface GateDeviceSummary {
  device_name: string | null;
  id: string;
  key_version: number;
  last_seen_at: string | null;
  provisioned_at: string;
  revoked_at: string | null;
}

export interface OrganizerEventOperations {
  activity: TicketActivity[];
  checkins: GateCheckin[];
  counts: TicketStatusCounts;
  event: EventRecord;
  gate: GateDeviceSummary | null;
  organizer_activity: OrganizerActivity[];
  revocations: RevocationRecord[];
  ticket_types: EventTicketType[];
  tickets: OrganizerTicket[];
}

export interface CreateEventResult extends EventRecord {
  ticket_type: EventTicketType;
}

export interface ExportTicketsResult {
  csv: string;
  filename: string;
  row_count: number;
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
