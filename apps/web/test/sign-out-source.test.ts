import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const shellSource = readFileSync(
  path.join(import.meta.dirname, "../components/layout/app-shell.tsx"),
  "utf8",
);

test("the production organizer shell clears the secure session before a document navigation", () => {
  assert.match(shellSource, /performSecureSignOut\(supabase\)/);
  assert.match(shellSource, /window\.location\.assign\("\/login"\)/);
  assert.doesNotMatch(shellSource, /router\.push\(/);
});
