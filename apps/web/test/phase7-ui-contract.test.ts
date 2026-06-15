import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('organizer surfaces expose skip navigation and avoid decorative motion', async () => {
  const [home, login, shell] = await Promise.all([
    source('../app/page.tsx'),
    source('../app/login/page.tsx'),
    source('../components/layout/app-shell.tsx'),
  ]);

  assert.match(home, /href="#main-content"/);
  assert.match(home, /id="main-content"/);
  assert.doesNotMatch(home, /animate-pulse|glass-panel|sm:grid-cols-3|min-h-screen/);
  assert.doesNotMatch(login, /animate-pulse|glass-panel|min-h-screen/);
  assert.match(shell, /href="#main-content"/);
  assert.match(shell, /id="main-content"/);
});

test('active organizer branding uses the locked warm palette', async () => {
  const [icon, sidebar, navigation, provisioning] = await Promise.all([
    source('../app/icon.svg'),
    source('../components/layout/app-sidebar.tsx'),
    source('../components/layout/nav-main.tsx'),
    source('../components/dashboard/provisioning-qr-card.tsx'),
  ]);
  const activeSources = [icon, sidebar, navigation, provisioning].join('\n');

  assert.doesNotMatch(activeSources, /#0066ff|#0055DD|0,102,255/i);
  assert.match(icon, /#5d2a1a/i);
});

test('the organizer roster keeps every operational column reachable on mobile', async () => {
  const [table, globals] = await Promise.all([
    source('../components/dashboard/event-table.tsx'),
    source('../app/globals.css'),
  ]);

  assert.match(table, /tabIndex: 0/);
  assert.match(table, /"aria-describedby": "event-roster-scroll-help"/);
  assert.match(table, /min-w-\[70rem\]/);
  assert.match(table, /token-mono mt-1 text-\[11px\] text-\[var\(--color-muted-stone\)\]/);
  assert.match(globals, /--success: #236b4d/);
});
