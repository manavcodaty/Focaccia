import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

import { measure } from "./measure.mjs";
import { organizerSession, webUrl } from "./session.mjs";

const { chromium } = createRequire(path.resolve(import.meta.dirname, "../../package.json"))("@playwright/test");
const shot = (name) => path.join(import.meta.dirname, `after-${name}.png`);
const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(`PASS ${name}`); } catch (error) { results.push(`FAIL ${name}: ${error.message.split("\n")[0]}`); }
};

const session = await organizerSession();
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell` });
const context = await browser.newContext({ viewport: { height: 1000, width: 1440 } });
await context.grantPermissions(["clipboard-read", "clipboard-write"]);
await context.addCookies(session.cookies);
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
page.on("pageerror", (error) => consoleErrors.push(String(error)));

const drawer = page.locator('[data-slot="drawer-content"]');
const rows = page.locator('table[aria-label="Events"] tbody tr');
const closeDrawer = async () => {
  await page.keyboard.press("Escape");
  await drawer.waitFor({ state: "hidden" });
};

// ---------- Dashboard ----------
await page.goto(`${webUrl}/dashboard`, { waitUntil: "networkidle" });
await page.screenshot({ fullPage: true, path: shot("dashboard") });

await check("dashboard has no chart", async () => {
  assert.equal(await page.locator(".recharts-wrapper, .recharts-surface, [data-slot=chart]").count(), 0);
  assert.equal(await page.getByText("Activity", { exact: true }).count(), 0);
  assert.equal(await page.getByText(/Last (7|30) days|Last 3 months/).count(), 0);
});

await check("dashboard KPI cards are plain figures without status labels", async () => {
  const kpis = page.locator('section[aria-label="Portfolio summary"]');
  assert.equal(await kpis.locator('[data-slot="card"]').count(), 4);
  assert.equal(await kpis.locator('[data-slot="badge"]').count(), 0);
  assert.equal(await kpis.getByText(/live|stale|pending|%/i).count(), 0);
});

await check("events table rows no longer carry Listed / Provisioned pills", async () => {
  const pills = await rows.locator('[data-slot="badge"]').allInnerTexts();
  assert.ok(pills.every((text) => /^(Live|Upcoming|Ended)$/.test(text.trim())), `unexpected pills: ${pills.join(", ")}`);
});

const rowCount = await rows.count();
assert.ok(rowCount >= 2, "need at least two events for row-click checks");
const nameOf = async (index) => (await rows.nth(index).locator("td").first().innerText()).trim();

await check("clicking the Starts cell opens the right-hand drawer for that event", async () => {
  const name = await nameOf(0);
  await rows.nth(0).locator("td").nth(2).click();
  await drawer.waitFor({ state: "visible" });
  assert.equal(await drawer.getAttribute("data-vaul-drawer-direction"), "right");
  assert.equal((await drawer.locator('[data-slot="drawer-title"]').innerText()).trim(), name);
  const box = await drawer.boundingBox();
  assert.ok(box.x > 700, `drawer should sit on the right, x=${box.x}`);
  assert.equal(await rows.nth(0).getAttribute("data-state"), "selected");
  await page.waitForTimeout(400);
  await page.screenshot({ path: shot("drawer") });
});

await check("drawer shows ticket states as plain numbers, no chart, no progress bar, no badges", async () => {
  assert.equal(await drawer.locator(".recharts-wrapper, .recharts-surface, [data-slot=chart], [data-slot=progress]").count(), 0);
  assert.equal(await drawer.locator('[data-slot="badge"]').count(), 0);
  const tickets = drawer.locator('section[aria-label="Tickets"] dl');
  const terms = (await tickets.locator("dt").allInnerTexts()).map((t) => t.trim());
  assert.deepEqual(terms, ["Allocated", "Claimed", "Enrolled", "Checked in", "Cancelled", "Revoked"]);
  const values = (await tickets.locator("dd").allInnerTexts()).map((t) => t.trim());
  assert.match(values[0], /^\d+ \/ \d+$/);
  values.slice(1).forEach((value) => assert.match(value, /^\d+$/));
  const details = (await drawer.locator('section[aria-label="Details"] dt').allInnerTexts()).map((t) => t.trim());
  assert.deepEqual(details, ["Status", "Starts", "Ends", "Location", "Visibility", "Gate", "Last sync", "Revocations"]);
});

await check("drawer numbers match the table row", async () => {
  const allocatedCell = (await rows.nth(0).locator("td").nth(3).innerText()).replace(/\s+/g, " ").trim();
  const checkedCell = (await rows.nth(0).locator("td").nth(4).innerText()).trim();
  const dd = drawer.locator('section[aria-label="Tickets"] dd');
  assert.equal((await dd.nth(0).innerText()).replace(/\s+/g, " ").trim(), allocatedCell);
  assert.equal((await dd.nth(3).innerText()).trim(), checkedCell);
});
await closeDrawer();

await check("clicking empty space in a different cell opens that event instead", async () => {
  const name = await nameOf(1);
  const cell = rows.nth(1).locator("td").nth(4);
  const box = await cell.boundingBox();
  await page.mouse.click(box.x + 4, box.y + box.height / 2);
  await drawer.waitFor({ state: "visible" });
  assert.equal((await drawer.locator('[data-slot="drawer-title"]').innerText()).trim(), name);
  await closeDrawer();
});

await check("clicking the Status / Visibility / Gate cells also opens the drawer", async () => {
  for (const index of [1, 5, 6]) {
    await rows.nth(0).locator("td").nth(index).click();
    await drawer.waitFor({ state: "visible" });
    await closeDrawer();
  }
});

await check("clicking the event name still opens the drawer (keyboard path)", async () => {
  await rows.nth(0).locator("td").first().getByRole("button").focus();
  await page.keyboard.press("Enter");
  await drawer.waitFor({ state: "visible" });
  await closeDrawer();
});

await check("row actions menu does not open the drawer", async () => {
  await rows.nth(0).getByRole("button", { name: /^Actions for/ }).click();
  await page.getByRole("menu").waitFor({ state: "visible" });
  assert.equal(await drawer.count(), 0);
  await page.getByRole("menuitem", { name: "Copy public link" }).click();
  await page.waitForTimeout(500);
  assert.equal(await drawer.count(), 0, "menu item click bubbled through the portal and opened the drawer");
});

await check("Delete dialog cancel does not open the drawer", async () => {
  await rows.nth(0).getByRole("button", { name: /^Actions for/ }).click();
  await page.getByRole("menuitem", { name: "Delete event" }).click();
  await page.getByRole("alertdialog").waitFor({ state: "visible" });
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.waitForTimeout(500);
  assert.equal(await drawer.count(), 0);
});

await check("Open workspace in the drawer navigates to the event", async () => {
  await rows.nth(0).locator("td").nth(2).click();
  await drawer.waitFor({ state: "visible" });
  await drawer.getByRole("link", { name: "Open workspace" }).click();
  await page.waitForURL(/\/events\/[^/]+$/);
});

// ---------- Event workspace ----------
await page.waitForLoadState("networkidle");
await page.screenshot({ fullPage: true, path: shot("workspace") });

await check("workspace has no charts or progress bars", async () => {
  assert.equal(await page.locator(".recharts-wrapper, .recharts-surface, [data-slot=chart], [data-slot=progress], [role=progressbar]").count(), 0);
  assert.equal(await page.getByText("Entry pipeline").count(), 0);
});

await check("workspace header shows no date range", async () => {
  const header = page.locator("main h1").first().locator("xpath=ancestor::div[1]/..");
  const text = await header.innerText();
  assert.doesNotMatch(text, /UTC|→|\d{4},/);
});

await check("workspace KPI cards are plain numbers with no Ready / status labels", async () => {
  const kpis = page.locator('section[aria-label="Ticket state summary"]');
  assert.deepEqual((await kpis.locator('[data-slot="card-description"]').allInnerTexts()).map((t) => t.trim()), ["Tickets", "Claimed", "Enrolled", "Checked in"]);
  assert.equal(await kpis.locator('[data-slot="badge"]').count(), 0);
  for (const value of await kpis.locator('[data-slot="card-title"]').allInnerTexts()) assert.match(value.replace(/\s+/g, " ").trim(), /^\d+( ?\/ \d+)?$/);
  assert.equal(await page.getByText("Ready", { exact: true }).count(), 0);
  assert.equal(await page.getByText(/^(Critical|Fresh|Stale|Pending)$/).count(), 0);
});

await check("Allocation card uses the same row formatting as the Public link card", async () => {
  const allocation = page.locator('[data-slot="card"]', { has: page.getByText("Allocation", { exact: true }) });
  const share = page.locator('[data-slot="card"]', { has: page.getByText("Public link", { exact: true }) });
  const style = (loc) => loc.evaluate((el) => {
    const s = getComputedStyle(el);
    return { color: s.color, fontSize: s.fontSize, lineHeight: s.lineHeight, rowGap: s.rowGap };
  });
  const [aDl, sDl] = [allocation.locator("dl").first(), share.locator("dl").first()];
  const strip = ({ color, ...rest }) => rest;
  assert.deepEqual(strip(await style(aDl)), strip(await style(sDl)));
  assert.deepEqual(await style(aDl.locator("dt").first()), await style(sDl.locator("dt").first()));
  assert.deepEqual(await style(aDl.locator("dd").first()), await style(sDl.locator("dd").first()));
  for (const value of await allocation.locator("dd").allInnerTexts()) assert.match(value.replace(/\s+/g, " ").trim(), /^\d+( \/ \d+)?$/);
});

// ---------- Text box / label radius + inset audit ----------
// Measures the rendered distance from each control's border to its first/last glyph or icon,
// so it catches nested padding (input groups, icon buttons) that computed padding alone misses.
const fields = [];
fields.push(...await measure(page, "workspace"));
await page.getByRole("tab", { name: "Ticket types" }).click();
await page.getByRole("button", { name: "Add ticket type" }).click();
await page.getByRole("dialog").waitFor({ state: "visible" });
await page.waitForTimeout(300);
fields.push(...(await measure(page, "dialog")).filter((f) => f.kind !== "badge"));
await page.screenshot({ path: shot("ticket-type-dialog") });
await page.keyboard.press("Escape");
await page.goto(`${webUrl}/dashboard`, { waitUntil: "networkidle" });
fields.push(...await measure(page, "dashboard"));
await rows.nth(0).locator("td").nth(2).click();
await drawer.waitFor({ state: "visible" });
await page.waitForTimeout(400);
fields.push(...(await measure(page, "drawer")).filter((f) => f.kind !== "badge"));
await closeDrawer();

// Full-width buttons centre their label, so their insets are not padding; skip them.
const boxes = fields.filter((f) => f.kind !== "badge" && f.left < 40);
await check("text boxes, selects and buttons share one radius and height", async () => {
  assert.deepEqual([...new Set(boxes.map((f) => f.radius))], ["10px"]);
  assert.deepEqual([...new Set(boxes.filter((f) => f.h !== 64).map((f) => f.h))], [36]);
});
await check("text boxes, selects and buttons share one inset (12px to text, 10–11px to an icon)", async () => {
  const bad = boxes.flatMap((f) => [["left", f.left], ["right", f.right]].filter(([, v]) => v < 10 || v > 13.5).map(([side, v]) => `${f.where}/${f.kind}/${f.label || "∅"} ${side}=${v}`));
  assert.deepEqual(bad, []);
});
await check("labels (badges) share one radius, height and inset matching the text boxes' radius", async () => {
  const badges = fields.filter((f) => f.kind === "badge");
  assert.deepEqual([...new Set(badges.map((f) => `${f.radius}|${f.h}`))], ["10px|20"]);
  const bad = badges.filter((f) => f.left < 6 || f.left > 10 || f.right < 6 || f.right > 10);
  assert.deepEqual(bad, []);
});
console.table(fields.map(({ kind, where, label, left, right, radius, h }) => ({ kind, where, label, left, right, radius, h })));
await check("no browser console errors", async () => assert.deepEqual(consoleErrors.filter((e) => !/favicon|Download the React DevTools/.test(e)), []));

await browser.close();
console.log(results.join("\n"));
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
