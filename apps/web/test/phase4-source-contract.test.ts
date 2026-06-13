import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(path.join(import.meta.dirname, "..", relativePath), "utf8");
}

test("secure dashboard keeps both authentication and organizer profile checks", () => {
  const layout = source("app/(secure)/layout.tsx");

  assert.match(layout, /auth\.getUser/);
  assert.match(layout, /organizer_profiles/);
  assert.match(layout, /organizer_required/);
});

test("local dashboard development allows the selected physical-device host", () => {
  const config = source("next.config.ts");

  assert.match(config, /NEXT_PUBLIC_FOCACCIA_WEB_URL/);
  assert.match(config, /allowedDevOrigins/);
});

test("event workspace includes edit, public URL, tickets, types, audit, and CSV surfaces", () => {
  const page = source("app/(secure)/events/[eventId]/page.tsx");
  const workspace = source("components/dashboard/event-operations-workspace.tsx");

  assert.match(page, /ticketsUrl/);
  assert.match(page, /EventOperationsWorkspace/);
  assert.match(workspace, /Edit event/);
  assert.match(workspace, /Export CSV/);
  assert.match(workspace, /Ticket types/);
  assert.match(workspace, /Activity history/);
  assert.match(workspace, /Reset pass/);
  assert.match(workspace, /Revoke ticket/);
  assert.match(workspace, /AlertDialog/);
});

test("event form covers the complete event transaction and paid-ticket warning", () => {
  const form = source("components/dashboard/event-form.tsx");

  for (const field of [
    "description",
    "location",
    "starts_at",
    "ends_at",
    "capacity",
    "is_listed",
  ]) {
    assert.match(form, new RegExp(field));
  }
  assert.match(form, /General Admission/);
  assert.match(form, /Paid checkout is unavailable/);
});

test("live dashboard refreshes from ticket, check-in, and organizer audit changes", () => {
  const liveRefresh = source("components/dashboard/live-event-refresh.tsx");
  const dashboardRefresh = source("components/dashboard/live-dashboard-refresh.tsx");

  assert.match(liveRefresh, /ticket_activity_log/);
  assert.match(liveRefresh, /gate_checkins/);
  assert.match(liveRefresh, /organizer_activity_log/);
  assert.match(liveRefresh, /router\.refresh/);
  assert.match(dashboardRefresh, /ticket_activity_log/);
  assert.match(dashboardRefresh, /gate_checkins/);
  assert.match(dashboardRefresh, /router\.refresh/);
});
