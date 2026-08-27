import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('gate feedback, controls, and credential fields are explicitly labeled', async () => {
  const [banner, button, provision, fallback, driver] = await Promise.all([
    source('../src/components/status-banner.tsx'),
    source('../src/components/primary-button.tsx'),
    source('../app/provision.tsx'),
    source('../app/fallback.tsx'),
    source('../../../scripts/cloud-ios-e2e.mjs'),
  ]);

  assert.match(banner, /accessibilityLiveRegion=/);
  assert.match(button, /accessibilityLabel=\{label\}/);
  assert.match(button, /accessibilityState=\{\{ disabled \}\}/);
  assert.match(provision, /accessibilityLabel="Organizer email"/);
  assert.match(provision, /accessibilityLabel="Organizer password"/);
  assert.match(provision, /accessibilityLabel="Gate device name"/);
  assert.match(provision, /Keyboard\.dismiss\(\)/);
  assert.match(provision, /setTimeout\(resolve, 250\)/);
  assert.equal((provision.match(/showSoftInputOnFocus=\{!isCloudE2E\}/g) ?? []).length, 3);
  assert.match(provision, /isCloudE2E \? \(/);
  assert.match(provision, /accessibilityValue=\{\{ text: deviceName \}\}/);
  assert.match(provision, /emailInputRef\.current\?\.blur\(\)/);
  assert.match(provision, /passwordInputRef\.current\?\.blur\(\)/);
  assert.match(provision, /signInInFlightRef\.current/);
  assert.match(provision, /auth && !isCloudE2E \? null/);
  assert.match(provision, /<View collapsable=\{false\}>/);
  assert.doesNotMatch(provision, /accessibilityElementsHidden=\{Boolean\(auth\)\}/);
  assert.doesNotMatch(provision, /importantForAccessibility=\{auth \? 'no-hide-descendants' : 'auto'\}/);
  assert.doesNotMatch(provision, /pointerEvents=\{auth \? 'none' : 'auto'\}/);
  assert.doesNotMatch(provision, /cloudAuthFormRetained/);
  assert.doesNotMatch(provision, /editable=\{!isBusy\}/);
  assert.match(fallback, /accessibilityLabel="Full pass token"/);
  assert.match(driver, /settleNativeAuthResponder\(\)/);
  assert.match(provision, /label="Dismiss keyboard"/);
  assert.doesNotMatch(driver, /anchorMatcher: 'Dismiss keyboard'/);
  assert.match(driver, /await typeIntoNode\(simulatorUdid, matcher, value, \{/);
  assert.match(driver, /replace: true/);
  assert.doesNotMatch(driver, /submit: true/);
  assert.doesNotMatch(provision, /onSubmitEditing=\{isCloudE2E \?/);
  assert.match(driver, /Do not synthesize Enter, blur, Escape/);
  assert.equal((driver.match(/settleNativeAuthResponder\(\)/g) ?? []).length, 4);
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
