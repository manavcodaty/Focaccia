import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";

import { measure } from "./measure.mjs";
import { organizerSession, webUrl } from "./session.mjs";

const { chromium } = createRequire(path.resolve(import.meta.dirname, "../../package.json"))("@playwright/test");
const session = await organizerSession();
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell` });
const context = await browser.newContext({ viewport: { height: 1000, width: 1440 } });
await context.addCookies(session.cookies);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

const id = process.argv[2] ?? "testing_6";
const results = [];
const fields = [];
for (const route of ["/events/new", `/events/${id}/edit`, `/events/${id}/provisioning`, `/events/${id}/revocations`, `/events/${id}/logs`]) {
  const response = await page.goto(`${webUrl}${route}`, { waitUntil: "networkidle" });
  const name = route.split("/").at(-1);
  await page.screenshot({ fullPage: true, path: path.join(import.meta.dirname, `after-page-${name}.png`) });
  try {
    assert.equal(response.status(), 200);
    if (route !== "/events/new") {
      const headerText = await page.locator("main h1").first().locator("xpath=ancestor::div[1]/..").innerText();
      assert.doesNotMatch(headerText, /UTC|→/, `${route} header still shows a date`);
    }
    results.push(`PASS ${route}`);
  } catch (error) { results.push(`FAIL ${route}: ${error.message}`); }
  fields.push(...await measure(page, name));
}

const boxes = fields.filter((f) => f.kind !== "badge" && f.left < 40);
const bad = boxes.flatMap((f) => [["left", f.left], ["right", f.right]].filter(([, v]) => v < 10 || v > 13.5).map(([s, v]) => `${f.where}/${f.kind}/${f.label || "∅"} ${s}=${v}`));
const radii = [...new Set(fields.map((f) => f.radius))];
results.push(bad.length ? `FAIL insets: ${bad.join("; ")}` : "PASS insets on other pages");
results.push(radii.length === 1 && radii[0] === "10px" ? "PASS one radius (10px) on other pages" : `FAIL radii ${radii}`);
results.push(errors.length ? `FAIL console: ${errors.join(" | ")}` : "PASS no console errors");
console.table(fields.map(({ kind, where, label, left, right, radius, h }) => ({ kind, where, label, left, right, radius, h })));
console.log(results.join("\n"));
await browser.close();
if (results.some((r) => r.startsWith("FAIL"))) process.exit(1);
