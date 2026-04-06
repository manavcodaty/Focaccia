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

test("gate app loads IBM Plex Sans once and uses shared typography tokens", () => {
  const layoutSource = readSource("app/_layout.tsx");
  const themeSource = readSource("src/theme.ts");

  assert.match(layoutSource, /useFonts/);
  assert.match(layoutSource, /SplashScreen\.preventAutoHideAsync\(\)/);
  assert.match(layoutSource, /IBMPlexSans_400Regular/);
  assert.match(layoutSource, /IBMPlexSans_500Medium/);
  assert.match(layoutSource, /IBMPlexSans_600SemiBold/);
  assert.match(layoutSource, /IBMPlexSans_700Bold/);
  assert.match(themeSource, /export const typography =/);
  assert.match(themeSource, /IBMPlexSans_400Regular/);
  assert.match(themeSource, /IBMPlexSans_700Bold/);

  for (const relativePath of [
    ...collectTsxFiles("app"),
    ...collectTsxFiles("src/components"),
  ]) {
    const source = readSource(relativePath);
    assert.doesNotMatch(source, /fontWeight:/, relativePath);
  }
});
