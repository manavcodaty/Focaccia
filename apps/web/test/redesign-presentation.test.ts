import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);

async function source(path: string) {
  return readFile(new URL(path, root), 'utf8');
}

test('public overview states the real privacy boundary without zero-storage claims', async () => {
  const page = await source('app/page.tsx');

  assert.doesNotMatch(page, /stored nowhere|stores? no data|nothing is stored/i);
  assert.match(page, /personal and operational records/i);
  assert.match(page, /raw face images/i);
});

test('production routes no longer import the decorative particle landing system', async () => {
  const page = await source('app/page.tsx');
  const layout = await source('app/layout.tsx');

  assert.doesNotMatch(`${page}\n${layout}`, /components\/landing\/hero|components\/landing\/gl/);
});

test('organizer shell exposes responsive navigation and current location', async () => {
  const shell = await source('components/layout/app-shell.tsx');

  assert.match(shell, /@\/components\/ui\/sheet/);
  assert.match(shell, /aria-current/);
  assert.match(shell, /Organizer/);
});

test('organizer theme uses warm civic utility tokens and purpose-based radii', async () => {
  const css = await source('app/globals.css');

  assert.match(css, /--background:\s*#fffdfc/i);
  assert.match(css, /--primary:\s*#7b3f2c/i);
  assert.doesNotMatch(css, /--radius:\s*1\.5rem/);
});

test('organizer dashboard integrates operational counts instead of a four-card KPI row', async () => {
  const dashboard = await source('app/(secure)/dashboard/page.tsx');

  assert.match(dashboard, /aria-label="Portfolio summary"/);
  assert.doesNotMatch(dashboard, /xl:grid-cols-4/);
});

test('gate provisioning keeps raw cryptographic values behind advanced disclosure', async () => {
  const provisioning = await source('app/(secure)/events/[eventId]/provisioning/page.tsx');
  const gateView = await source('components/dashboard/gate-provisioning-view.tsx');

  assert.match(provisioning, /Advanced cryptographic details/);
  assert.match(provisioning, /@\/components\/ui\/accordion/);
  assert.doesNotMatch(provisioning, /<CardTitle>Public values<\/CardTitle>/);
  assert.doesNotMatch(gateView, /gate\.publicKey/);
});

test('event workspace presents ticket states as an operational band', async () => {
  const workspace = await source('components/dashboard/event-operations-workspace.tsx');

  assert.match(workspace, /aria-label="Ticket state summary"/);
  assert.doesNotMatch(workspace, /xl:grid-cols-5/);
});

test('organizer overlays stay opaque instead of reintroducing glass effects', async () => {
  const dialog = await source('components/ui/dialog.tsx');
  const sheet = await source('components/ui/sheet.tsx');
  const alertDialog = await source('components/ui/alert-dialog.tsx');

  assert.doesNotMatch(`${dialog}\n${sheet}\n${alertDialog}`, /backdrop-blur/);
});
