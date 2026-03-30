import {
  canonicalJsonStringify,
  type CanonicalJsonValue,
} from "@face-pass/shared";

import type { EventRecord, ProvisioningPayload } from "@/lib/types";

export function buildProvisioningPayload(event: EventRecord): ProvisioningPayload {
  return {
    ends_at: event.ends_at,
    event_id: event.event_id,
    event_salt: event.event_salt,
    issued_at: new Date().toISOString(),
    kind: "gate-provisioning",
    name: event.name,
    pk_sign_event: event.pk_sign_event,
    starts_at: event.starts_at,
    v: 1,
    ...(event.pk_gate_event ? { pk_gate_event: event.pk_gate_event } : {}),
  };
}

export function createProvisioningQrValue(event: EventRecord): string {
  return canonicalJsonStringify(
    buildProvisioningPayload(event) as unknown as CanonicalJsonValue,
  );
}
