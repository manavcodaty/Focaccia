import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

import {
  BaguetteCamera,
  grantCameraAccess,
  installSimulatorApp,
  launchSimulatorApp,
  pasteIntoNode,
  readSimulatorClipboard,
  runCommand,
  takeSimulatorScreenshot,
  tapNode,
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
const provisioningQrPath = requiredEnv('FOCACCIA_PROVISIONING_QR_PATH');
const webUrl = requiredEnv('FOCACCIA_CLOUD_WEB_URL');
const baguetteUrl = process.env.FOCACCIA_BAGUETTE_URL?.trim() || 'http://127.0.0.1:8421';
const proxyPidPath = requiredEnv('FOCACCIA_PROXY_PID_FILE');
const faceFixtureSha256 = createHash('sha256').update(await readFile(faceFixturePath)).digest('hex');

const enrollmentBundleId = 'com.facepass.enrollment';
const gateBundleId = 'com.facepass.gate';
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

async function launchEnrollment() {
  await launchSimulatorApp(simulatorUdid, enrollmentBundleId);
  await waitForNode(simulatorUdid, 'Sign in', { timeoutMs: 60_000 });
}

async function launchGate() {
  await launchSimulatorApp(simulatorUdid, gateBundleId);
  await waitForNode(simulatorUdid, /Prepare this gate|Open scanner|Set up gate/, { timeoutMs: 90_000 });
}

async function screenshot(name) {
  await takeSimulatorScreenshot(simulatorUdid, artifact(name));
}

async function main() {
  await installSimulatorApp(simulatorUdid, enrollmentAppPath);
  await installSimulatorApp(simulatorUdid, gateAppPath);
  await grantCameraAccess(simulatorUdid, enrollmentBundleId);
  await grantCameraAccess(simulatorUdid, gateBundleId);

  const camera = new BaguetteCamera({ baseUrl: baguetteUrl, udid: simulatorUdid });
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
    await camera.uploadImage(provisioningQrPath);
    await camera.start();
    checks.camera_image_source_started = true;

    // Gate provisioning must precede enrollment: the server will not issue a
    // pass until the event has a bound gate public key.
    await launchGate();
    await tapNode(simulatorUdid, 'Set up gate');
    await waitForNode(simulatorUdid, 'Sign in organizer', { timeoutMs: 90_000 });
    await pasteIntoNode(simulatorUdid, 'Organizer email', context.organizerEmail);
    await pasteIntoNode(simulatorUdid, 'Organizer password', context.organizerPassword);
    await tapNode(simulatorUdid, 'Sign in organizer');
    await waitForNode(simulatorUdid, 'Provision this gate', { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, 'Provision this gate', { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, 'Scanner live', { timeoutMs: 120_000 });
    checks.gate_provisioned = true;
    checks.provisioning_payload_injected = true;
    await screenshot('gate-provisioned.png');

    await camera.uploadImage(faceFixturePath);
    await camera.start();
    await launchEnrollment();

    await pasteIntoNode(simulatorUdid, 'Email', context.attendeeEmail);
    await pasteIntoNode(simulatorUdid, 'Password', context.attendeePassword);
    await tapNode(simulatorUdid, 'Sign in');
    await waitForNode(simulatorUdid, 'My tickets', { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, new RegExp(context.eventName));
    await waitForNode(simulatorUdid, 'Create event pass', { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, 'Create event pass');
    await waitForNode(simulatorUdid, 'I consent and continue', { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, 'I consent and continue');
    await waitForNode(simulatorUdid, 'Capture and issue pass', { timeoutMs: 120_000 });
    await tapNode(simulatorUdid, 'Capture and issue pass', { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, 'Pass ready', { timeoutMs: 180_000 });
    checks.enrollment_pass_issued = true;
    checks.enrollment_camera_capture_completed = true;
    await screenshot('enrollment-pass.png');

    await tapNode(simulatorUdid, 'Copy full signed token');
    await waitForNode(simulatorUdid, /Full signed token copied briefly/);
    const passToken = await readSimulatorClipboard(simulatorUdid);
    assert.match(passToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'Enrollment should copy a signed pass token.');

    await camera.uploadImage(faceFixturePath);
    await camera.start();
    await launchGate();
    await tapNode(simulatorUdid, 'Open scanner', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, 'Offline ready', { timeoutMs: 90_000 });
    checks.revocation_cache_fresh = true;
    await waitForNode(simulatorUdid, 'Manual fallback', { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, 'Manual fallback');
    await pasteIntoNode(simulatorUdid, 'Full pass token', passToken, { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, 'Verify token offline', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, 'Capture and verify attendee', { timeoutMs: 120_000 });

    await stopLocalProxy();
    await tapNode(simulatorUdid, 'Capture and verify attendee', { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, /^Entry accepted\./, { timeoutMs: 180_000 });
    checks.gate_liveness_capture_accepted = true;
    checks.offline_acceptance = true;
    await screenshot('gate-entry-accepted-offline.png');
    await tapNode(simulatorUdid, 'Home');
    await waitForNode(simulatorUdid, /Sync pending/ , { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, 'Settings');
    await waitForNode(simulatorUdid, 'Pending check-ins', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, 'Pending check-ins: 1', { timeoutMs: 30_000 });
    checks.offline_queue_observed = true;
    await screenshot('gate-sync-pending.png');

    // A restart must retain the durable offline queue before connectivity is restored.
    await launchGate();
    await tapNode(simulatorUdid, 'Settings', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, 'Pending check-ins: 1', { timeoutMs: 30_000 });
    checks.queue_persisted_after_restart = true;
    await screenshot('gate-sync-persisted-after-restart.png');

    // Reusing the accepted token while still offline must be rejected locally.
    await tapNode(simulatorUdid, 'Back');
    await waitForNode(simulatorUdid, 'Open scanner', { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, 'Open scanner');
    await tapNode(simulatorUdid, 'Manual fallback', { timeoutMs: 90_000 });
    await pasteIntoNode(simulatorUdid, 'Full pass token', passToken, { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, 'Verify token offline', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, /^Entry rejected\./, { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, /REPLAY_USED/, { timeoutMs: 30_000 });
    checks.replay_rejected = true;
    await screenshot('gate-replay-rejected-offline.png');
    await tapNode(simulatorUdid, 'Home');

    await restartLocalProxy();
    await tapNode(simulatorUdid, 'Settings', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, 'Pending check-ins: 1', { timeoutMs: 30_000 });
    await tapNode(simulatorUdid, 'Retry check-in synchronization', { timeoutMs: 90_000 });
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
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await page.waitForURL(/\/dashboard(?:\?.*)?$/, { timeout: 45_000 });
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
    try {
      await camera.stop();
    } finally {
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
          artifacts: [
            'gate-provisioned.png',
            'enrollment-pass.png',
            'gate-entry-accepted-offline.png',
            'gate-sync-pending.png',
            'gate-sync-persisted-after-restart.png',
            'gate-replay-rejected-offline.png',
            'gate-sync-complete.png',
            'organizer-dashboard-checked-in.png',
          ],
        }, null, 2)}\n`),
      ]);
    }
  }

  assert.deepEqual(Object.values(checks), Array(Object.keys(checks).length).fill(true), 'The native cloud flow did not complete every acceptance stage.');
  console.log(JSON.stringify(checks));
}

await main();
