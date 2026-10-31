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

test('theme mirrors the tickets/organizer shadcn neutral tokens', () => {
  const css = source('global.css');
  const theme = source('src/lib/theme.ts');

  assert.match(css, /@tailwind base;/);
  assert.match(css, /--background: 0 0% 100%;/);
  assert.match(css, /--foreground: 0 0% 3\.9%;/);
  assert.match(css, /--primary: 0 0% 9%;/);
  assert.match(css, /--muted-foreground: 0 0% 41\.1%;/);
  assert.match(css, /--border: 0 0% 89\.8%;/);
  assert.match(css, /--success: /);
  assert.match(css, /--warning: /);
  assert.match(css, /--radius: 0\.625rem;/);
  assert.match(theme, /export const NAV_THEME/);
  assert.match(theme, /primary: '#171717'/);
  assert.equal(existsSync(path.join(appRoot, 'src/theme.ts')), false, 'the warm-civic theme is retired');
});

test('React Native Reusables is configured the way its CLI expects', () => {
  const components = JSON.parse(source('components.json')) as { aliases: Record<string, string>; tailwind: { css: string } };
  const layout = source('app/_layout.tsx');
  const metro = source('metro.config.js');
  const babel = source('babel.config.cjs');

  assert.equal(components.aliases.ui, '@/components/ui');
  assert.equal(components.tailwind.css, 'global.css');
  assert.match(layout, /import '\.\.\/global\.css'/);
  assert.match(layout, /<PortalHost \/>/);
  assert.match(metro, /withNativeWind\(/);
  assert.match(metro, /inlineRem: 16/);
  assert.match(babel, /jsxImportSource: 'nativewind'/);
  assert.match(babel, /nativewind\/babel/);
  assert.match(source('tailwind.config.cjs'), /nativewind\/preset/);
  for (const name of ['alert', 'button', 'card', 'icon', 'input', 'label', 'separator', 'text']) {
    assert.ok(existsSync(path.join(appRoot, `src/components/ui/${name}.tsx`)), `${name} component`);
  }
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

test('every screen has exactly one page heading', () => {
  for (const file of screens) {
    assert.match(source(file), /variant="h1"/, file);
  }
  assert.match(source('src/components/section.tsx'), /variant="h2"/);
});

test('type scale and gutters are shared across every screen', () => {
  const allowed = new Set(['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-3xl', 'text-4xl', 'text-[15px]', 'text-[16px]']);
  for (const file of [...screens, ...tsx('src/components')]) {
    for (const match of source(file).matchAll(/\btext-(?:xs|sm|base|lg|xl|\dxl|\[\d+px\])\b/g)) {
      assert.ok(allowed.has(match[0]), `${file} uses off-scale ${match[0]}`);
    }
  }
  assert.match(source('src/components/screen-shell.tsx'), /px-5/);
  assert.match(source('src/components/screen-shell.tsx'), /gap-8/);
  assert.match(source('app/tickets.tsx'), /px-5/);
  assert.match(source('src/components/section.tsx'), /gap-3/);
});

test('redundant instructional copy and counters stay removed', () => {
  const removed = [
    'Attendee wallet',
    'Use your ticket account',
    'New to PrivatePass?',
    'Face processing stays on this phone',
    'Pull to refresh',
    'Only codes for this account',
    'Enter an owned claim code',
    'Claim a ticket online',
    'Credential state',
    'Privacy boundary',
    'Account recovery',
    'You can generate',
    'Keep this screen open',
    'Align your face',
    'Valid until',
    'Scanner recovery',
    'Saved securely on this phone',
    'Ticket closed',
    'Location to be confirmed',
    'Back to My tickets',
    'Please wait',
  ];
  for (const file of [...screens, ...appComponents]) {
    const code = source(file);
    for (const phrase of removed) {
      assert.ok(!code.includes(phrase), `${file} still says "${phrase}"`);
    }
    assert.doesNotMatch(code, /of 3|Generation \{|Generation \d/, `${file} shows a generation counter`);
  }
});

test('shell and controls preserve safe areas, touch size and accessible state', () => {
  const shell = source('src/components/screen-shell.tsx');
  const button = source('src/components/ui/button.tsx');

  assert.match(shell, /variant\?: 'camera'/);
  assert.match(shell, /SafeAreaView/);
  assert.match(button, /accessibilityState=\{\{ disabled: Boolean\(props\.disabled\) \}\}/);
  assert.match(button, /default: 'h-11 px-4'/);
  assert.doesNotMatch(button, /shadow/);
});

test('consent keeps the exact on-device and temporary-file disclosure', () => {
  const consent = source('app/consent.tsx');

  assert.match(consent, /on your iPhone|on-device/i);
  assert.match(consent, /Temporary captures are deleted best-effort/i);
  assert.match(consent, /Face images, embeddings, and unencrypted templates are not saved to your account/i);
});

test('the claim-code input comes first and owned tickets follow below it', () => {
  const tickets = source('app/tickets.tsx');
  const header = tickets.slice(tickets.indexOf('const header = ('), tickets.indexOf('const footer = ('));
  const footer = tickets.slice(tickets.indexOf('const footer = ('), tickets.indexOf('if (!session) return null;'));

  assert.ok(header.indexOf('<Section title="Claim code">') > header.indexOf('variant="h1">My tickets'), 'claim code sits under the page title');
  assert.ok(header.indexOf('<Text variant="h2">Tickets</Text>') > header.indexOf('accessibilityLabel="Claim code"'), 'tickets heading follows the input');
  assert.doesNotMatch(footer, /Claim code/, 'the input is no longer below the list');
  assert.match(footer, /<Section title="Account">/);
  assert.match(tickets, /ListHeaderComponent=\{header\}/);
  assert.match(tickets, /renderItem=\{renderTicket\}/);
});

test('regeneration is confirmed at the moment of action rather than explained up front', () => {
  for (const file of ['app/ticket.tsx', 'app/pass.tsx']) {
    assert.match(source(file), /Alert\.alert\('Regenerate pass\?'/, file);
  }
});
