import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const appRoot = path.join(import.meta.dirname, '..');

function source(relativePath: string) {
  return readFileSync(path.join(appRoot, relativePath), 'utf8');
}

function tsx(relativeDir: string): string[] {
  return readdirSync(path.join(appRoot, relativeDir), { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) return tsx(relativePath);
    return entry.name.endsWith('.tsx') ? [relativePath] : [];
  });
}

const screens = tsx('app').filter((file) => !file.endsWith('_layout.tsx'));
const appComponents = tsx('src/components').filter((file) => !file.includes(`${path.sep}ui${path.sep}`));

test('gate theme mirrors the tickets/organizer shadcn neutral tokens', () => {
  const css = source('global.css');

  assert.match(css, /--primary: 0 0% 9%;/);
  assert.match(css, /--muted-foreground: 0 0% 41\.1%;/);
  assert.match(css, /--success: /);
  assert.match(css, /--destructive: /);
  assert.match(css, /--radius: 0\.625rem;/);
  assert.match(source('src/lib/theme.ts'), /export const NAV_THEME/);
  assert.equal(existsSync(path.join(appRoot, 'src/theme.ts')), false, 'the warm-civic theme is retired');
});

test('gate shares the enrollment app Reusables components exactly', () => {
  const enrollmentUi = path.join(appRoot, '../enrollment/src/components/ui');
  for (const file of readdirSync(enrollmentUi)) {
    assert.equal(source(`src/components/ui/${file}`), readFileSync(path.join(enrollmentUi, file), 'utf8'), file);
  }
  assert.match(source('app/_layout.tsx'), /<PortalHost \/>/);
  assert.match(source('metro.config.js'), /withNativeWind\(/);
  assert.match(source('babel.config.js'), /jsxImportSource: 'nativewind'/);
});

test('gate shell supports operational wide and decision modes', () => {
  const shell = source('src/components/screen-shell.tsx');

  assert.match(shell, /variant\?:[^;]*'scanner'/s);
  assert.match(shell, /'accepted'/);
  assert.match(shell, /'rejected'/);
  assert.match(shell, /bg-success\/10/);
  assert.match(shell, /bg-destructive\/10/);
  assert.match(shell, /SafeAreaView/);
});

test('gate home leads with readiness vocabulary and the scanner action', () => {
  const home = source('app/index.tsx');
  const presentation = source('src/lib/gate-presentation.ts');

  assert.match(home, /gateReadiness\(/);
  assert.match(home, /syncStatus\(/);
  assert.match(home, /Open scanner/);
  assert.match(presentation, /Offline ready/);
  assert.match(presentation, /Refresh required/);
  assert.match(presentation, /Needs setup/);
  assert.match(presentation, /Sync pending/);
});

test('screens are composed only from Reusables primitives, never raw text or touchables', () => {
  for (const file of [...screens, ...appComponents]) {
    const code = source(file);
    const rnImport = code.match(/import \{([^}]*)\} from 'react-native';/)?.[1] ?? '';
    for (const primitive of ['Text', 'TextInput', 'Pressable', 'TouchableOpacity', 'Button']) {
      assert.doesNotMatch(rnImport, new RegExp(`\\b${primitive}\\b`), `${file} imports ${primitive} from react-native`);
    }
    assert.doesNotMatch(code, /StyleSheet\.create/, `${file} styles with tokens, not StyleSheet`);
    assert.doesNotMatch(code, /#[0-9a-fA-F]{3,8}\b/, `${file} hard-codes a colour`);
    assert.doesNotMatch(code, /uppercase|letterSpacing/, `${file} has an eyebrow label`);
  }
});

test('every screen has a page heading, with Provisioning named as such', () => {
  for (const file of screens) {
    assert.match(source(file), /variant="h1"/, file);
  }
  assert.match(source('app/provision.tsx'), /<Text variant="h1">Provisioning<\/Text>/);
});

test('type scale and gutters are shared across every screen', () => {
  const allowed = new Set(['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-3xl', 'text-4xl', 'text-[15px]']);
  for (const file of [...screens, ...tsx('src/components')]) {
    for (const match of source(file).matchAll(/\btext-(?:xs|sm|base|lg|xl|\dxl|\[\d+px\])\b/g)) {
      assert.ok(allowed.has(match[0]), `${file} uses off-scale ${match[0]}`);
    }
  }
  assert.match(source('src/components/screen-shell.tsx'), /px-5/);
  assert.match(source('src/components/screen-shell.tsx'), /gap-8/);
});

test('redundant instructional copy, chips and technical rows stay removed', () => {
  const removed = [
    'Gate operations',
    'Offline entry. Automatic sync.',
    'Scan an attendee pass',
    'Scanner live',
    'Single-entry enforced',
    'Ask the attendee to look at the camera',
    'Ready for a clear frame',
    'single face capture',
    'Gate keys stay on this phone',
    'Pair this device to one event',
    'PK_SIGN_EVENT',
    'EVENT_SALT',
    'Signer key',
    'Event salt',
    'Operator note',
    'Gate decision',
    'Paste the full pass token. Short queue codes',
    'Gate decisions and timings. No face data.',
    'Checks run offline.',
    'Back to readiness',
    'Back to scanner',
  ];
  for (const file of [...screens, ...appComponents]) {
    const code = source(file);
    for (const phrase of removed) {
      assert.ok(!code.includes(phrase), `${file} still says "${phrase}"`);
    }
  }
});

test('result timings are progressive disclosure, not the default view', () => {
  const result = source('app/result.tsx');

  assert.match(result, /<Collapsible /);
  assert.match(result, /useState\(false\)/);
});
