import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(relativePath: string) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

test('gate feedback, controls, and credential fields are explicitly labeled', async () => {
  const [banner, button, provision, enrollment, fallback, driver, workflow, home, shell, env] = await Promise.all([
    source('../src/components/status-banner.tsx'),
    source('../src/components/primary-button.tsx'),
    source('../app/provision.tsx'),
    source('../../enrollment/app/index.tsx'),
    source('../app/fallback.tsx'),
    source('../../../scripts/cloud-ios-e2e.mjs'),
    source('../../../.github/workflows/cloud-ios-full-flow.yml'),
    source('../app/index.tsx'),
    source('../src/components/screen-shell.tsx'),
    source('../src/lib/env.ts'),
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
  assert.match(provision, /signInInFlightRef\.current/);
  assert.match(provision, /EXPO_PUBLIC_FOCACCIA_E2E_ORGANIZER_EMAIL/);
  assert.match(provision, /EXPO_PUBLIC_FOCACCIA_E2E_ORGANIZER_PASSWORD/);
  assert.match(provision, /native keyboard\/responder path/);
  assert.match(enrollment, /EXPO_PUBLIC_FOCACCIA_E2E_ATTENDEE_EMAIL/);
  assert.match(enrollment, /EXPO_PUBLIC_FOCACCIA_E2E_ATTENDEE_PASSWORD/);
  assert.match(enrollment, /native keyboard\/responder path/);
  assert.match(workflow, /EXPO_PUBLIC_FOCACCIA_E2E_ORGANIZER_EMAIL=\$\{context\.organizerEmail\}/);
  assert.match(workflow, /EXPO_PUBLIC_FOCACCIA_E2E_ATTENDEE_EMAIL=\$\{context\.attendeeEmail\}/);
  assert.match(provision, /if \(!isCloudE2E\) \{\s+setFeedback\('Organizer session is active/);
  assert.match(provision, /title=\{isCloudE2E \? 'Sign in before sync' : auth \? auth\.email/);
  assert.match(provision, /\) : auth \? \(/);
  assert.match(provision, /<View collapsable=\{false\}>/);
  assert.doesNotMatch(provision, /accessibilityElementsHidden=\{Boolean\(auth\)\}/);
  assert.doesNotMatch(provision, /importantForAccessibility=\{auth \? 'no-hide-descendants' : 'auto'\}/);
  assert.doesNotMatch(provision, /pointerEvents=\{auth \? 'none' : 'auto'\}/);
  assert.doesNotMatch(provision, /cloudAuthFormRetained/);
  assert.doesNotMatch(provision, /editable=\{!isBusy\}/);
  assert.match(fallback, /accessibilityLabel="Full pass token"/);
  assert.match(provision, /Cloud E2E organizer session is active/);
  assert.match(provision, /require\('react-native-vision-camera'\)/);
  assert.match(provision, /isCloudE2E && draft \? \(\s*\/\/ The cloud payload-injection screen/);
  assert.match(provision, /!isCloudE2E \? \(\s*<PrimaryButton/);
  assert.match(home, /isCloudE2E = process\.env\.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1'/);
  assert.match(home, /router\.replace\('\/provision'\)/);
  assert.match(shell, /isCloudE2E = process\.env\.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1'/);
  assert.match(shell, /const scrollContent = isCloudE2E \? \(\s*content\s*\) : scroll \?/);
  assert.match(shell, /isCloudE2E \? \(\s*<View style=\{styles\.keyboard\}>\{scrollContent\}<\/View>/);
  assert.match(env, /allowCloudSimulatorLoopback: isCloudSimulatorE2E/);
  assert.match(shell, /<KeyboardAvoidingView/);
  assert.doesNotMatch(driver, /anchorMatcher: 'Dismiss keyboard'/);
  assert.match(driver, /await typeIntoNode\(simulatorUdid, matcher, value, \{/);
  assert.match(driver, /RemoteTextInput lifecycle can restart backboardd/);
  assert.doesNotMatch(driver, /fillInputExactly\('Organizer email'/);
  assert.doesNotMatch(driver, /fillInputExactly\('Email'/);
  assert.match(driver, /replace: true/);
  assert.doesNotMatch(driver, /submit: true/);
  assert.doesNotMatch(provision, /onSubmitEditing=\{isCloudE2E \?/);
  assert.doesNotMatch(driver, /settleNativeAuthResponder/);
  assert.match(driver, /matcher: \/Sign in\|My tickets\//);
  assert.match(driver, /async function tapAction\(matcher, options = \{\}\) \{[\s\S]*?retryIfStillVisible: false/);
  assert.match(driver, /try \{\s+await openGateProvisioning\(\);\s+\} catch \(provisioningWaitError\)/);
  assert.doesNotMatch(driver, /tapNode\(simulatorUdid, 'Set up gate'/);
  assert.doesNotMatch(driver, /matcher: \/[^\n]*Set up gate/);
  assert.doesNotMatch(driver, /tapNode\(simulatorUdid, appLabel/);
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

test('cloud scanner, liveness, result, home, and settings actions stay reachable without scrolling', async () => {
  const [scan, liveness, result, home, settings] = await Promise.all([
    source('../app/scan.tsx'),
    source('../app/liveness.tsx'),
    source('../app/result.tsx'),
    source('../app/index.tsx'),
    source('../app/settings.tsx'),
  ]);

  assert.match(scan, /isCloudE2E \? styles\.cloudPreview : null/);
  assert.match(liveness, /isCloudE2E \? styles\.cloudPreview : null/);
  assert.doesNotMatch(scan, /from ['"]react-native-vision-camera['"]/);
  assert.match(scan, /function NativeScanScreen\(\)[\s\S]*require\('react-native-vision-camera'\)/);
  assert.match(scan, /function CloudScanScreen\(\)[\s\S]*cameraContent=\{<CloudE2EPreview \/>\}/);
  assert.doesNotMatch(liveness, /import\s*\{[^}]*\}\s*from ['"]react-native-vision-camera['"]/s);
  assert.match(liveness, /function NativeLivenessScreen\(\)[\s\S]*require\('react-native-vision-camera'\)/);
  assert.match(liveness, /function CloudLivenessScreen\(\)[\s\S]*camera: null/);
  assert.match(scan, /cloudPreview: \{ aspectRatio: 1\.45, maxHeight: 240 \}/);
  assert.match(liveness, /cloudPreview: \{\s*aspectRatio: 1\.45,\s*maxHeight: 240,\s*\}/s);
  assert.match(result, /\{isCloudE2E \? homeButton : null\}/);
  assert.match(result, /\{!isCloudE2E \? homeButton : null\}/);
  assert.match(home, /\{isCloudE2E && gate \? settingsButton : null\}/);
  assert.match(home, /\{!isCloudE2E \? settingsButton : null\}/);
  assert.match(settings, /\{isCloudE2E \? retrySyncButton : null\}/);
  assert.match(settings, /\{!isCloudE2E \? retrySyncButton : null\}/);
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
