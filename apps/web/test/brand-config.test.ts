import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { focacciaBrand } from "../../../packages/shared/src/brand.ts";
import enrollmentTheme from "../../enrollment/src/theme.ts";
import gateTheme from "../../gate/src/theme.ts";
test("centralizes the Dashboard brand colors as exact shared tokens", () => {
  assert.equal(focacciaBrand.primary, "#0066FF");
  assert.equal(focacciaBrand.secondary, "#0A1024");
});

test("maps the shared brand colors into the native theme modules", () => {
  assert.equal(enrollmentTheme.palette.accent, focacciaBrand.primary);
  assert.equal(enrollmentTheme.palette.ink, focacciaBrand.secondary);
  assert.equal(gateTheme.palette.highlight, focacciaBrand.primary);
  assert.equal(gateTheme.palette.ink, focacciaBrand.secondary);
});

test("exposes the extracted brand colors through apps/web Tailwind config", () => {
  const tailwindSource = readFileSync(
    path.join(import.meta.dirname, "../tailwind.config.ts"),
    "utf8",
  );

  assert.match(tailwindSource, /primary:\s*focacciaBrand\.primary/);
  assert.match(tailwindSource, /secondary:\s*focacciaBrand\.secondary/);
});
