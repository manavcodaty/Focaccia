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

test('gate scanner requires a fresh revocation cache before admitting attendees', async () => {
  const [home, context] = await Promise.all([
    source('../app/index.tsx'),
    source('../src/state/gate-context.tsx'),
  ]);

  assert.match(home, /scannerReady = cache\.state === 'fresh'/);
  assert.match(context, /cacheFreshness\(gate\.last_revocation_sync_at\)\.state !== 'fresh'/);
});

test('liveness cancellation clears decrypted pending verification before navigation', async () => {
  const [liveness, context] = await Promise.all([
    source('../app/liveness.tsx'),
    source('../src/state/gate-context.tsx'),
  ]);

  assert.match(context, /cancelPendingVerification\(\)/);
  assert.match(context, /destroyPendingVerification\(pendingVerification\)/);
  assert.match(liveness, /cancelPendingVerification\(\)/);
  assert.match(liveness, /onPress=\{cancelVerification\}/);
});

test('liveness match failures stay on capture for another attempt', async () => {
  const liveness = await source('../app/liveness.tsx');

  assert.match(liveness, /decision\.reasonCode === 'MATCH_FAIL'/);
  assert.match(liveness, /setProcessingError\(decision\.hint\)/);
  assert.doesNotMatch(liveness, /challengeInstruction\(challenge\.type\)/);
});

test('gate iOS privacy copy does not claim platform Face ID access', async () => {
  const plist = await source('../ios/FacePassGate/Info.plist');

  assert.doesNotMatch(plist, /NSFaceIDUsageDescription/);
  assert.match(plist, /NSCameraUsageDescription/);
});
