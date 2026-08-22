import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

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
const proxyPidPath = requiredEnv('FOCACCIA_PROXY_PID_FILE');
const faceFixtureSha256 = createHash('sha256').update(await readFile(faceFixturePath)).digest('hex');

const enrollmentBundleId = 'com.facepass.enrollment';
const gateBundleId = 'com.facepass.gate';
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const context = JSON.parse(await readFile(contextPath, 'utf8'));
await mkdir(artifactDir, { recursive: true });

function artifact(name) {
  return path.join(artifactDir, name);
}

async function waitForProxyState(expected) {
  const healthUrl = `${process.env.FOCACCIA_PROXY_HEALTH_URL ?? 'http://127.0.0.1:54331/.focaccia/health'}`;
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(healthUrl);
      if (expected ? response.ok : !response.ok) return;
    } catch {
      if (!expected) return;
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  throw new Error(`Timed out waiting for local Supabase proxy to become ${expected ? 'available' : 'unavailable'}.`);
}

async function stopLocalProxy() {
  const pid = Number((await readFile(proxyPidPath, 'utf8')).trim());
  assert.ok(Number.isInteger(pid) && pid > 1, `Invalid proxy PID in ${proxyPidPath}.`);
  process.kill(pid, 'SIGTERM');
  await waitForProxyState(false);
}

async function restartLocalProxy() {
  const localHost = requiredEnv('FOCACCIA_CLOUD_LOCAL_HOST');
  const upstreamUrl = requiredEnv('FOCACCIA_SUPABASE_UPSTREAM_URL');
  const child = spawn(process.execPath, ['scripts/lan-supabase-proxy.mjs'], {
    cwd: process.cwd(),
    detached: true,
    env: {
      ...process.env,
      FOCACCIA_ALLOWED_BROWSER_ORIGINS: [
        `http://${localHost}:3000`,
        `http://${localHost}:3001`,
        'http://127.0.0.1:3000',
        'http://127.0.0.1:3001',
      ].join(','),
      FOCACCIA_LAN_PROXY_PORT: '54331',
      FOCACCIA_LOCAL_HOST: localHost,
      FOCACCIA_SUPABASE_UPSTREAM_URL: upstreamUrl,
    },
    stdio: 'ignore',
  });
  child.unref();
  await writeFile(proxyPidPath, `${child.pid}\n`, { mode: 0o600 });
  await chmod(proxyPidPath, 0o600);
  await waitForProxyState(true);
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
  let observedLength = 0;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    await pasteIntoNode(simulatorUdid, matcher, value, {
      press: false,
      replace: true,
      timeoutMs: 90_000,
    });

    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      try {
        const node = findNode(await describeUi(simulatorUdid), matcher);
        if (typeof node?.value === 'string') {
          observedLength = node.value.length;
          if (node.value === value) return;
        }
      } catch {
        // Keep polling while the hosted accessibility tree settles after paste.
      }
      await sleep(150);
    }
  }

  throw new Error(`Hosted input did not settle to the expected value for ${String(matcher)} (observed ${observedLength} characters).`);
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

async function readCloudE2EToken() {
  const prefix = 'Cloud E2E signed token ';
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    try {
      const node = findNode(await describeUi(simulatorUdid), new RegExp(`^${prefix}`));
      const raw = [node?.label, node?.value, node?.title]
        .find((value) => typeof value === 'string' && value.startsWith(prefix));
      if (raw) return raw.slice(prefix.length);
    } catch {
      // Keep polling while the hosted accessibility tree settles after copy.
    }
    await sleep(150);
  }

  return '';
}

async function main() {
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

  try {
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

    await tapAction('Copy full signed token');
    await waitForNode(simulatorUdid, /Full signed token copied briefly/);
    const passToken = await readCloudE2EToken() || await readSimulatorClipboard(simulatorUdid);
    assert.match(passToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'Enrollment should copy a signed pass token.');

    await launchGate();
    await tapAction('Open scanner', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, /Offline ready/, { timeoutMs: 90_000 });
    checks.revocation_cache_fresh = true;
    await waitForNode(simulatorUdid, 'Manual fallback', { timeoutMs: 90_000 });
    await tapAction('Manual fallback');
    await pasteIntoNode(simulatorUdid, /^Full pass token\b/, passToken, { timeoutMs: 90_000 });
    await tapAction('Verify token offline', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, 'Capture and verify attendee', { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, 'Cloud E2E image source ready', { timeoutMs: 120_000 });

    await stopLocalProxy();
    await tapAction('Capture and verify attendee', { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, /^Entry accepted\b/, { timeoutMs: 180_000 });
    checks.gate_liveness_capture_accepted = true;
    checks.offline_acceptance = true;
    await screenshot('gate-entry-accepted-offline.png');
    await tapAction('Home');
    await waitForNode(simulatorUdid, /Sync pending/ , { timeoutMs: 90_000 });
    await tapAction('Settings');
    await waitForMetric('Pending check-ins', 1, { timeoutMs: 90_000 });
    checks.offline_queue_observed = true;
    await screenshot('gate-sync-pending.png');

    // A restart must retain the durable offline queue before connectivity is restored.
    await launchGate();
    await tapAction('Settings', { timeoutMs: 90_000 });
    await waitForMetric('Pending check-ins', 1, { timeoutMs: 30_000 });
    checks.queue_persisted_after_restart = true;
    await screenshot('gate-sync-persisted-after-restart.png');

    // Reusing the accepted token while still offline must be rejected locally.
    await tapAction('Back');
    await waitForNode(simulatorUdid, 'Open scanner', { timeoutMs: 90_000 });
    await tapAction('Open scanner');
    await tapAction('Manual fallback', { timeoutMs: 90_000 });
    await pasteIntoNode(simulatorUdid, 'Full pass token', passToken, { timeoutMs: 90_000 });
    await tapAction('Verify token offline', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, /^Entry rejected\b/, { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, /REPLAY_USED/, { timeoutMs: 30_000 });
    checks.replay_rejected = true;
    await screenshot('gate-replay-rejected-offline.png');
    await tapAction('Home');

    await restartLocalProxy();
    await tapAction('Settings', { timeoutMs: 90_000 });
    await waitForMetric('Pending check-ins', 1, { timeoutMs: 30_000 });
    await tapAction('Retry check-in synchronization', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, /Check-in queue and revocation cache synchronized\./, { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, 'Queue clear', { timeoutMs: 90_000 });
    checks.reconnect_sync = true;
    await screenshot('gate-sync-complete.png');

    const browser = await chromium.launch({
      ...(process.env.FOCACCIA_BROWSER_EXECUTABLE_PATH ? { executablePath: process.env.FOCACCIA_BROWSER_EXECUTABLE_PATH } : { channel: 'chrome' }),
      headless: true,
    });
    const page = await browser.newPage({ viewport: { height: 1000, width: 1440 } });
    try {
      await page.goto(`${webUrl}/login`, { waitUntil: 'domcontentloaded' });
      await page.getByLabel('Email', { exact: true }).fill(context.organizerEmail);
      await page.getByLabel('Password', { exact: true }).fill(context.organizerPassword);
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
    const evidence = {
      checks,
      commit_sha: process.env.GITHUB_SHA ?? null,
      event_id: context.eventId,
      face_fixture_sha256: faceFixtureSha256,
      failure,
      network_loss_method: 'stopped_macOS_relay',
      provisioning_mode: 'e2e_payload_injection',
      provisioning_qr_camera_scan: false,
      run_id: context.runId,
      runner_os: process.env.RUNNER_OS ?? null,
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
