import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), 'utf8');
}

test('enrollment theme uses warm civic utility tokens and purpose-shaped controls', async () => {
  const theme = await source('src/theme.ts');

  assert.match(theme, /canvas:\s*'#FFFDFC'/);
  assert.match(theme, /clay:\s*'#7B3F2C'/);
  assert.doesNotMatch(theme, /button:\s*9999/);
});

test('enrollment shell and controls preserve safe areas and explicit accessibility state', async () => {
  const shell = await source('src/components/screen-shell.tsx');
  const button = await source('src/components/primary-button.tsx');

  assert.match(shell, /variant\?:\s*'camera'/);
  assert.match(shell, /SafeAreaView/);
  assert.match(button, /accessibilityState/);
  assert.match(button, /minHeight/);
});

test('consent explains temporary capture files and on-device processing exactly', async () => {
  const consent = await source('app/consent.tsx');

  assert.match(consent, /on your iPhone|on-device/i);
  assert.match(consent, /temporary file/i);
  assert.match(consent, /raw face images/i);
});
