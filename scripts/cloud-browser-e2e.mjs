import assert from 'node:assert/strict';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

import { chromium } from '@playwright/test';

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for the cloud browser flow.`);
  return value;
}

async function waitForVisible(locator, label) {
  await locator.waitFor({ state: 'visible' });
  assert.equal(await locator.isVisible(), true, `${label} should be visible`);
}

async function waitForHydration(page, locator, label) {
  await locator.waitFor({ state: 'visible' });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const ready = await locator.evaluate((element) => {
      const input = element;
      return document.readyState === 'complete' && !input.disabled && !input.readOnly;
    });
    if (ready) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`${label} was not interactable within 12 seconds.`);
}

async function fillStable(page, locator, value, label) {
  await waitForHydration(page, locator, label);
  let stableChecks = 0;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await locator.fill(value);
    await page.waitForTimeout(250);
    if ((await locator.inputValue()) === value) {
      stableChecks += 1;
      // A tunneled Next.js page can finish replacing its server-rendered
      // form after the first successful fill. Require two quiet seconds so
      // the controlled React input has survived hydration before submitting.
      if (stableChecks >= 8) return;
    } else {
      stableChecks = 0;
    }
  }
  assert.equal(await locator.inputValue(), value, `${label} should retain its value after hydration`);
}

async function fillLoginCredentials(page, emailInput, passwordInput) {
  // A tunneled Next.js auth card can re-render the controlled email input
  // when the password field receives focus. Reassert both values together
  // immediately before submission so browser validation cannot observe a
  // stale empty email field.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await fillStable(page, emailInput, organizerEmail, 'organizer email');
    await fillStable(page, passwordInput, organizerPassword, 'organizer password');
    await emailInput.fill(organizerEmail);
    await emailInput.press('Tab');
    await page.waitForTimeout(250);
    if (
      (await emailInput.inputValue()) === organizerEmail
      && (await passwordInput.inputValue()) === organizerPassword
    ) {
      return;
    }
  }
  assert.equal(await emailInput.inputValue(), organizerEmail, 'organizer email should be present before submit');
  assert.equal(await passwordInput.inputValue(), organizerPassword, 'organizer password should be present before submit');
}

function hashIdentifier(value, runId) {
  return createHash('sha256').update(`${runId}\0${value}`).digest('hex');
}

function redactText(value, sensitiveValues) {
  return sensitiveValues
    .filter((entry) => typeof entry === 'string' && entry.length > 0)
    .sort((left, right) => right.length - left.length)
    .reduce((redacted, entry) => redacted.replaceAll(entry, '[REDACTED]'), String(value));
}

async function redactPageForEvidence(page, sensitiveValues, { hideProvisioning = false } = {}) {
  if (!page || page.isClosed()) return;
  const values = sensitiveValues.filter((entry) => typeof entry === 'string' && entry.length > 0);
  await page.evaluate(({ hideProvisioning, values: replacements }) => {
    const replace = (input) => replacements
      .sort((left, right) => right.length - left.length)
      .reduce((output, value) => output.replaceAll(value, '[REDACTED]'), input);

    for (const input of document.querySelectorAll('input, textarea')) {
      if ('value' in input && typeof input.value === 'string') input.value = replace(input.value);
    }

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      node.textContent = replace(node.textContent ?? '');
      node = walker.nextNode();
    }

    if (hideProvisioning) {
      const payload = document.querySelector('#qr-payload');
      if (payload) payload.replaceChildren(document.createTextNode('[PROVISIONING PAYLOAD REDACTED]'));
    }
  }, { hideProvisioning, values });
}

const webUrl = requiredEnv('FOCACCIA_CLOUD_WEB_URL');
const ticketsUrl = requiredEnv('FOCACCIA_CLOUD_TICKETS_URL');
const publicSupabaseUrl = requiredEnv('FOCACCIA_CLOUD_SUPABASE_URL');
const anonKey = requiredEnv('FOCACCIA_CLOUD_ANON_KEY');
const organizerEmail = requiredEnv('FOCACCIA_CLOUD_ORGANIZER_EMAIL');
const organizerPassword = requiredEnv('FOCACCIA_CLOUD_ORGANIZER_PASSWORD');
const artifactDir = path.resolve(
  process.env.FOCACCIA_CLOUD_ARTIFACT_DIR ?? path.join(process.cwd(), 'artifacts/cloud-browser'),
);
const contextPath = path.resolve(
  process.env.FOCACCIA_CLOUD_CONTEXT_PATH ?? path.join(os.tmpdir(), 'focaccia-cloud-context.json'),
);
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const eventName = `Cloud E2E ${runId}`;
const eventId = `cloud_e2e_${runId}`;
const attendeeEmail = `attendee-${runId}@example.com`;
const attendeePassword = `Attendee-${randomUUID()}!`;
const foreignAttendeeEmail = `foreign-${runId}@example.com`;
const foreignAttendeePassword = `Foreign-${randomUUID()}!`;
const startedAt = new Date().toISOString();
const workflowRunUrl = process.env.GITHUB_SERVER_URL
  && process.env.GITHUB_REPOSITORY
  && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : null;
const organizerIdHash = hashIdentifier(organizerEmail, runId);
const attendeeIdHash = hashIdentifier(attendeeEmail, runId);
const sensitiveValues = [
  organizerEmail,
  organizerPassword,
  attendeeEmail,
  attendeePassword,
  foreignAttendeeEmail,
  foreignAttendeePassword,
];

await mkdir(artifactDir, { recursive: true });

const executablePath = process.env.FOCACCIA_BROWSER_EXECUTABLE_PATH?.trim();
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : { channel: 'chrome' }),
  headless: true,
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
let organizerPage;
let attendeePage;
let foreignContext;
let foreignPage;
let stage = 'browser_initialization';
let thrownError = null;
let ticketId = null;
const artifactPaths = [];
const checks = {
  attendee_account_created: false,
  attendee_wallet_checked: false,
  claim_code_format_valid: false,
  event_listed: false,
  foreign_claim_ownership_rejected: false,
  foreign_ticket_ownership_rejected: false,
  gate_provisioning_payload_captured_ephemerally: false,
  organizer_event_created: false,
};

try {
  stage = 'organizer_login';
  organizerPage = await context.newPage();
  await organizerPage.goto(`${webUrl}/login`, { waitUntil: 'domcontentloaded' });
  await organizerPage.locator('form button[type="submit"]').waitFor({ state: 'visible' });
  const organizerEmailInput = organizerPage.getByLabel('Email', { exact: true });
  const organizerPasswordInput = organizerPage.getByLabel('Password', { exact: true });
  await fillLoginCredentials(organizerPage, organizerEmailInput, organizerPasswordInput);
  await organizerPage.locator('form button[type="submit"]').click();
  await organizerPage.waitForURL(/\/dashboard(?:\?.*)?$/, {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  await waitForVisible(organizerPage.getByRole('heading', { name: 'Events', exact: true }), 'organizer dashboard');

  stage = 'organizer_event_creation';
  await organizerPage.goto(`${webUrl}/events/new`, { waitUntil: 'domcontentloaded' });
  await fillStable(organizerPage, organizerPage.getByLabel('Event name', { exact: true }), eventName, 'event name');
  await fillStable(organizerPage, organizerPage.getByLabel('Event ID', { exact: true }), eventId, 'event ID');
  await fillStable(
    organizerPage,
    organizerPage.getByLabel('Description', { exact: true }),
    'Cloud end-to-end verification event.',
    'event description',
  );
  await fillStable(
    organizerPage,
    organizerPage.getByLabel('Location', { exact: true }),
    'Cloud verification hall',
    'event location',
  );
  await organizerPage.getByRole('checkbox', { name: /Listed publicly/ }).check();
  await organizerPage.locator('form button[type="submit"]').click();
  await waitForVisible(
    organizerPage.locator('[data-slot="card-title"]').filter({ hasText: 'Event created' }),
    'event creation confirmation',
  );
  const eventWorkspaceHref = await organizerPage
    .getByRole('link', { name: 'Open event workspace', exact: true })
    .getAttribute('href');
  assert.equal(eventWorkspaceHref, `/events/${eventId}`);
  checks.organizer_event_created = true;
  await redactPageForEvidence(organizerPage, sensitiveValues);
  await organizerPage.screenshot({ path: path.join(artifactDir, 'organizer-event-created.png'), fullPage: true });
  artifactPaths.push('organizer-event-created.png');

  stage = 'attendee_signup_and_ticket_claim';
  attendeePage = await context.newPage();
  await attendeePage.goto(`${ticketsUrl}/signup`, { waitUntil: 'domcontentloaded' });
  await attendeePage.locator('form button[type="submit"]').waitFor({ state: 'visible' });
  await fillStable(attendeePage, attendeePage.locator('#full-name'), 'Cloud Test Attendee', 'attendee name');
  await fillStable(attendeePage, attendeePage.locator('input[type="email"]'), attendeeEmail, 'attendee email');
  await fillStable(attendeePage, attendeePage.locator('input[type="password"]'), attendeePassword, 'attendee password');
  await attendeePage.locator('form button[type="submit"]').click();
  await attendeePage.waitForURL(/\/tickets(?:\?.*)?$/, {
    timeout: 45_000,
    waitUntil: 'domcontentloaded',
  });
  checks.attendee_account_created = true;

  await attendeePage.goto(`${ticketsUrl}/`, { waitUntil: 'domcontentloaded' });
  const eventLink = attendeePage.getByRole('link', { name: `View ${eventName}`, exact: true });
  await waitForVisible(eventLink, 'listed event');
  checks.event_listed = true;
  await eventLink.click();
  await attendeePage.waitForURL(new RegExp(`/events/${eventId}$`), { waitUntil: 'domcontentloaded' });
  await waitForVisible(attendeePage.getByRole('heading', { name: eventName, exact: true }), 'event detail');
  await attendeePage.getByText('Claim free ticket', { exact: true }).click();
  await attendeePage.waitForURL(/\/confirmation\/[^/]+$/, { waitUntil: 'domcontentloaded' });
  await waitForVisible(attendeePage.getByText('Your place is saved', { exact: true }), 'ticket confirmation');
  const claimCode = (await attendeePage.locator('.claim-code-panel strong').textContent())?.trim() ?? '';
  assert.match(claimCode, /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){2}$/);
  checks.claim_code_format_valid = true;
  ticketId = decodeURIComponent(new URL(attendeePage.url()).pathname.split('/').filter(Boolean).at(-1) ?? '');
  assert.match(ticketId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  sensitiveValues.push(claimCode);
  await redactPageForEvidence(attendeePage, sensitiveValues);
  await attendeePage.screenshot({ path: path.join(artifactDir, 'attendee-ticket-confirmed.png'), fullPage: true });
  artifactPaths.push('attendee-ticket-confirmed.png');

  stage = 'attendee_wallet';
  await attendeePage.goto(`${ticketsUrl}/tickets`, { waitUntil: 'domcontentloaded' });
  await waitForVisible(attendeePage.getByRole('heading', { name: 'My tickets', exact: true }), 'attendee wallet');
  await waitForVisible(attendeePage.getByText(eventName, { exact: true }), 'claimed ticket in attendee wallet');
  checks.attendee_wallet_checked = true;

  stage = 'foreign_ownership_rejection';
  // The foreign attendee must not share the primary attendee's cookies or
  // Supabase localStorage; a second browser context makes the ownership
  // negative checks exercise a genuinely distinct authenticated identity.
  foreignContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  foreignPage = await foreignContext.newPage();
  await foreignPage.goto(`${ticketsUrl}/signup`, { waitUntil: 'domcontentloaded' });
  await foreignPage.locator('form button[type="submit"]').waitFor({ state: 'visible' });
  await fillStable(foreignPage, foreignPage.locator('#full-name'), 'Cloud Foreign Attendee', 'foreign attendee name');
  await fillStable(foreignPage, foreignPage.locator('input[type="email"]'), foreignAttendeeEmail, 'foreign attendee email');
  await fillStable(foreignPage, foreignPage.locator('input[type="password"]'), foreignAttendeePassword, 'foreign attendee password');
  await foreignPage.locator('form button[type="submit"]').click();
  await foreignPage.waitForURL(/\/tickets(?:\?.*)?$/, { timeout: 45_000, waitUntil: 'domcontentloaded' });
  const foreignClaimLookupStatus = await foreignPage.evaluate(async ({ anonKey: key, claimCode, publicSupabaseUrl: supabaseUrl }) => {
    const session = Object.values(localStorage)
      .map((value) => {
        try { return JSON.parse(value); } catch { return null; }
      })
      .find((candidate) => typeof candidate?.access_token === 'string');
    if (!session?.access_token) return 0;
    const response = await fetch(`${supabaseUrl}/functions/v1/get-enrollment-bundle`, {
      body: JSON.stringify({ claim_code: claimCode }),
      headers: {
        apikey: key,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
      method: 'POST',
    });
    return response.status;
  }, { anonKey, claimCode, publicSupabaseUrl });
  assert.equal(foreignClaimLookupStatus, 404, 'A foreign attendee must not resolve another attendee claim code.');
  checks.foreign_claim_ownership_rejected = true;
  await foreignPage.goto(`${ticketsUrl}/confirmation/${ticketId}`, { waitUntil: 'domcontentloaded' });
  await waitForVisible(foreignPage.getByRole('heading', { name: 'This ticket was not found', exact: true }), 'foreign ticket rejection');
  await waitForVisible(foreignPage.getByText('It may belong to a different attendee account.', { exact: true }), 'foreign ticket ownership message');
  checks.foreign_ticket_ownership_rejected = true;

  stage = 'gate_provisioning_capture';
  await organizerPage.goto(`${webUrl}/events/${eventId}/provisioning`, { waitUntil: 'domcontentloaded' });
  await waitForVisible(
    organizerPage.getByText('Gate transfer payload', { exact: true }),
    'gate provisioning payload',
  );
  const provisioningDetailsToggle = organizerPage.getByRole('button', {
    name: /Advanced cryptographic details/,
  });
  const provisioningPayloadPreview = organizerPage.locator('#qr-payload pre');
  let provisioningPayloadText = null;
  let provisioningExpansionError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await waitForVisible(provisioningDetailsToggle, 'advanced cryptographic details');
    if (await provisioningPayloadPreview.isVisible().catch(() => false)) {
      provisioningPayloadText = await provisioningPayloadPreview.textContent();
      break;
    }
    try {
      await provisioningDetailsToggle.click();
      await provisioningPayloadPreview.waitFor({ state: 'visible', timeout: 15_000 });
      provisioningPayloadText = await provisioningPayloadPreview.textContent();
      break;
    } catch (error) {
      provisioningExpansionError = error;
      if (attempt === 2) break;
      // A tunneled Next.js page can expose the server-rendered accordion before
      // Radix has attached its click handler. Reload once between bounded
      // attempts so the capture cannot silently continue with a closed panel.
      await organizerPage.reload({ waitUntil: 'domcontentloaded' });
      await waitForVisible(
        organizerPage.getByText('Gate transfer payload', { exact: true }),
        'gate provisioning payload after reload',
      );
    }
  }
  if (!provisioningPayloadText && provisioningExpansionError) throw provisioningExpansionError;
  assert.ok(provisioningPayloadText, 'The provisioning payload preview should be present.');
  const provisioningPayload = JSON.parse(provisioningPayloadText);
  sensitiveValues.push(provisioningPayloadText, JSON.stringify(provisioningPayload), encodeURIComponent(JSON.stringify(provisioningPayload)));
  checks.gate_provisioning_payload_captured_ephemerally = true;
  await redactPageForEvidence(organizerPage, sensitiveValues, { hideProvisioning: true });
  await organizerPage.screenshot({ path: path.join(artifactDir, 'organizer-provisioning.png'), fullPage: true });
  artifactPaths.push('organizer-provisioning.png');

  stage = 'ephemeral_handoff_write';
  await writeFile(
    contextPath,
    `${JSON.stringify({
      attendeeEmail,
      attendeePassword,
      attendeeIdHash,
      eventId,
      eventName,
      organizerEmail,
      organizerPassword,
      provisioningPayload,
      runId,
      startedAt,
      ticketId,
      workflowRunUrl,
    }, null, 2)}\n`,
    { mode: 0o600 },
  );
  await chmod(contextPath, 0o600);

  stage = 'browser_report_write';
  const report = {
    artifact_paths: artifactPaths,
    attendee_id_hash: attendeeIdHash,
    checks,
    commit_sha: process.env.GITHUB_SHA ?? null,
    event_id: eventId,
    failure: null,
    isolated_backend_instance: true,
    mutable_state_isolated: true,
    organizer_id_hash: organizerIdHash,
    run_id: runId,
    runner_os: process.env.RUNNER_OS ?? process.platform,
    started_at: startedAt,
    status: 'PASS',
    ticket_id: ticketId,
    workflow_run_url: workflowRunUrl,
  };
  await writeFile(path.join(artifactDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} catch (error) {
  thrownError = error;
  const failureMessage = redactText(error instanceof Error ? error.message : String(error), sensitiveValues);
  await Promise.all([
    organizerPage && redactPageForEvidence(organizerPage, sensitiveValues, { hideProvisioning: true })
      .then(() => organizerPage.screenshot({ path: path.join(artifactDir, 'organizer-failure.png'), fullPage: true }))
      .then(() => artifactPaths.push('organizer-failure.png'))
      .catch(() => {}),
    attendeePage && redactPageForEvidence(attendeePage, sensitiveValues)
      .then(() => attendeePage.screenshot({ path: path.join(artifactDir, 'attendee-failure.png'), fullPage: true }))
      .then(() => artifactPaths.push('attendee-failure.png'))
      .catch(() => {}),
    foreignPage && redactPageForEvidence(foreignPage, sensitiveValues)
      .then(() => foreignPage.screenshot({ path: path.join(artifactDir, 'foreign-failure.png'), fullPage: true }))
      .then(() => artifactPaths.push('foreign-failure.png'))
      .catch(() => {}),
  ]);
  const report = {
    artifact_paths: artifactPaths,
    attendee_id_hash: attendeeIdHash,
    checks,
    commit_sha: process.env.GITHUB_SHA ?? null,
    event_id: eventId,
    failure: { message: failureMessage, stage },
    isolated_backend_instance: true,
    mutable_state_isolated: true,
    organizer_id_hash: organizerIdHash,
    run_id: runId,
    runner_os: process.env.RUNNER_OS ?? process.platform,
    started_at: startedAt,
    status: 'FAIL',
    ticket_id: ticketId,
    workflow_run_url: workflowRunUrl,
  };
  await writeFile(path.join(artifactDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
} finally {
  await context.close();
  await foreignContext?.close();
  await browser.close();
}

if (thrownError) throw thrownError;
