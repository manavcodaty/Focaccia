import assert from 'node:assert/strict';
import { chmod, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

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
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await locator.fill(value);
    await page.waitForTimeout(250);
    if ((await locator.inputValue()) === value) {
      stableChecks += 1;
      if (stableChecks >= 3) return;
    } else {
      stableChecks = 0;
    }
  }
  assert.equal(await locator.inputValue(), value, `${label} should retain its value after hydration`);
}

const webUrl = requiredEnv('FOCACCIA_CLOUD_WEB_URL');
const ticketsUrl = requiredEnv('FOCACCIA_CLOUD_TICKETS_URL');
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

try {
  organizerPage = await context.newPage();
  await organizerPage.goto(`${webUrl}/login`, { waitUntil: 'domcontentloaded' });
  await organizerPage.locator('form button[type="submit"]').waitFor({ state: 'visible' });
  const organizerEmailInput = organizerPage.locator('input[type="email"]');
  const organizerPasswordInput = organizerPage.locator('input[type="password"]');
  await fillStable(organizerPage, organizerEmailInput, organizerEmail, 'organizer email');
  await fillStable(organizerPage, organizerPasswordInput, organizerPassword, 'organizer password');
  await organizerPage.locator('form button[type="submit"]').click();
  await organizerPage.waitForURL(/\/dashboard(?:\?.*)?$/, { timeout: 45_000 });
  await waitForVisible(organizerPage.getByRole('heading', { name: 'Events', exact: true }), 'organizer dashboard');

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
  await organizerPage.screenshot({ path: path.join(artifactDir, 'organizer-event-created.png'), fullPage: true });

  attendeePage = await context.newPage();
  await attendeePage.goto(`${ticketsUrl}/signup`, { waitUntil: 'domcontentloaded' });
  await attendeePage.locator('form button[type="submit"]').waitFor({ state: 'visible' });
  await fillStable(attendeePage, attendeePage.locator('#full-name'), 'Cloud Test Attendee', 'attendee name');
  await fillStable(attendeePage, attendeePage.locator('input[type="email"]'), attendeeEmail, 'attendee email');
  await fillStable(attendeePage, attendeePage.locator('input[type="password"]'), attendeePassword, 'attendee password');
  await attendeePage.locator('form button[type="submit"]').click();
  await attendeePage.waitForURL(/\/tickets(?:\?.*)?$/, { timeout: 45_000 });

  await attendeePage.goto(`${ticketsUrl}/`, { waitUntil: 'domcontentloaded' });
  const eventLink = attendeePage.getByRole('link', { name: `View ${eventName}`, exact: true });
  await waitForVisible(eventLink, 'listed event');
  await eventLink.click();
  await attendeePage.waitForURL(new RegExp(`/events/${eventId}$`));
  await waitForVisible(attendeePage.getByRole('heading', { name: eventName, exact: true }), 'event detail');
  await attendeePage.getByText('Claim free ticket', { exact: true }).click();
  await attendeePage.waitForURL(/\/confirmation\/[^/]+$/);
  await waitForVisible(attendeePage.getByText('Your place is saved', { exact: true }), 'ticket confirmation');
  const claimCode = (await attendeePage.locator('.claim-code-panel strong').textContent())?.trim() ?? '';
  assert.match(claimCode, /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){2}$/);
  await attendeePage.screenshot({ path: path.join(artifactDir, 'attendee-ticket-confirmed.png'), fullPage: true });

  await attendeePage.goto(`${ticketsUrl}/tickets`, { waitUntil: 'domcontentloaded' });
  await waitForVisible(attendeePage.getByRole('heading', { name: 'My tickets', exact: true }), 'attendee wallet');
  await waitForVisible(attendeePage.getByText(eventName, { exact: true }), 'claimed ticket in attendee wallet');

  await organizerPage.goto(`${webUrl}/events/${eventId}/provisioning`, { waitUntil: 'domcontentloaded' });
  await waitForVisible(
    organizerPage.getByText('Gate transfer payload', { exact: true }),
    'gate provisioning payload',
  );
  await organizerPage.getByText('Advanced cryptographic details', { exact: true }).click();
  const provisioningPayloadText = await organizerPage.locator('#qr-payload pre').textContent();
  assert.ok(provisioningPayloadText, 'The provisioning payload preview should be present.');
  const provisioningPayload = JSON.parse(provisioningPayloadText);
  await organizerPage.locator('#qr-payload').getByRole('img').screenshot({
    path: path.join(artifactDir, 'gate-provisioning-qr.png'),
  });
  await organizerPage.screenshot({ path: path.join(artifactDir, 'organizer-provisioning.png'), fullPage: true });

  await writeFile(
    contextPath,
    `${JSON.stringify({
      attendeeEmail,
      attendeePassword,
      eventId,
      eventName,
      organizerEmail,
      organizerPassword,
      provisioningPayload,
      runId,
    }, null, 2)}\n`,
    { mode: 0o600 },
  );
  await chmod(contextPath, 0o600);

  const report = {
    attendee_account_created: true,
    attendee_wallet_checked: true,
    claim_code_format_valid: true,
    event_id: eventId,
    event_listed: true,
    gate_provisioning_payload_captured: true,
    gate_provisioning_qr_screenshot_captured: true,
    organizer_event_created: true,
    run_id: runId,
  };
  await writeFile(path.join(artifactDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report));
} catch (error) {
  await Promise.all([
    organizerPage?.screenshot({ path: path.join(artifactDir, 'organizer-failure.png'), fullPage: true }).catch(() => {}),
    attendeePage?.screenshot({ path: path.join(artifactDir, 'attendee-failure.png'), fullPage: true }).catch(() => {}),
  ]);
  throw error;
} finally {
  await context.close();
  await browser.close();
}
