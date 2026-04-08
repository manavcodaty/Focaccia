import type { EventRecord } from "@/lib/types";
import { isEventEnded } from "./event-lifecycle.ts";

export interface ProvisionedGateSummary {
  createdAt: string;
  id: string;
  isActive: boolean;
  name: string;
  publicKey: string;
}

export function createEventIdFromDraft(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_{2,}/g, "_");
}

export function getProvisionedGates(
  event: EventRecord,
): ProvisionedGateSummary[] {
  if (!event.pk_gate_event) {
    return [];
  }

  return [
    {
      createdAt: event.created_at,
      id: `${event.event_id}-gate`,
      isActive: !isEventEnded(event),
      name: "Bound gate device",
      publicKey: event.pk_gate_event,
    },
  ];
}
