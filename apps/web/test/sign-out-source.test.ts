import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const navUserSource = readFileSync(
  path.join(import.meta.dirname, "../components/nav-user.tsx"),
  "utf8",
);

test("the production organizer shell clears the secure session before a document navigation", () => {
  assert.match(navUserSource, /performSecureSignOut\(supabase\)/);
  assert.match(navUserSource, /window\.location\.assign\("\/login"\)/);
  assert.doesNotMatch(navUserSource, /router\.push\(/);
});
