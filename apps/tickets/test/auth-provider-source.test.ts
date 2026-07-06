import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('auth provider handles rejected session profile loads', async () => {
  const source = await readFile(new URL('../components/auth-provider.tsx', import.meta.url), 'utf8');

  assert.match(source, /handleAuthLoadError/);
  assert.match(source, /getSession\(\)[\s\S]*?then\(\(\{ data \}\) => applySession\(data\.session\)\)[\s\S]*?catch\(handleAuthLoadError\)/);
  assert.match(source, /void applySession\(nextSession\)\.catch\(handleAuthLoadError\)/);
});
