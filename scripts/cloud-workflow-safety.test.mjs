import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('cloud workflow keeps mutable fixture and credentials out of uploaded artifacts', async () => {
  const workflow = await readFile(new URL('../.github/workflows/cloud-ios-full-flow.yml', import.meta.url), 'utf8');

  assert.match(workflow, /cloud-evidence-envelope\.mjs generate/);
  assert.match(workflow, /cloud-evidence-envelope\.mjs encrypt/);
  assert.match(workflow, /cloud-evidence-envelope\.mjs decrypt/);
  assert.match(workflow, /cloud-privacy-audit\.mjs/);
  assert.match(workflow, /--source-only true/);
  assert.match(workflow, /assemble-sc1-sc5-run-record\.mjs/);
  assert.match(workflow, /cloud-security-matrix\.ts/);
  assert.doesNotMatch(workflow, /BACKEND_ARTIFACT_DIR\/context\.json/);
  assert.doesNotMatch(workflow, /BACKEND_ARTIFACT_DIR\/network\.json/);
  assert.doesNotMatch(workflow, /gate-provisioning-qr\.png/);
  assert.doesNotMatch(workflow, /path: \|[\s\S]{0,240}focaccia-\*\.log/);
  assert.doesNotMatch(workflow, /path: .*recipient-private-key\.json/);
});
