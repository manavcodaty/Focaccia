import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('gate feedback, controls, and credential fields are explicitly labeled', async () => {
  const [banner, button, provision, fallback] = await Promise.all([
    source('../src/components/status-banner.tsx'),
    source('../src/components/primary-button.tsx'),
    source('../app/provision.tsx'),
    source('../app/fallback.tsx'),
  ]);

  assert.match(banner, /accessibilityLiveRegion=/);
  assert.match(button, /accessibilityLabel=\{label\}/);
  assert.match(button, /accessibilityState=\{\{ disabled \}\}/);
  assert.match(provision, /accessibilityLabel="Organizer email"/);
  assert.match(provision, /accessibilityLabel="Organizer password"/);
  assert.match(provision, /accessibilityLabel="Gate device name"/);
  assert.match(fallback, /accessibilityLabel="Full pass token"/);
});

