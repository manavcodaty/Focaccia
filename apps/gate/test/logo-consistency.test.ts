import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { privatePassWordmark } from "@face-pass/shared";

const appRoot = path.join(import.meta.dirname, "..");

function readSource(relativePath: string) {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

test("gate app renders the shared PrivatePass logo on the home screen", () => {
  assert.equal(privatePassWordmark, "PrivatePass");
  const brandLogoSource = readSource("src/components/brand-logo.tsx");
  const indexSource = readSource("app/index.tsx");

  assert.match(brandLogoSource, /@face-pass\/shared/);
  assert.match(brandLogoSource, /privatePassBrandMark/);
  assert.match(brandLogoSource, /privatePassWordmark/);
  assert.match(indexSource, /BrandLogo/);
});
