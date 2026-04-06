import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const logoPath = path.join(import.meta.dirname, "../components/landing/logo.tsx");

test("consumes custom logo class props without forwarding them to the svg element", () => {
  const source = readFileSync(logoPath, "utf8");

  assert.match(source, /iconClassName\?: string/);
  assert.match(source, /wordmarkClassName\?: string/);
  assert.match(source, /wordmarkClassName/);
  assert.doesNotMatch(source, /\{\.\.\.props\}/);
});
