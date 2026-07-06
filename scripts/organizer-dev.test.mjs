import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { buildAllowedBrowserOrigins } from './organizer-dev.mjs';

const root = path.resolve(import.meta.dirname, '..');

test('organizer dev proxy allows organizer and tickets browser origins', () => {
  assert.deepEqual(buildAllowedBrowserOrigins('192.168.1.73'), [
    'http://192.168.1.73:3000',
    'http://192.168.1.73:3001',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://0.0.0.0:3000',
    'http://0.0.0.0:3001',
  ]);
});

test('organizer package dev starts the local proxy runner', () => {
  const manifest = JSON.parse(readFileSync(path.join(root, 'apps/web/package.json'), 'utf8'));

  assert.equal(manifest.scripts.dev, 'node ../../scripts/organizer-dev.mjs');
});
