import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const navUserSource = readFileSync(
  path.join(import.meta.dirname, "../components/layout/nav-user.tsx"),
  "utf8",
);
const userMenuSource = readFileSync(
  path.join(import.meta.dirname, "../components/layout/user-menu.tsx"),
  "utf8",
);

for (const [name, source] of [
  ["nav-user", navUserSource],
  ["user-menu", userMenuSource],
] as const) {
  test(`${name} hard-redirects organizers to the public landing page after sign-out`, () => {
    assert.match(source, /getPostSignOutState\(\)/);
    assert.match(source, /window\.location\.replace\(nextState\.href\)/);
    assert.doesNotMatch(source, /router\.push\(/);
  });
}
