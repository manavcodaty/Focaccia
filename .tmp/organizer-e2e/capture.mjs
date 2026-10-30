import { createRequire } from "node:module";
import path from "node:path";

const { chromium } = createRequire(path.resolve(import.meta.dirname, "../../package.json"))("@playwright/test");

import { organizerSession, webUrl } from "./session.mjs";

const label = process.argv[2] ?? "before";
const out = (name) => path.join(import.meta.dirname, `${label}-${name}.png`);

const session = await organizerSession();
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell` });
const context = await browser.newContext({ viewport: { height: 1000, width: 1440 } });
await context.addCookies(session.cookies);
const page = await context.newPage();

await page.goto(`${webUrl}/dashboard`, { waitUntil: "networkidle" });
await page.screenshot({ fullPage: true, path: out("dashboard") });
console.log("dashboard url", page.url());

const firstRow = page.locator('table[aria-label="Events"] tbody tr').first();
console.log("rows", await page.locator('table[aria-label="Events"] tbody tr').count());
await firstRow.locator("button").first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: out("drawer") });
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

const href = await page.locator('table[aria-label="Events"] tbody tr').first().evaluate(() => null);
const eventLinks = await page.locator('a[href^="/events/evt"], a[href^="/events/"]').evaluateAll((links) => links.map((a) => a.getAttribute("href")));
console.log("links", [...new Set(eventLinks)].slice(0, 10), href);
const target = process.argv[3] ?? eventLinks.find((h) => /^\/events\/[^/]+$/.test(h) && h !== "/events/new");
await page.goto(`${webUrl}${target}`, { waitUntil: "networkidle" });
await page.screenshot({ fullPage: true, path: out("workspace") });
await browser.close();
