import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import enrollmentTheme from "../../enrollment/src/theme.ts";
import gateTheme from "../../gate/src/theme.ts";

test("DESIGN.md token contract: enrollment theme uses Steep canvas palette", () => {
  assert.equal(enrollmentTheme.palette.canvas, "#FFFFFF");
  assert.equal(enrollmentTheme.palette.ink, "#17191C");
  assert.equal(enrollmentTheme.palette.warmMist, "#FBE1D1");
  assert.equal(enrollmentTheme.palette.terracotta, "#5D2A1A");
  assert.equal(enrollmentTheme.palette.fog, "#F7F7F8");
  assert.equal(enrollmentTheme.palette.background, "#FFFFFF");
});

test("DESIGN.md token contract: gate theme uses Steep canvas palette", () => {
  assert.equal(gateTheme.palette.canvas, "#FFFFFF");
  assert.equal(gateTheme.palette.ink, "#17191C");
  assert.equal(gateTheme.palette.warmMist, "#FBE1D1");
  assert.equal(gateTheme.palette.terracotta, "#5D2A1A");
  assert.equal(gateTheme.palette.fog, "#F7F7F8");
  assert.equal(gateTheme.palette.background, "#FFFFFF");
});

test("DESIGN.md token contract: both themes share consistent core tokens", () => {
  assert.equal(enrollmentTheme.palette.canvas, gateTheme.palette.canvas);
  assert.equal(enrollmentTheme.palette.ink, gateTheme.palette.ink);
  assert.equal(enrollmentTheme.palette.warmMist, gateTheme.palette.warmMist);
  assert.equal(enrollmentTheme.palette.terracotta, gateTheme.palette.terracotta);
  assert.equal(enrollmentTheme.palette.fog, gateTheme.palette.fog);
});

test("web globals.css references DESIGN.md CSS tokens", () => {
  const globalsSource = readFileSync(
    path.join(import.meta.dirname, "../app/globals.css"),
    "utf8",
  );

  assert.match(globalsSource, /--color-canvas:\s*#ffffff/);
  assert.match(globalsSource, /--color-ink:\s*#17191c/);
  assert.match(globalsSource, /--color-warm-mist:\s*#fbe1d1/);
  assert.match(globalsSource, /--color-terracotta:\s*#5d2a1a/);
  assert.match(globalsSource, /--color-fog:\s*#f7f7f8/);
});
