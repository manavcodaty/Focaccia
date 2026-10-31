import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const appRoot = path.join(import.meta.dirname, "..");

function readSource(relativePath: string) {
  return readFileSync(path.join(appRoot, relativePath), "utf8");
}

function collectTsxFiles(relativeDir: string): string[] {
  const absoluteDir = path.join(appRoot, relativeDir);
  const entries = readdirSync(absoluteDir, { withFileTypes: true });

  return entries.flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);

    if (entry.isDirectory()) {
      return collectTsxFiles(relativePath);
    }

    return entry.name.endsWith(".tsx") ? [relativePath] : [];
  });
}

test("gate app loads Geist once, the typeface shared with the tickets and organizer apps", () => {
  const layoutSource = readSource("app/_layout.tsx");
  const themeSource = readSource("src/lib/theme.ts");

  assert.match(layoutSource, /useFonts/);
  assert.match(layoutSource, /SplashScreen\.preventAutoHideAsync\(\)/);
  for (const weight of ["Geist_400Regular", "Geist_500Medium", "Geist_600SemiBold", "Geist_700Bold"]) {
    assert.match(layoutSource, new RegExp(weight));
    assert.match(themeSource, new RegExp(weight));
  }
  assert.doesNotMatch(layoutSource, /IBMPlexSans/);
});

test("weight utilities select a Geist family instead of a synthesised weight", () => {
  const tailwind = readSource("tailwind.config.js");

  assert.match(tailwind, /fontWeight:\s*false/);
  assert.match(tailwind, /'\.font-normal': \{ fontFamily: 'Geist_400Regular' \}/);
  assert.match(tailwind, /'\.font-medium': \{ fontFamily: 'Geist_500Medium' \}/);
  assert.match(tailwind, /'\.font-semibold': \{ fontFamily: 'Geist_600SemiBold' \}/);
  assert.match(tailwind, /'\.font-bold': \{ fontFamily: 'Geist_700Bold' \}/);
  assert.match(readSource("src/components/ui/text.tsx"), /'text-foreground text-base font-normal'/);
  assert.match(readSource("src/components/ui/input.tsx"), /font-normal/);
});

test("no screen or component sets fonts or weights through inline styles", () => {
  for (const relativePath of [...collectTsxFiles("app"), ...collectTsxFiles("src/components")]) {
    const source = readSource(relativePath);
    assert.doesNotMatch(source, /fontWeight:|fontFamily:|fontSize:/, relativePath);
  }
});
