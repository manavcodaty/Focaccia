import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

for (const app of ['web', 'tickets']) {
  test(`${app} product components render status and counts without badges`, () => {
    for (const directory of ['app', 'components']) {
      const root = new URL(`../apps/${app}/${directory}/`, import.meta.url);
      for (const file of readdirSync(root, { recursive: true })) {
        if (!file.endsWith('.tsx') || file.startsWith(`ui${path.sep}`)) continue;
        const source = readFileSync(new URL(file, root), 'utf8');
        assert.doesNotMatch(source, /components\/ui\/badge|<\w*Badge\b|<StatusPill\b/, file);
      }
    }
  });
}
