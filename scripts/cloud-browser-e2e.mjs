import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
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

const webUrl = requiredEnv('FOCACCIA_CLOUD_WEB_URL');
const ticketsUrl = requiredEnv('FOCACCIA_CLOUD_TICKETS_URL');
const organizerEmail = requiredEnv('FOCACCIA_CLOUD_ORGANIZER_EMAIL');
const organizerPassword = requiredEnv('FOCACCIA_CLOUD_ORGANIZER_PASSWORD');
const artifactDir = path.resolve(
  process.env.FOCACCIA_CLOUD_ARTIFACT_DIR ?? path.join(process.cwd(), 'artifacts/cloud-browser'),
);
const runId = randomUUID().replaceAll('-', '').slice(0, 12);
const eventId = `cloud_${runId}`;
const eventName = `Cloud E2E ${runId}`;
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
  await organizerPage.getByRole('button', { name: 'Sign up', exact: true }).click();
  await organizerPage.getByLabel('Email', { exact: true }).fill(organizerEmail);
  await organizerPage.getByLabel('Password', { exact: true }).fill(organizerPassword);
  await organizerPage.getByRole('button', { name: 'Create account', exact: true }).click();
  await organizerPage.waitForURL(/\/dashboard(?:\?.*)?$/, { timeout: 45_000 });
  await waitForVisible(organizerPage.getByRole('heading', { name: 'Events', exact: true }), 'organizer dashboard');

  await organizerPage.goto(`${webUrl}/events/new`, { waitUntil: 'domcontentloaded' });
  await organizerPage.getByLabel('Event name', { exact: true }).fill(eventName);
  await organizerPage.getByLabel('Event ID', { exact: true }).fill(eventId);
  await organizerPage.getByLabel('Description', { exact: true }).fill('Cloud end-to-end verification event.');
  await organizerPage.getByLabel('Location', { exact: true }).fill('Cloud verification hall');
  await organizerPage.getByRole('checkbox', { name: /Listed publicly/ }).check();
  await organizerPage.getByRole('button', { name: 'Create event', exact: true }).click();
  await waitForVisible(organizerPage.getByRole('button', { name: 'Event created', exact: true }), 'event creation confirmation');
  const eventWorkspaceHref = await organizerPage
    .getByRole('link', { name: 'Open event workspace', exact: true })
    .getAttribute('href');
  assert.equal(eventWorkspaceHref, `/events/${eventId}`);
  await organizerPage.screenshot({ path: path.join(artifactDir, 'organizer-event-created.png'), fullPage: true });

  attendeePage = await context.newPage();
  await attendeePage.goto(`${ticketsUrl}/signup`, { waitUntil: 'domcontentloaded' });
  await attendeePage.getByLabel('Full name', { exact: true }).fill('Cloud Test Attendee');
  await attendeePage.getByLabel('Email address', { exact: true }).fill(attendeeEmail);
  await attendeePage.getByLabel('Password', { exact: true }).fill(attendeePassword);
  await attendeePage.getByRole('button', { name: 'Create account', exact: true }).click();
  await attendeePage.waitForURL(/\/tickets(?:\?.*)?$/, { timeout: 45_000 });

  await attendeePage.goto(`${ticketsUrl}/`, { waitUntil: 'domcontentloaded' });
  const eventLink = attendeePage.getByRole('link', { name: `View ${eventName}`, exact: true });
  await waitForVisible(eventLink, 'listed event');
  await eventLink.click();
  await attendeePage.waitForURL(new RegExp(`/events/${eventId}$`));
  await waitForVisible(attendeePage.getByRole('heading', { name: eventName, exact: true }), 'event detail');
  await attendeePage.getByRole('button', { name: 'Claim free ticket', exact: true }).click();
  await attendeePage.waitForURL(/\/confirmation\/[^/]+$/);
  await waitForVisible(attendeePage.getByText('Your place is saved', { exact: true }), 'ticket confirmation');
  const claimCode = (await attendeePage.locator('.claim-code-panel strong').textContent())?.trim() ?? '';
  assert.match(claimCode, /^[0-9A-HJKMNP-TV-Z]{4}(?:-[0-9A-HJKMNP-TV-Z]{4}){2}$/);
  await attendeePage.screenshot({ path: path.join(artifactDir, 'attendee-ticket-confirmed.png'), fullPage: true });

  await attendeePage.goto(`${ticketsUrl}/tickets`, { waitUntil: 'domcontentloaded' });
  await waitForVisible(attendeePage.getByRole('heading', { name: 'My tickets', exact: true }), 'attendee wallet');
  await waitForVisible(attendeePage.getByText(eventName, { exact: true }), 'claimed ticket in attendee wallet');

  const report = {
    attendee_account_created: true,
    attendee_wallet_checked: true,
    claim_code_format_valid: true,
    event_id: eventId,
    event_listed: true,
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
