import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('shared enrollment feedback and controls expose accessible state', async () => {
  const [alert, button, tickets, index] = await Promise.all([
    source('../src/components/inline-alert.tsx'),
    source('../src/components/ui/button.tsx'),
    source('../app/tickets.tsx'),
    source('../app/index.tsx'),
  ]);

  assert.match(alert, /accessibilityLiveRegion=/);
  assert.match(button, /accessibilityRole="button"/);
  assert.match(button, /accessibilityState=\{\{ disabled: Boolean\(props\.disabled\) \}\}/);
  assert.match(tickets, /accessibilityLabel="Copy account email"/);
  assert.match(tickets, /accessibilityLabel="Claim code"/);
  for (const label of ['Email', 'Password', 'Full name']) {
    assert.match(index, new RegExp(`accessibilityLabel="${label}"`));
  }
});

test('icon-only buttons carry an accessible name', async () => {
  const [ticket, tickets] = await Promise.all([source('../app/ticket.tsx'), source('../app/tickets.tsx')]);

  assert.match(ticket, /accessibilityLabel="Copy claim code"/);
  assert.match(tickets, /accessibilityLabel="Copy account email"/);
});
