import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), 'utf8');
}

test('gate theme uses warm civic utility tokens and purpose-shaped controls', async () => {
  const theme = await source('src/theme.ts');

  assert.match(theme, /canvas:\s*'#FFFDFC'/);
  assert.match(theme, /clay:\s*'#7B3F2C'/);
  assert.doesNotMatch(theme, /button:\s*9999/);
});

test('gate shell supports operational inverse and decision modes', async () => {
  const shell = await source('src/components/screen-shell.tsx');

  assert.match(shell, /variant\?:[^;]*'scanner'/s);
  assert.match(shell, /'accepted'/);
  assert.match(shell, /'rejected'/);
  assert.match(shell, /SafeAreaView/);
});

test('gate home uses shared readiness vocabulary before the scanner action', async () => {
  const home = await source('app/index.tsx');

  assert.match(home, /Offline ready|Refresh required|Needs setup/);
  assert.match(home, /Open scanner/);
  assert.match(home, /Sync pending/);
});
