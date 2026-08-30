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

test('cloud native relay uses simulator loopback instead of an ephemeral runner LAN address', async () => {
  const workflow = await readFile(new URL('../.github/workflows/cloud-ios-full-flow.yml', import.meta.url), 'utf8');

  assert.match(workflow, /LOCAL_HOST='127\.0\.0\.1'/);
  assert.match(workflow, /iOS Simulator shares the macOS host loopback/);
  assert.match(workflow, /EXPO_PUBLIC_FOCACCIA_CLOUD_E2E=1/);
});

test('cloud enrollment-to-gate handoff reads the auto-copied token without a final gesture', async () => {
  const script = await readFile(new URL('./cloud-ios-e2e.mjs', import.meta.url), 'utf8');
  const readyIndex = script.indexOf("await waitForNode(simulatorUdid, 'Pass ready'");
  const screenshotIndex = script.indexOf("await screenshot('enrollment-pass.png');", readyIndex);
  const clipboardIndex = script.indexOf('passToken = await readSimulatorClipboard(simulatorUdid);', screenshotIndex);
  const validationIndex = script.indexOf(
    'assert.match(passToken, /^[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+$/',
    clipboardIndex,
  );
  const terminateIndex = script.indexOf(
    "await runCommand('xcrun', ['simctl', 'terminate', simulatorUdid, enrollmentBundleId]);",
    validationIndex,
  );
  const launchIndex = script.indexOf('await launchGate();', terminateIndex);

  assert.ok(readyIndex >= 0, 'cloud script should wait for the ready pass');
  assert.ok(screenshotIndex > readyIndex, 'cloud script should capture the ready pass before handoff');
  assert.ok(clipboardIndex > screenshotIndex, 'cloud script should read the clipboard after the ready-pass screenshot');
  assert.ok(validationIndex > clipboardIndex, 'cloud script should validate the clipboard value');
  assert.ok(terminateIndex > validationIndex, 'cloud script should terminate Enrollment after clipboard validation');
  assert.ok(launchIndex > terminateIndex, 'cloud script should launch Gate after terminating Enrollment');
  assert.doesNotMatch(script, /tapAction\(\s*['"]Copy full signed token['"]/, 'cloud script must not tap the copy button');
  assert.doesNotMatch(script.slice(readyIndex, launchIndex), /tapAction\(/, 'pass-to-gate handoff must not use Baguette gestures');
});
