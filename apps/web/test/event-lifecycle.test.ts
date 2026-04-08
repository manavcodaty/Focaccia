import assert from "node:assert/strict";
import test from "node:test";

import { getEventLifecycleState } from "../lib/event-lifecycle.ts";

const baseEvent = {
  created_at: "2026-04-08T08:00:00.000Z",
  ends_at: "2026-04-08T12:00:00.000Z",
  event_id: "dubai_summit_evening_entry",
  event_salt: "salt",
  join_code: "AB12CD34",
  name: "Dubai Summit Evening Entry",
  pk_gate_event: null,
  pk_sign_event: "sign",
  starts_at: "2026-04-08T09:00:00.000Z",
};

test("marks future events as upcoming and still open to provisioning", () => {
  assert.deepEqual(
    getEventLifecycleState(baseEvent, new Date("2026-04-08T08:30:00.000Z")),
    {
      acceptsNewAttendees: false,
      allowsGateProvisioning: true,
      phase: "upcoming",
    },
  );
});

test("marks live provisioned events as attendee-ready", () => {
  assert.deepEqual(
    getEventLifecycleState(
      {
        ...baseEvent,
        pk_gate_event: "pk_gate_123",
      },
      new Date("2026-04-08T10:15:00.000Z"),
    ),
    {
      acceptsNewAttendees: true,
      allowsGateProvisioning: false,
      phase: "active",
    },
  );
});

test("closes ended events to both provisioning and new attendees", () => {
  assert.deepEqual(
    getEventLifecycleState(
      {
        ...baseEvent,
        pk_gate_event: "pk_gate_123",
      },
      new Date("2026-04-08T12:00:01.000Z"),
    ),
    {
      acceptsNewAttendees: false,
      allowsGateProvisioning: false,
      phase: "ended",
    },
  );
});
