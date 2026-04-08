import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const eventTablePath = path.join(import.meta.dirname, "../components/dashboard/event-table.tsx");

test("exposes a delete action with confirmation in the event table menu", () => {
  const source = readFileSync(eventTablePath, "utf8");

  assert.match(source, /Delete event/);
  assert.match(source, /Confirm deletion/);
});
