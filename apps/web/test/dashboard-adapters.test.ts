import assert from "node:assert/strict";
import test from "node:test";

// @ts-expect-error Node's strip-types runner requires explicit extensions.
import {
  createEventIdFromDraft,
  getProvisionedGates,
} from "../lib/dashboard-adapters.ts";

test("creates a stable event id from the new dashboard form draft", () => {
  assert.equal(
    createEventIdFromDraft("Dubai Summit Evening Entry"),
    "dubai_summit_evening_entry",
  );
  assert.equal(
    createEventIdFromDraft("VIP @ Main Gate 2026!"),
    "vip_main_gate_2026",
  );
});

test("derives the provisioning gate list from the event record", () => {
  assert.deepEqual(
    getProvisionedGates({
      created_at: "2026-04-02T08:00:00.000Z",
      ends_at: "2026-04-02T12:00:00.000Z",
      event_id: "dubai_summit_evening_entry",
      event_salt: "salt",
      join_code: "AB12CD34",
      name: "Dubai Summit Evening Entry",
      pk_gate_event: null,
      pk_sign_event: "sign",
      starts_at: "2026-04-02T09:00:00.000Z",
    }),
    [],
  );

  assert.deepEqual(
    getProvisionedGates({
      created_at: "2026-04-02T08:00:00.000Z",
      ends_at: "2026-04-02T12:00:00.000Z",
      event_id: "dubai_summit_evening_entry",
      event_salt: "salt",
      join_code: "AB12CD34",
      name: "Dubai Summit Evening Entry",
      pk_gate_event: "pk_gate_123",
      pk_sign_event: "sign",
      starts_at: "2026-04-02T09:00:00.000Z",
    }),
    [
      {
        createdAt: "2026-04-02T08:00:00.000Z",
        id: "dubai_summit_evening_entry-gate",
        isActive: true,
        name: "Bound gate device",
        publicKey: "pk_gate_123",
      },
    ],
  );
});
