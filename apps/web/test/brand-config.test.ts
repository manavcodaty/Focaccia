import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import enrollmentTheme from "../../enrollment/src/theme.ts";
import gateTheme from "../../gate/src/theme.ts";

test("design-system token contract: enrollment uses the warm civic palette", () => {
  assert.equal(enrollmentTheme.palette.canvas, "#FFFDFC");
  assert.equal(enrollmentTheme.palette.ink, "#1D1917");
  assert.equal(enrollmentTheme.palette.warmMist, "#F4DED2");
  assert.equal(enrollmentTheme.palette.terracotta, "#7B3F2C");
  assert.equal(enrollmentTheme.palette.fog, "#F7F4F1");
  assert.equal(enrollmentTheme.palette.background, "#FFFDFC");
});

test("design-system token contract: gate uses the warm civic palette", () => {
  assert.equal(gateTheme.palette.canvas, "#FFFDFC");
  assert.equal(gateTheme.palette.ink, "#1D1917");
  assert.equal(gateTheme.palette.warmMist, "#F4DED2");
  assert.equal(gateTheme.palette.terracotta, "#7B3F2C");
  assert.equal(gateTheme.palette.fog, "#F7F4F1");
  assert.equal(gateTheme.palette.background, "#FFFDFC");
});

test("DESIGN.md token contract: both themes share consistent core tokens", () => {
  assert.equal(enrollmentTheme.palette.canvas, gateTheme.palette.canvas);
  assert.equal(enrollmentTheme.palette.ink, gateTheme.palette.ink);
  assert.equal(enrollmentTheme.palette.warmMist, gateTheme.palette.warmMist);
  assert.equal(enrollmentTheme.palette.terracotta, gateTheme.palette.terracotta);
  assert.equal(enrollmentTheme.palette.fog, gateTheme.palette.fog);
});

test("organizer and ticket web apps share one neutral shadcn token set", () => {
  const web = readFileSync(path.join(import.meta.dirname, "../app/globals.css"), "utf8");
  const tickets = readFileSync(path.join(import.meta.dirname, "../../tickets/app/globals.css"), "utf8");
  const tokens = (css: string) => css.slice(css.indexOf(":root"), css.indexOf("@theme inline"));

  assert.equal(tokens(web), tokens(tickets));
  assert.match(web, /--primary:\s*oklch\(0\.205 0 0\)/);
});
