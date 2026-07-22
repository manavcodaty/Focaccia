import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

test('gate start uses the local env and proxy bootstrap', () => {
  const manifest = JSON.parse(readFileSync(path.join(root, 'apps/gate/package.json'), 'utf8'));

  assert.equal(manifest.scripts.start, 'node ../../scripts/gate-dev.mjs');
});

test('gate bootstrap preserves tunnel mode, forwards Metro arguments, and avoids build commands', () => {
  const gateDevSource = readFileSync(path.join(root, 'scripts/gate-dev.mjs'), 'utf8');
  const source = [
    gateDevSource,
    readFileSync(path.join(root, 'scripts/gate-network-bootstrap.mjs'), 'utf8'),
  ].join('\n');

  assert.match(source, /EXPO_PUBLIC_FOCACCIA_NETWORK_MODE/);
  assert.match(source, /mode === 'local'/);
  assert.match(source, /process\.argv\.slice\(2\)/);
  assert.doesNotMatch(gateDevSource, /run:ios|prebuild|export:ios/);
});

test('gate bootstrap health-checks a proxy before reusing it', () => {
  const source = readFileSync(path.join(root, 'scripts/gate-network-bootstrap.mjs'), 'utf8');

  assert.match(source, /\/auth\/v1\/health/);
  assert.match(source, /statusCode === 200/);
});

test('gate Metro config awaits network preparation for direct Expo run commands', () => {
  const source = readFileSync(path.join(root, 'apps/gate/metro.config.js'), 'utf8');

  assert.match(source, /prepareGateNetwork/);
  assert.match(source, /shouldPrepareGateNetwork/);
  assert.match(source, /await prepareGateNetwork\(\)/);
});

test('enrollment Metro config awaits network preparation for direct Expo run commands', () => {
  const source = readFileSync(path.join(root, 'apps/enrollment/metro.config.js'), 'utf8');

  assert.match(source, /prepareNativeNetwork/);
  assert.match(source, /shouldPrepareNativeNetwork/);
  assert.match(source, /await prepareNativeNetwork\(/);
});
