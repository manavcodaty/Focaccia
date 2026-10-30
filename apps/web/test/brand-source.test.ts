import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const brandPath = path.join(import.meta.dirname, "../components/brand.tsx");
const iconPath = path.join(import.meta.dirname, "../app/icon.svg");

test("the PrivatePass mark is decorative, theme-aware and shared by the app icon", () => {
  const source = readFileSync(brandPath, "utf8");
  const icon = readFileSync(iconPath, "utf8");

  assert.match(source, /aria-hidden="true"/);
  assert.match(source, /fill="currentColor"/);
  const markPath = /d="(M5 3h14[^"]+)"/.exec(source)?.[1];
  assert.ok(markPath, "mark path present");
  assert.ok(icon.includes(markPath), "app icon uses the same mark");
});
