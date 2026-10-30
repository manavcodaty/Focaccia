import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const tablePath = path.join(import.meta.dirname, "../components/dashboard/events-data-table.tsx");

test("exposes a delete action with a named confirmation in the events table menu", () => {
  const source = readFileSync(tablePath, "utf8");

  assert.match(source, /Delete event/);
  assert.match(source, /AlertDialogTitle>Delete \{event\.name\}\?/);
  assert.match(source, /This cannot be undone/);
});

test("the events table is the dashboard-01 data table adapted to real event rows", () => {
  const source = readFileSync(tablePath, "utf8");

  assert.match(source, /@tanstack\/react-table/);
  assert.match(source, /@\/components\/ui\/drawer/);
  assert.match(source, /filterOrganizerEvents/);
  assert.doesNotMatch(source, /@dnd-kit/);
});

test("clicking anywhere on an event row opens one shared quick-view drawer of plain figures", () => {
  const source = readFileSync(tablePath, "utf8");

  assert.match(source, /onClick=\{\(clickEvent\) => \{ if \(isRowOpenClick\(clickEvent\)\) openEvent\(row\.original\.event_id\); \}\}/);
  assert.match(source, /<Drawer direction=\{isMobile \? "bottom" : "right"\} onOpenChange=\{setDrawerOpen\} open=/);
  assert.doesNotMatch(source, /DrawerTrigger|recharts|ChartContainer|<Progress|GateBadge/);
});
