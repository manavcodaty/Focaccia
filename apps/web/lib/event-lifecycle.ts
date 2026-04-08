import type { EventRecord } from "@/lib/types";

export type EventLifecyclePhase = "upcoming" | "active" | "ended";

export interface EventLifecycleState {
  acceptsNewAttendees: boolean;
  allowsGateProvisioning: boolean;
  phase: EventLifecyclePhase;
}

type EventLifecycleInput = Pick<EventRecord, "ends_at" | "pk_gate_event" | "starts_at">;

function toUnixMs(value: string): number {
  return new Date(value).getTime();
}

export function getEventLifecycleState(
  event: EventLifecycleInput,
  now: Date = new Date(),
): EventLifecycleState {
  const nowMs = now.getTime();
  const startsAtMs = toUnixMs(event.starts_at);
  const endsAtMs = toUnixMs(event.ends_at);
  const phase: EventLifecyclePhase = nowMs >= endsAtMs
    ? "ended"
    : nowMs < startsAtMs
      ? "upcoming"
      : "active";
  const hasProvisionedGate = Boolean(event.pk_gate_event);

  return {
    acceptsNewAttendees: phase !== "ended" && hasProvisionedGate,
    allowsGateProvisioning: phase !== "ended" && !hasProvisionedGate,
    phase,
  };
}

export function isEventEnded(
  event: EventLifecycleInput,
  now: Date = new Date(),
): boolean {
  return getEventLifecycleState(event, now).phase === "ended";
}
