import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('shared enrollment feedback and controls expose accessible state', async () => {
  const [banner, button, tickets] = await Promise.all([
    source('../src/components/status-banner.tsx'),
    source('../src/components/primary-button.tsx'),
    source('../app/tickets.tsx'),
  ]);

  assert.match(banner, /accessibilityLiveRegion=/);
  assert.match(button, /accessibilityLabel=\{label\}/);
  assert.match(button, /accessibilityState=\{\{ disabled \}\}/);
  assert.match(tickets, /accessibilityLabel="Copy account email"/);
});

