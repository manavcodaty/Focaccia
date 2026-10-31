import assert from 'node:assert/strict';
import test from 'node:test';

import { decisionTitle, gateReadiness, shortAge, syncStatus } from '../src/lib/gate-presentation.ts';

test('readiness is two words with a status tone', () => {
  assert.deepEqual(gateReadiness(false, 'fresh'), { label: 'Needs setup', tone: 'warning' });
  assert.deepEqual(gateReadiness(true, 'fresh'), { label: 'Offline ready', tone: 'success' });
  assert.deepEqual(gateReadiness(true, 'stale'), { label: 'Refresh required', tone: 'warning' });
  assert.deepEqual(gateReadiness(true, 'critical'), { label: 'Refresh required', tone: 'destructive' });
});

test('sync status only calls attention to pending check-ins', () => {
  assert.deepEqual(syncStatus(0), { label: 'Synced', tone: 'success' });
  assert.deepEqual(syncStatus(3), { label: 'Sync pending', tone: 'warning' });
});

test('cache age is compact', () => {
  assert.equal(shortAge(null), 'Never');
  assert.equal(shortAge(5_000), 'Just now');
  assert.equal(shortAge(12 * 60_000), '12 min');
  assert.equal(shortAge(3 * 60 * 60_000 + 5), '3 h');
});

test('decision titles', () => {
  assert.equal(decisionTitle(true), 'Entry accepted');
  assert.equal(decisionTitle(false), 'Entry rejected');
});
