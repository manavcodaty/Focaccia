import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const appRoot = path.join(import.meta.dirname, "..");

function readSource(relativePath: string) {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

test("enrollment app renders the shared Focaccia logo on the entry screen", () => {
  const brandLogoSource = readSource("src/components/brand-logo.tsx");
  const indexSource = readSource("app/index.tsx");

  assert.match(brandLogoSource, /@face-pass\/shared/);
  assert.match(brandLogoSource, /focacciaBrandMark/);
  assert.match(brandLogoSource, /focacciaWordmark/);
  assert.match(indexSource, /BrandLogo/);
});
