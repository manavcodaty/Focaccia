import assert from 'node:assert/strict';
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
  const report = {
    camera_image_injection: false,
    dashboard_checked_in: false,
    enrollment_pass_issued: false,
    gate_provisioned: false,
    gate_liveness_image_injection: false,
    offline_acceptance: false,
    offline_queue_observed: false,
    reconnect_sync: false,
  };

  try {
    await camera.uploadImage(faceFixturePath);
    await camera.start();
    report.camera_image_injection = true;
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
    report.enrollment_pass_issued = true;
    await screenshot('enrollment-pass.png');

    await tapNode(simulatorUdid, 'Copy full signed token');
    await waitForNode(simulatorUdid, /Full signed token copied briefly/);
    const passToken = await readSimulatorClipboard(simulatorUdid);
    assert.match(passToken, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, 'Enrollment should copy a signed pass token.');

    await camera.uploadImage(provisioningQrPath);
    await camera.start();
    await launchGate();
    await tapNode(simulatorUdid, 'Set up gate');
    await waitForNode(simulatorUdid, 'Sign in organizer', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, 'Provision this gate', { timeoutMs: 90_000 });
    await pasteIntoNode(simulatorUdid, 'Organizer email', context.organizerEmail);
    await pasteIntoNode(simulatorUdid, 'Organizer password', context.organizerPassword);
    await tapNode(simulatorUdid, 'Sign in organizer');
    await waitForNode(simulatorUdid, 'Provision this gate', { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, 'Provision this gate', { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, 'Scanner live', { timeoutMs: 120_000 });
    report.gate_provisioned = true;
    await screenshot('gate-provisioned.png');

    await camera.uploadImage(faceFixturePath);
    await camera.start();
    await launchGate();
    await tapNode(simulatorUdid, 'Open scanner', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, 'Manual fallback', { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, 'Manual fallback');
    await pasteIntoNode(simulatorUdid, 'Full pass token', passToken, { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, 'Verify token offline', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, 'Capture and verify attendee', { timeoutMs: 120_000 });

    report.gate_liveness_image_injection = true;
    await stopLocalProxy();
    await tapNode(simulatorUdid, 'Capture and verify attendee', { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, /^Entry accepted\./, { timeoutMs: 180_000 });
    report.offline_acceptance = true;
    await screenshot('gate-entry-accepted-offline.png');
    await tapNode(simulatorUdid, 'Home');
    await waitForNode(simulatorUdid, /Sync pending/ , { timeoutMs: 90_000 });
    await tapNode(simulatorUdid, 'Settings');
    await waitForNode(simulatorUdid, 'Pending check-ins', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, '1', { timeoutMs: 30_000 });
    report.offline_queue_observed = true;
    await screenshot('gate-sync-pending.png');

    await restartLocalProxy();
    await tapNode(simulatorUdid, 'Retry check-in synchronization', { timeoutMs: 90_000 });
    await waitForNode(simulatorUdid, /Check-in queue and revocation cache synchronized\./, { timeoutMs: 120_000 });
    await waitForNode(simulatorUdid, 'Queue clear', { timeoutMs: 90_000 });
    report.reconnect_sync = true;
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
      report.dashboard_checked_in = true;
    } finally {
      await page.context().close();
      await browser.close();
    }
  } finally {
    await camera.stop();
  }

  assert.deepEqual(Object.values(report), Array(Object.keys(report).length).fill(true), 'The native cloud flow did not complete every acceptance stage.');
  await writeFile(artifact('native-report.json'), `${JSON.stringify({ ...report, event_id: context.eventId, run_id: context.runId }, null, 2)}\n`);
  console.log(JSON.stringify(report));
}

await main();
