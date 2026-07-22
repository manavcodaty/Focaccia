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
