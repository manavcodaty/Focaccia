import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { captureGateState } from './lib/cloud-gate-evidence.mjs';
import { settleHostedInput } from './lib/cloud-input-retry.mjs';
import { createObservationRelay } from './lib/cloud-observation-relay.mjs';

import {
  describeUi,
  findNode,
  grantCameraAccess,
  installSimulatorApp,
  launchSimulatorApp,
  pasteIntoNode,
  readSimulatorClipboard,
  runCommand,
  takeSimulatorScreenshot,
  tapNode,
  typeIntoNode,
  waitForNode,
} from './lib/baguette-client.mjs';

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the native cloud E2E flow.`);
  return value;
}

const artifactDir = path.resolve(
  process.env.FOCACCIA_CLOUD_ARTIFACT_DIR ?? path.join(os.tmpdir(), 'focaccia-cloud-ios'),
);
const contextPath = path.resolve(
  process.env.FOCACCIA_CLOUD_CONTEXT_PATH ?? path.join(os.tmpdir(), 'focaccia-cloud-context.json'),
);
const simulatorUdid = requiredEnv('FOCACCIA_IOS_SIMULATOR_UDID');
const enrollmentAppPath = requiredEnv('FOCACCIA_ENROLLMENT_APP_PATH');
const gateAppPath = requiredEnv('FOCACCIA_GATE_APP_PATH');
const faceFixturePath = requiredEnv('FOCACCIA_FACE_FIXTURE_PATH');
const webUrl = requiredEnv('FOCACCIA_CLOUD_WEB_URL');
const faceFixtureSha256 = createHash('sha256').update(await readFile(faceFixturePath)).digest('hex');

const enrollmentBundleId = 'com.facepass.enrollment';
const gateBundleId = 'com.facepass.gate';
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const context = JSON.parse(await readFile(contextPath, 'utf8'));
const inputRetryEvents = [];
await mkdir(artifactDir, { recursive: true });

function artifact(name) {
  return path.join(artifactDir, name);
}

async function launchApp({ appLabel, bundleId, matcher, timeoutMs }) {
  await launchSimulatorApp(simulatorUdid, bundleId);

  // Hosted simulator SpringBoard can win the foreground race even after
  // simctl reports a successful launch. Give the app a short first window,
  // then activate its installed icon once before treating the launch as a
  // runtime failure.
  try {
    return await waitForNode(simulatorUdid, matcher, { timeoutMs: 8_000 });
  } catch (firstLaunchError) {
    try {
      const tree = await describeUi(simulatorUdid);
      if (findNode(tree, appLabel)) {
        await tapNode(simulatorUdid, appLabel, { timeoutMs: 5_000 });
      }
    } catch {
      // Preserve the original wait failure if the app is not visible on
      // SpringBoard or the accessibility bridge is transiently unavailable.
    }

    try {
      return await waitForNode(simulatorUdid, matcher, { timeoutMs: timeoutMs - 8_000 });
    } catch {
      throw firstLaunchError;
    }
  }
}

async function launchEnrollment() {
  await launchApp({
    appLabel: 'Face Pass Enrollment',
    bundleId: enrollmentBundleId,
    matcher: 'Sign in',
    timeoutMs: 60_000,
  });
}

async function launchGate() {
  await launchApp({
    appLabel: 'Face Pass Gate',
    bundleId: gateBundleId,
    matcher: /Prepare this gate|Open scanner|Set up gate/,
    timeoutMs: 90_000,
  });
}

async function captureCommandArtifact(name, command, args) {
  try {
    const result = await runCommand(command, args);
    await writeFile(artifact(name), `${result.stdout ?? ''}${result.stderr ?? ''}`);
  } catch (error) {
    await writeFile(artifact(name), `${error instanceof Error ? error.message : String(error)}\n`);
  }
}

async function captureSimulatorDiagnostics() {
  await Promise.all([
    captureCommandArtifact('native-simulator-apps.txt', 'xcrun', ['simctl', 'listapps', simulatorUdid]),
    captureCommandArtifact('native-simulator-log.txt', 'xcrun', [
      'simctl',
      'spawn',
      simulatorUdid,
      'log',
      'show',
      '--last',
      '5m',
      '--style',
      'compact',
      '--predicate',
      'process == "FacePassGate" OR process == "FacePassEnrollment" OR eventMessage CONTAINS[c] "FacePass" OR eventMessage CONTAINS[c] "React Native"',
    ]),
  ]);
}

async function screenshot(name) {
  await takeSimulatorScreenshot(simulatorUdid, artifact(name));
}

async function tapAction(matcher, options = {}) {
  return tapNode(simulatorUdid, matcher, {
    retryIfStillVisible: true,
    retryCount: 6,
    retryDelayMs: 500,
    ...options,
  });
}

async function fillInputExactly(matcher, value) {
  await settleHostedInput({
    expected: value, label: String(matcher),
    paste: () => pasteIntoNode(simulatorUdid, matcher, value, { press: false, replace: true, timeoutMs: 90_000 }),
    type: () => typeIntoNode(simulatorUdid, matcher, value, { replace: true, timeoutMs: 90_000 }),
    read: async () => findNode(await describeUi(simulatorUdid), matcher)?.value,
    record: async (event) => {
      inputRetryEvents.push(event);
      await writeFile(artifact('input-retries.json'), JSON.stringify({ attempts: inputRetryEvents }, null, 2)+'\n');
    },
  });
}

function accessibilityNodeText(node) {
  return [node?.label, node?.title, node?.value, node?.identifier]
    .filter((value) => typeof value === 'string')
    .join(' ')
    .trim();
}

function containsMetric(tree, label, value) {
  const expectedLabel = label.trim().toLowerCase();
  const expectedValue = String(value).trim().toLowerCase();

  const visit = (node) => {
    if (!node || node.hidden) return false;
    const ownText = accessibilityNodeText(node).replace(/\s+/g, ' ').toLowerCase();
    if (
      ownText === `${expectedLabel}: ${expectedValue}`
      || ownText === `${expectedLabel} ${expectedValue}`
    ) {
      return true;
    }

    const children = Array.isArray(node.children) ? node.children.filter((child) => !child?.hidden) : [];
    for (let index = 0; index < children.length - 1; index += 1) {
      const childText = accessibilityNodeText(children[index]).toLowerCase();
      const nextText = accessibilityNodeText(children[index + 1]).toLowerCase();
      if ((childText === expectedLabel || childText === `${expectedLabel}:`) && nextText === expectedValue) {
        return true;
      }
    }

    return children.some(visit);
  };

  return visit(tree?.tree ?? tree);
}

async function waitForMetric(label, value, { timeoutMs = 60_000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      if (containsMetric(await describeUi(simulatorUdid), label, value)) return;
    } catch {
      // Keep polling while the hosted accessibility tree settles.
    }
    await sleep(300);
  }
  throw new Error(`Timed out waiting for ${label}: ${value}.`);
}

async function fillStableBrowserInput(page, locator, value, label) {
  let stableChecks = 0;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await locator.fill(value);
    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      if ((await locator.inputValue()) === value) {
        stableChecks += 1;
        if (stableChecks >= 8) return;
      } else {
        stableChecks = 0;
      }
      await page.waitForTimeout(250);
    }
  }

  assert.equal(await locator.inputValue(), value, `${label} should retain its value after hydration`);
}

async function fillOrganizerBrowserLogin(page) {
  await page.locator('form button[type="submit"]').waitFor({ state: 'visible', timeout: 45_000 });
  const emailInput = page.getByLabel('Email', { exact: true });
  const passwordInput = page.getByLabel('Password', { exact: true });

  // The tunneled Next.js auth card can re-render its controlled email input
  // while the password field receives focus. Reassert both values together
  // immediately before submission so the auth request cannot observe a
  // transient empty or stale field.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await fillStableBrowserInput(page, emailInput, context.organizerEmail, 'organizer email');
    await fillStableBrowserInput(page, passwordInput, context.organizerPassword, 'organizer password');
    await emailInput.fill(context.organizerEmail);
    await emailInput.press('Tab');
    await page.waitForTimeout(250);
    if (
      (await emailInput.inputValue()) === context.organizerEmail
      && (await passwordInput.inputValue()) === context.organizerPassword
    ) {
      return;
    }
  }

  assert.equal(await emailInput.inputValue(), context.organizerEmail, 'organizer email should be present before submit');
  assert.equal(await passwordInput.inputValue(), context.organizerPassword, 'organizer password should be present before submit');
}

async function main() {
  const startedAt = new Date().toISOString();
  const extendedEvidence = process.env.FOCACCIA_FRESH_SIMULATOR_STATE === '1';
  const extraArtifacts = [];
  const relay = createObservationRelay({
    bindHost: requiredEnv('FOCACCIA_CLOUD_LOCAL_HOST'),
    upstreamUrl: requiredEnv('FOCACCIA_SUPABASE_UPSTREAM_URL'),
  });
  let gateIdentity = null;
  let beforeRestart = null;
  let originalGateTime = null;
  let passId = null;
  let duplicateSync = null;
  const securityTimes = {};
  const securityAttempts = {};
  await installSimulatorApp(simulatorUdid, enrollmentAppPath);
  await installSimulatorApp(simulatorUdid, gateAppPath);
  await grantCameraAccess(simulatorUdid, enrollmentBundleId);
  await grantCameraAccess(simulatorUdid, gateBundleId);

  const checks = {
    camera_image_source_started: false,
    dashboard_checked_in: false,
    enrollment_pass_issued: false,
    enrollment_camera_capture_completed: false,
    gate_provisioned: false,
    gate_liveness_capture_accepted: false,
    provisioning_payload_injected: false,
    revocation_cache_fresh: false,
    offline_acceptance: false,
    offline_queue_observed: false,
    queue_persisted_after_restart: false,
    replay_rejected: false,
    reconnect_sync: false,
  };
  let failure = null;
  if (extendedEvidence) {
    Object.assign(checks, {
      organizer_event_created: context.browserChecks?.organizer_event_created === true,
      event_listed: context.browserChecks?.event_listed === true,
      attendee_authenticated: context.browserChecks?.attendee_account_created === true,
      ticket_claimed: Boolean(context.ticketId) && context.browserChecks?.claim_code_format_valid === true,
      owned_ticket_recovered: context.ownedTicketRecovered === true,
      foreign_ticket_rejected: context.foreignTicketRejected === true,
    });
    for (const scenario of ['tampered','wrong_event','expired','revoked_after_refresh']) checks[`security_${scenario}`] = false;
  }

  try {
    await relay.start();
    if (extendedEvidence) {
      const container = (await runCommand('xcrun', ['simctl', 'get_app_container', simulatorUdid, gateBundleId, 'data'])).stdout.trim();
      const documents = path.join(container, 'Documents');
      await mkdir(documents, { recursive: true });
      const payload = JSON.stringify(context.provisioningPayload);
      await writeFile(path.join(documents, 'cloud-e2e-provisioning.json'), payload, { mode: 0o600 });
      await writeFile(artifact('runtime-provisioning.json'), JSON.stringify({ run_id: context.runId, event_id: context.eventId, transport: 'runner_written_app_documents_fixture', payload_sha256: createHash('sha256').update(payload).digest('hex'), raw_payload_in_receipt: false }, null, 2)+'\n');
      extraArtifacts.push('runtime-provisioning.json');
    }
    // Gate provisioning must precede enrollment: the server will not issue a
    // pass until the event has a bound gate public key.
    await launchGate();
    await tapNode(simulatorUdid, 'Set up gate', {
      // Hosted simulators can occasionally deliver the first HID tap while
      // the React Native ScrollView is still settling after launch. If the
      // button remains visible, retry the same semantic tap before waiting
      // for the credential screen.
      retryIfStillVisible: true,
      retryCount: 5,
      retryDelayMs: 400,
    });
    // The submit button is intentionally disabled until both fields contain
    // credentials, and waitForNode ignores disabled controls. Wait for the
    // enabled first field before injecting the credentials, then wait for the
    // button to become enabled as a postcondition of the two credential inputs.
    await waitForNode(simulatorUdid, 'Organizer email', { timeoutMs: 90_000 });
    // Enter the email through the simulator keyboard, then explicitly dismiss
    // the keyboard before targeting the second field. Hosted iOS simulators
    // can otherwise deliver the second field tap to the first TextInput while
    // the keyboard is still settling, inserting the password into the email.
    await fillInputExactly('Organizer email', context.organizerEmail);
    await runCommand('baguette', ['key', '--udid', simulatorUdid, '--code', 'Escape']);
    await fillInputExactly('Organizer password', context.organizerPassword);
    await waitForNode(simulatorUdid, 'Sign in organizer', { timeoutMs: 30_000 });
    // A software keyboard can still own the lower part of the screen after
    // the short Baguette typing session closes. Escape it before tapping the
    // submit button, then retry if the hosted HID tap was consumed by the
    // keyboard transition instead of the React Native button.
    await runCommand('baguette', ['key', '--udid', simulatorUdid, '--code', 'Escape']);
    await tapNode(simulatorUdid, 'Sign in organizer', {
      retryIfStillVisible: true,
      retryCount: 5,
      retryDelayMs: 500,
    });
    await waitForNode(simulatorUdid, 'Provision this gate', { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, 'Provision this gate', {
      retryIfStillVisible: true,
      retryCount: 8,
      retryDelayMs: 600,
      timeoutMs: 120_000,
    });
    await waitForNode(simulatorUdid, 'Scanner live', { timeoutMs: 120_000 });
    checks.gate_provisioned = true;
    checks.provisioning_payload_injected = true;
    await screenshot('gate-provisioned.png');
    if (extendedEvidence) {
      const state = await captureGateState(simulatorUdid, artifact('gate-provisioned-state.json'));
      gateIdentity = state.snapshot;
      extraArtifacts.push('gate-provisioned-state.json');
    }

    await launchEnrollment();

    await fillInputExactly('Email', context.attendeeEmail);
    await runCommand('baguette', ['key', '--udid', simulatorUdid, '--code', 'Escape']);
    await fillInputExactly('Password', context.attendeePassword);
    await runCommand('baguette', ['key', '--udid', simulatorUdid, '--code', 'Escape']);
    await tapNode(simulatorUdid, 'Sign in', {
      retryIfStillVisible: true,
      retryCount: 5,
      retryDelayMs: 500,
    });
    await waitForNode(simulatorUdid, 'My tickets', { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, new RegExp(context.eventName), {
      retryIfStillVisible: true,
      retryCount: 6,
      retryDelayMs: 500,
      timeoutMs: 90_000,
    });
    await waitForNode(simulatorUdid, 'Create event pass', { timeoutMs: 90_000 });
    await tapAction('Create event pass');
    await waitForNode(simulatorUdid, 'I consent and continue', { timeoutMs: 90_000 });
    await tapAction('I consent and continue');
    await waitForNode(simulatorUdid, 'Capture and issue pass', { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, 'Cloud E2E image source ready', { timeoutMs: 120_000 });
    checks.camera_image_source_started = true;
    await tapAction('Capture and issue pass', { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, 'Pass ready', { timeoutMs: 180_000 });
    checks.enrollment_pass_issued = true;
    checks.enrollment_camera_capture_completed = true;
    await screenshot('enrollment-pass.png');

    let passToken = '';
    const clipboardReads = [];
    const signedTokenShape = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      // Copy keeps its button visible. Generic repeat-until-hidden tapping
      // can outlast the clipboard TTL and let an earlier copy timer clear it.
      await tapNode(simulatorUdid, 'Copy full signed token', { retryIfStillVisible: false });
      passToken = await readSimulatorClipboard(simulatorUdid, { timeoutMs: 10_000, accept: (value) => signedTokenShape.test(value) });
      clipboardReads.push({ attempt, observed_at: new Date().toISOString(), signed_token_read: signedTokenShape.test(passToken), token_retained: false });
      if (passToken) break;
    }
    await writeFile(artifact('clipboard-read.json'), JSON.stringify({ attempts: clipboardReads }, null, 2)+'\n');
    extraArtifacts.push('clipboard-read.json');
    assert.ok(signedTokenShape.test(passToken), 'Enrollment copy did not yield a signed pass token after three bounded attempts; token value withheld.');
    await waitForNode(simulatorUdid, /Full signed token copied briefly/);
    if (extendedEvidence) passId = JSON.parse(Buffer.from(passToken.split('.')[0], 'base64url').toString('utf8')).pass_id;

    await launchGate();
    await tapAction('Open scanner', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, /Offline ready/, { timeoutMs: 90_000 });
    checks.revocation_cache_fresh = true;
    await waitForNode(simulatorUdid, 'Manual fallback', { timeoutMs: 90_000 });
    await tapAction('Manual fallback');
    await fillInputExactly(/^Full pass token\b/, passToken);
    const offlineNetwork = await relay.disconnect();
    if (extendedEvidence) {
      checks.decision_backend_unreachable = true;
      securityAttempts.genuine_unused = true;
      await writeFile(artifact('network-state.json'), JSON.stringify(offlineNetwork, null, 2)+'\n');
      extraArtifacts.push('network-state.json');
    }
    await tapAction('Verify token offline', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, 'Capture and verify attendee', { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, 'Cloud E2E image source ready', { timeoutMs: 120_000 });
    await tapAction('Capture and verify attendee', { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, /^Entry accepted\b/, { timeoutMs: 180_000 });
    checks.gate_liveness_capture_accepted = true;
    checks.offline_acceptance = true;
    securityTimes.genuine_unused = new Date().toISOString();
    await screenshot('gate-entry-accepted-offline.png');
    await tapAction('Home');
    await waitForNode(simulatorUdid, /Sync pending/ , { timeoutMs: 90_000 });
    await tapAction('Settings');
    await waitForMetric('Pending check-ins', 1, { timeoutMs: 90_000 });
    checks.offline_queue_observed = true;
    await screenshot('gate-sync-pending.png');
    if (extendedEvidence) {
      beforeRestart = await captureGateState(simulatorUdid, artifact('queue-before-restart.json'));
      assert.equal(beforeRestart.snapshot.queue.filter((row) => row.status === 'pending').length, 1);
      originalGateTime = beforeRestart.snapshot.queue[0].gate_timestamp;
      extraArtifacts.push('queue-before-restart.json');
    }

    // A restart must retain the durable offline queue before connectivity is restored.
    await launchGate();
    await tapAction('Settings', { timeoutMs: 90_000 });
    await waitForMetric('Pending check-ins', 1, { timeoutMs: 30_000 });
    checks.queue_persisted_after_restart = true;
    await screenshot('gate-sync-persisted-after-restart.png');
    if (extendedEvidence) {
      const afterRestart = await captureGateState(simulatorUdid, artifact('queue-after-restart.json'));
      assert.equal(afterRestart.snapshot.queue.filter((row) => row.status === 'pending').length, 1);
      assert.equal(afterRestart.snapshot.queue[0].gate_timestamp, originalGateTime);
      extraArtifacts.push('queue-after-restart.json');
    }

    // Reusing the accepted token while still offline must be rejected locally.
    securityAttempts.replay = true;
    await tapAction('Back');
    await waitForNode(simulatorUdid, 'Open scanner', { timeoutMs: 90_000 });
    await tapAction('Open scanner');
    await tapAction('Manual fallback', { timeoutMs: 90_000 });
    await fillInputExactly(/^Full pass token\b/, passToken);
    await runCommand('baguette', ['key', '--udid', simulatorUdid, '--code', 'Escape']);
    await tapAction('Verify token offline', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, /^Entry rejected\b/, { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, /REPLAY_USED/, { timeoutMs: 30_000 });
    checks.replay_rejected = true;
    securityTimes.replay = new Date().toISOString();
    await screenshot('gate-replay-rejected-offline.png');
    await tapAction('Home');

    if (extendedEvidence) {
      assert.equal(context.securityControls?.length, 4, 'Expected four isolated authenticated security-control fixtures.');
      for (const control of context.securityControls) {
        securityAttempts[control.scenario] = true;
        await tapAction('Open scanner', { timeoutMs: 90_000 });
        await tapAction('Manual fallback', { timeoutMs: 90_000 });
        await fillInputExactly(/^Full pass token\b/, control.token);
        await runCommand('baguette', ['key', '--udid', simulatorUdid, '--code', 'Escape']);
        await tapAction('Verify token offline', { timeoutMs: 90_000 });
        await waitForNode(simulatorUdid, /^Entry rejected\b/, { timeoutMs: 90_000 });
        await waitForNode(simulatorUdid, new RegExp(`\\b${control.expected_reason}\\b`), { timeoutMs: 30_000 });
        checks[`security_${control.scenario}`] = true;
        securityTimes[control.scenario] = new Date().toISOString();
        const image = `gate-${control.scenario}-rejected-offline.png`;
        await screenshot(image); extraArtifacts.push(image);
        await tapAction('Home');
      }
      const securityState = await captureGateState(simulatorUdid, artifact('security-control-state.json'));
      assert.equal(securityState.snapshot.queue.filter((row) => row.status === 'pending').length, 1, 'Rejected controls must not create accepted check-ins.');
      for (const control of context.securityControls) {
        assert.ok(securityState.snapshot.logs.some((row) => row.pass_id === control.pass_id && row.outcome === 'REJECT' && row.reason_code === control.expected_reason), 'Each security rejection must have a matching durable gate log.');
      }
      assert.ok(securityState.snapshot.revocations.some((row) => row.pass_id === context.securityControls.find((item) => item.scenario === 'revoked_after_refresh').pass_id), 'Revoked control must actually be present in the refreshed cache.');
      extraArtifacts.push('security-control-state.json');
    }

    await relay.start();
    await tapAction('Settings', { timeoutMs: 90_000 });
    // Restoring connectivity can trigger the app's automatic foreground sync
    // before the explicit retry below. Queue persistence was already proven
    // while offline, so accept either intermediate state here and assert the
    // synchronized confirmation plus a clear queue as the reconnect result.
    await waitForNode(simulatorUdid, /Queue clear|Sync pending/, { timeoutMs: 30_000 });
    await tapAction('Retry check-in synchronization', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, /Check-in queue and revocation cache synchronized\./, { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, 'Queue clear', { timeoutMs: 90_000 });
    checks.reconnect_sync = true;
    await screenshot('gate-sync-complete.png');
    if (extendedEvidence) {
      const afterSync = await captureGateState(simulatorUdid, artifact('queue-after-reconnect.json'));
      assert.equal(afterSync.snapshot.queue.filter((row) => row.status === 'pending').length, 0);
      assert.equal(afterSync.snapshot.queue.filter((row) => row.status === 'synced').length, 1);
      const signedRequest = beforeRestart.signedRequests[0];
      securityAttempts.duplicate_synchronization = true;
      const response = await fetch(`http://${requiredEnv('FOCACCIA_CLOUD_LOCAL_HOST')}:54331/functions/v1/record-gate-checkin`, {
        method: 'POST', headers: { apikey: requiredEnv('FOCACCIA_CLOUD_ANON_KEY'), 'Content-Type': 'application/json' }, body: JSON.stringify(signedRequest), signal: AbortSignal.timeout(15_000),
      });
      const body = await response.json();
      assert.equal(response.status, 200, 'An identical signed retry must return an idempotent response.');
      assert.equal(body?.data?.idempotent_replay, true);
      duplicateSync = { http_status: response.status, idempotent_replay: true, observed_at: new Date().toISOString() };
      securityTimes.duplicate_synchronization = duplicateSync.observed_at;
      await writeFile(artifact('duplicate-sync.json'), JSON.stringify(duplicateSync, null, 2)+'\n');
      extraArtifacts.push('queue-after-reconnect.json', 'duplicate-sync.json');
    }

    const browser = await chromium.launch({
      ...(process.env.FOCACCIA_BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.FOCACCIA_BROWSER_EXECUTABLE_PATH } : { channel: 'chrome' }),
      headless: true,
    });
    const page = await browser.newPage({ viewport: { height: 1000, width: 1440 } });
    try {
      await page.goto(`${webUrl}/login`, { waitUntil: 'domcontentloaded' });
      await fillOrganizerBrowserLogin(page);
      await page.locator('form button[type="submit"]').click();
      await page.waitForURL(/\/dashboard(?:\?.*)?$/, {
        timeout: 45_000,
        waitUntil: 'domcontentloaded',
      });
      await page.goto(`${webUrl}/events/${context.eventId}`, { waitUntil: 'domcontentloaded' });
      const summary = page.locator('section[aria-label="Ticket state summary"]');
      await summary.getByText('Checked in', { exact: true }).waitFor({ state: 'visible', timeout: 45_000 });
      await page.getByText('Fresh signed receipt', { exact: true }).waitFor({ state: 'visible', timeout: 45_000 });
      await summary.locator('div').filter({ hasText: 'Checked in' }).getByText('1', { exact: true }).waitFor({ state: 'visible', timeout: 45_000 });
      await page.screenshot({ path: artifact('organizer-dashboard-checked-in.png'), fullPage: true });
      checks.dashboard_checked_in = true;
    } finally {
      await page.context().close();
      await browser.close();
    }
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
    throw error;
  } finally {
    await relay.close();
    const artifacts = [
        'gate-provisioned.png',
        'enrollment-pass.png',
        'gate-entry-accepted-offline.png',
        'gate-sync-pending.png',
        'gate-sync-persisted-after-restart.png',
        'gate-replay-rejected-offline.png',
        'gate-sync-complete.png',
        'organizer-dashboard-checked-in.png',
      ];
    artifacts.push(...extraArtifacts);
    if (failure) {
      await Promise.allSettled([
        takeSimulatorScreenshot(simulatorUdid, artifact('native-failure.png')),
        describeUi(simulatorUdid).then((tree) => writeFile(
          artifact('native-failure-ui.json'),
          `${JSON.stringify(tree, null, 2)}\n`,
        )),
        captureSimulatorDiagnostics(),
      ]);
      artifacts.push(
        'native-failure.png',
        'native-failure-ui.json',
        'native-simulator-apps.txt',
        'native-simulator-log.txt',
      );
    }
    if (inputRetryEvents.length) artifacts.push('input-retries.json');
    const evidence = {
      checks,
      commit_sha: process.env.GITHUB_SHA ?? null,
      event_id: context.eventId,
      face_fixture_sha256: faceFixtureSha256,
      fixture_sha256: faceFixtureSha256,
      runtime_failure: failure,
      failure: failure ?? 'Native flow and security controls completed; the central privacy audit remains waived/not tested.',
      status: failure ? 'FAIL' : 'PARTIAL',
      network_loss_method: 'stopped_macOS_relay',
      provisioning_mode: 'e2e_payload_injection',
      runtime_provisioning_transport: extraArtifacts.includes('runtime-provisioning.json') ? 'runner_written_app_documents_fixture' : null,
      provisioning_qr_camera_scan: false,
      run_id: context.runId,
      runner_os: process.env.RUNNER_OS ?? null,
      started_at: startedAt,
      workflow_run_url: process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
      ticket_id: context.ticketId ?? null,
      organizer_id_hash: context.organizerIdHash ?? null,
      attendee_id_hash: context.attendeeIdHash ?? null,
      gate_device_id: gateIdentity?.gate_device_id ?? null,
      gate_key_fingerprint: gateIdentity?.gate_key_fingerprint ?? null,
      pass_id: passId,
      fresh_simulator_state: extendedEvidence,
      mutable_state_isolated: extendedEvidence,
      original_gate_time: originalGateTime,
      duplicate_sync: duplicateSync,
      security_matrix: [
        ['genuine_unused', checks.offline_acceptance, 'ACCEPT', 'ACCEPT'],
        ['replay', checks.replay_rejected, 'REJECT', 'REPLAY_USED'],
        ['tampered', checks.security_tampered === true, 'REJECT', 'BAD_SIGNATURE'],
        ['wrong_event', checks.security_wrong_event === true, 'REJECT', 'WRONG_EVENT'],
        ['expired', checks.security_expired === true, 'REJECT', 'EXPIRED'],
        ['revoked_after_refresh', checks.security_revoked_after_refresh === true, 'REJECT', 'REVOKED'],
        ['duplicate_synchronization', duplicateSync?.idempotent_replay === true, 'NO_DUPLICATE_BACKEND_ROW', 'IDEMPOTENT_REPLAY'],
      ].map(([scenario, passed, expected, reason]) => ({
        scenario, status: passed ? 'PASS' : securityAttempts[scenario] ? 'FAIL' : 'NOT_TESTED',
        input_identity: securityAttempts[scenario] ? context.securityControls?.find((item) => item.scenario === scenario)?.pass_id ?? passId : null,
        fixture_origin: context.securityControls?.find((item) => item.scenario === scenario)?.fixture_origin ?? 'Actual enrolled pass and signed synchronization request.',
        expected, observed: passed ? expected : null, reason_code: passed ? reason : null,
        timestamp: securityTimes[scenario] ?? null,
        backend_consequence: 'Requires the separate per-run authoritative backend artifact; not inferred from UI.',
        reason: passed ? null : securityAttempts[scenario] ? 'Attempt did not satisfy its assertion; see native failure evidence.' : 'Authenticated control fixture not implemented by this workflow; no pass claim.',
        workflow_run_url: process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
        raw_artifact_paths: ['native-report.json'],
      })),
      privacy_audit: {
        status: 'NOT_TESTED',
        reason: 'Owner waived the privacy dispatch blocker; this is not evidence that schema, rows, API payloads, logs, CSV and retained artifacts passed a full audit.',
        encrypted_payload_classification: 'Event-specific encrypted gate-bound biometric-derived ciphertext; not described as no biometric bytes.',
      },
      stale_revocation_cache_limitation: 'A disconnected gate cannot learn later remote revocations until a successful refresh. The revoked control was seeded before the fresh snapshot; it is not an instant-revocation claim.',
    };
    await Promise.all([
      writeFile(artifact('native-report.json'), `${JSON.stringify(evidence, null, 2)}\n`),
      writeFile(artifact('evidence-manifest.json'), `${JSON.stringify({
        ...evidence,
        artifacts,
      }, null, 2)}\n`),
    ]);
  }

  assert.deepEqual(Object.values(checks), Array(Object.keys(checks).length).fill(true), 'The native cloud flow did not complete every acceptance stage.');
  console.log(JSON.stringify(checks));
}

await main();
