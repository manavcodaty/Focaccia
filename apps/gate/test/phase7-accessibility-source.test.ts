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

test('face match cancellation clears decrypted pending verification before navigation', async () => {
  const [faceMatch, context] = await Promise.all([
    source('../app/face-match.tsx'),
    source('../src/state/gate-context.tsx'),
  ]);

  assert.match(context, /cancelPendingVerification\(\)/);
  assert.match(context, /destroyPendingVerification\(pendingVerification\)/);
  assert.match(faceMatch, /cancelPendingVerification\(\)/);
  assert.match(faceMatch, /onPress=\{cancelVerification\}/);
});

test('a scanned pass goes straight to one face capture with no liveness challenge', async () => {
  const [scan, fallback, faceMatch, context] = await Promise.all([
    source('../app/scan.tsx'),
    source('../app/fallback.tsx'),
    source('../app/face-match.tsx'),
    source('../src/state/gate-context.tsx'),
  ]);

  assert.match(scan, /router\.replace\('\/face-match'\)/);
  assert.match(fallback, /'\/face-match'/);
  for (const file of [scan, fallback, faceMatch, context]) {
    assert.doesNotMatch(file, /lib\/liveness|failLiveness|recordLivenessFailure|hasTimedOut|advanceChallenge/);
  }
  // Every face comparison (accept or mismatch) ends on the result screen, never a retry prompt.
  assert.match(faceMatch, /await completePendingVerification\(embedding, .*\);\n\s*router\.replace\('\/result'\)/);
  assert.doesNotMatch(faceMatch, /MATCH_FAIL/);
  assert.doesNotMatch(context, /keepPendingForRetry/);
});

test('gate iOS privacy copy does not claim platform Face ID access', async () => {
  const plist = await source('../ios/FacePassGate/Info.plist');

  assert.doesNotMatch(plist, /NSFaceIDUsageDescription/);
  assert.match(plist, /NSCameraUsageDescription/);
});
