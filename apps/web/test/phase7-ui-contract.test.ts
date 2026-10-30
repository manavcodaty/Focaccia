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

test('organizer branding is the monochrome PrivatePass mark, not the retired palettes', async () => {
  const [icon, sidebar, provisioning, css] = await Promise.all([
    source('../app/icon.svg'),
    source('../components/app-sidebar.tsx'),
    source('../components/dashboard/provisioning-qr-card.tsx'),
    source('../app/globals.css'),
  ]);
  const activeSources = [icon, sidebar, provisioning, css].join('\n');

  assert.doesNotMatch(activeSources, /#0066ff|#0055DD|0,102,255/i);
  assert.doesNotMatch(activeSources, /#7b3f2c|#f4ded2|terracotta/i);
  assert.match(icon, /#0a0a0a/i);
  assert.match(sidebar, /PrivatePassMark/);
});

test('the organizer events table keeps every operational column reachable on mobile', async () => {
  const [table, globals] = await Promise.all([
    source('../components/dashboard/events-data-table.tsx'),
    source('../app/globals.css'),
  ]);

  assert.match(table, /aria-label="Events"/);
  assert.match(table, /min-w-\[60rem\]/);
  assert.match(table, /<SortHeader/);
  assert.match(globals, /--success:\s*oklch\(/);
  assert.match(globals, /--color-success: var\(--success\)/);
});
