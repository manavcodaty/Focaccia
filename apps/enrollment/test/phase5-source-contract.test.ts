import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../../..');

function source(relativePath: string) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('ticket list uses FlatList with refresh and stable ticket IDs', () => {
  const tickets = source('apps/enrollment/app/tickets.tsx');
  assert.match(tickets, /FlatList/);
  assert.match(tickets, /RefreshControl/);
  assert.match(tickets, /keyExtractor/);
  assert.doesNotMatch(tickets, /keyExtractor=.*index/);
});

test('auth and pass material use SecureStore rather than AsyncStorage', () => {
  const secureStorage = source('apps/enrollment/src/lib/secure-storage.ts');
  const supabase = source('apps/enrollment/src/lib/supabase.ts');
  assert.match(secureStorage, /expo-secure-store/);
  assert.match(secureStorage, /THIS_DEVICE_ONLY/);
  assert.match(supabase, /persistSession:\s*true/);
  assert.doesNotMatch(`${secureStorage}\n${supabase}`, /AsyncStorage/);
});

test('persisted auth restoration handles stale refresh tokens before auto-refresh starts', () => {
  const authContext = source('apps/enrollment/src/state/auth-context.tsx');
  const manifest = JSON.parse(source('apps/enrollment/package.json')) as {
    scripts: Record<string, string>;
  };
  const supabase = source('apps/enrollment/src/lib/supabase.ts');

  assert.match(supabase, /autoRefreshToken:\s*false/);
  assert.match(supabase, /createDeferredAuthStorage/);
  assert.match(supabase, /storage:\s*supabaseAuthStorage\.storage/);
  assert.match(authContext, /restoreEnrollmentSession\(supabase\.auth,\s*supabaseAuthStorage\)/);
  assert.match(authContext, /\.catch\(/);
  assert.match(manifest.scripts['test:coverage'], /src\/lib\/auth-session\.ts/);
});

test('iOS networking is local-only and tunnel profiles remain HTTPS-selected', () => {
  const app = JSON.parse(source('apps/enrollment/app.json')) as {
    expo: { ios: { infoPlist: Record<string, unknown> } };
  };
  const eas = JSON.parse(source('apps/enrollment/eas.json')) as {
    build: Record<string, { env: Record<string, string> }>;
  };
  const ats = app.expo.ios.infoPlist.NSAppTransportSecurity as Record<string, unknown>;

  assert.equal(ats.NSAllowsArbitraryLoads, false);
  assert.equal(ats.NSAllowsLocalNetworking, true);
  assert.match(String(app.expo.ios.infoPlist.NSLocalNetworkUsageDescription), /organizer's Mac/i);
  assert.equal(eas.build['development-local']?.env.EXPO_PUBLIC_FOCACCIA_NETWORK_MODE, 'local');
  assert.equal(eas.build['development-tunnel']?.env.EXPO_PUBLIC_FOCACCIA_NETWORK_MODE, 'tunnel');
  assert.equal(eas.build['production-tunnel']?.env.EXPO_PUBLIC_FOCACCIA_NETWORK_MODE, 'tunnel');
});

test('native auth dismisses the keyboard before replacing the form', () => {
  const authScreen = source('apps/enrollment/app/index.tsx');

  assert.match(authScreen, /Keyboard\.dismiss\(\)/);
  assert.match(authScreen, /setTimeout\(resolve, 250\)/);
  assert.equal((authScreen.match(/showSoftInputOnFocus=\{!isCloudE2E\}/g) ?? []).length, 2);
});

test('cloud auth avoids hosted keyboard and scroll responder lifecycles', () => {
  const authScreen = source('apps/enrollment/app/index.tsx');
  const shell = source('apps/enrollment/src/components/screen-shell.tsx');
  const env = source('apps/enrollment/src/lib/env.ts');

  assert.match(authScreen, /const isCloudE2E = process\.env\.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1'/);
  assert.match(authScreen, /void signInOrUp\(\{ email: cloudEmail, mode: 'sign-in', password: cloudPassword \}\)/);
  assert.match(shell, /const isCloudE2E = process\.env\.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1'/);
  assert.match(shell, /const scrollContent = isCloudE2E \? \(\s*content\s*\) : scroll \?/);
  assert.match(shell, /isCloudE2E \? \(\s*<View style=\{styles\.keyboard\}>\{scrollContent\}<\/View>/);
  assert.match(env, /allowCloudSimulatorLoopback: isCloudSimulatorE2E/);
  assert.match(shell, /<KeyboardAvoidingView/);
});

test('cloud enrollment keeps the required actions in the initial viewport', () => {
  const ticket = source('apps/enrollment/app/ticket.tsx');
  const consent = source('apps/enrollment/app/consent.tsx');
  const pass = source('apps/enrollment/app/pass.tsx');

  assert.match(ticket, /\{isCloudE2E \? createPassButton : null\}/);
  assert.match(ticket, /\{!isCloudE2E \? createPassButton : null\}/);
  assert.match(consent, /\{isCloudE2E \? consentButton : null\}/);
  assert.match(consent, /\{!isCloudE2E \? consentButton : null\}/);
  assert.doesNotMatch(pass, /\{isCloudE2E \? copyTokenButton : null\}/);
  assert.match(pass, /\{!isCloudE2E \? copyTokenButton : null\}/);
});

test('pass token auto-copy is cloud-only and manual copy remains production-only', () => {
  const passScreen = source('apps/enrollment/app/pass.tsx');

  assert.match(passScreen, /const isCloudE2E = process\.env\.EXPO_PUBLIC_FOCACCIA_CLOUD_E2E === '1'/);
  assert.match(passScreen, /const autoCopiedPassTokenRef = useRef<string \| null>\(null\)/);
  assert.match(
    passScreen,
    /useEffect\(\(\) => \{\s*if \(!isCloudE2E \|\| !passToken \|\| autoCopiedPassTokenRef\.current === passToken\) return;\s*autoCopiedPassTokenRef\.current = passToken;\s*void copyPassTokenToClipboard\(passToken, \(\) => undefined\);\s*\}, \[passToken\]\);/s,
  );
  assert.match(
    passScreen,
    /label="Copy full signed token"[\s\S]*void copyPassTokenToClipboard\(pass\.token, \(\) => setMessage\('Full signed token copied briefly\.'\)\)/,
  );
  assert.match(passScreen, /\{!isCloudE2E \? copyTokenButton : null\}/);
  assert.doesNotMatch(passScreen, /\{isCloudE2E \? copyTokenButton : null\}/);
});

test('cloud capture avoids the native scroll responder while production keeps scrolling', () => {
  const capture = source('apps/enrollment/app/capture.tsx');

  assert.match(capture, /const captureContent = \(/);
  assert.match(capture, /isCloudE2E \? \(\s*<View style=\{styles\.content\}>\{captureContent\}<\/View>/s);
  assert.match(capture, /<ScrollView[\s\S]*>\s*\{captureContent\}\s*<\/ScrollView>/);
  assert.match(capture, /styles\.cloudCameraStage/);
  assert.match(capture, /cloudCameraStage: \{ aspectRatio: 1\.45, maxHeight: 240 \}/);
});

test('enrollment production sources do not log sensitive values', () => {
  for (const file of [
    'apps/enrollment/src/lib/api.ts',
    'apps/enrollment/src/lib/pass-vault.ts',
    'apps/enrollment/src/lib/supabase.ts',
    'apps/enrollment/app/capture.tsx',
    'apps/enrollment/app/pass.tsx',
  ]) {
    assert.doesNotMatch(source(file), /console\.(?:log|debug|info|warn|error)/, file);
  }
});

test('manual fallback clipboard token is cleared after a short TTL', () => {
  const passScreen = source('apps/enrollment/app/pass.tsx');

  assert.match(passScreen, /PASS_TOKEN_CLIPBOARD_TTL_MS = 60_000/);
  assert.match(passScreen, /Clipboard\.getStringAsync\(\)/);
  assert.match(passScreen, /currentValue === token/);
  assert.match(passScreen, /Clipboard\.setStringAsync\(''\)/);
});

test('face capture keeps the native camera active while processing the photo request', () => {
  const captureScreen = source('apps/enrollment/app/capture.tsx');

  assert.match(captureScreen, /takePhoto\(\{\s*enableShutterSound: false\s*\}\)/);
  assert.match(captureScreen, /<Camera\b[^>]*isActive=\{true\}/s);
  assert.doesNotMatch(captureScreen, /<Camera\b[^>]*isActive=\{!isProcessing\}/s);
});

test('tracked FaceNet model matches the checked-in checksum manifest', () => {
  const manifest = source('apps/enrollment/assets/models/facenet_512.tflite.sha256').trim();
  const [expectedHash, filename] = manifest.split(/\s+/);
  const model = readFileSync(path.join(root, 'apps/enrollment/assets/models/facenet_512.tflite'));

  assert.equal(filename, 'facenet_512.tflite');
  assert.equal(createHash('sha256').update(model).digest('hex'), expectedHash);
});
