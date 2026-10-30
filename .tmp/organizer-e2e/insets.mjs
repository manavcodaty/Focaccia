import { createRequire } from "node:module";
import path from "node:path";

import { organizerSession, webUrl } from "./session.mjs";

const { chromium } = createRequire(path.resolve(import.meta.dirname, "../../package.json"))("@playwright/test");
const session = await organizerSession();
const browser = await chromium.launch({ executablePath: `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-mac-arm64/chrome-headless-shell` });
const context = await browser.newContext({ viewport: { height: 1000, width: 1440 } });
await context.addCookies(session.cookies);
const page = await context.newPage();

/** Distance from each control's border edge to its first/last visible glyph or icon. */
export const measure = (where) => page.evaluate((where) => {
  const rectsOf = (root) => {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let node = walker.currentNode; node; node = walker.nextNode()) {
      if (node.nodeType === 3 && node.textContent.trim()) {
        const range = document.createRange(); range.selectNodeContents(node);
        out.push(...[...range.getClientRects()].filter((r) => r.width > 0));
      } else if (node.nodeType === 1 && (node.tagName === "svg" || node.tagName === "INPUT" || node.tagName === "TEXTAREA")) {
        if (node.tagName === "svg") { const r = node.getBoundingClientRect(); if (r.width) out.push(r); }
        else {
          // text start inside an input = border + padding of the input itself
          const s = getComputedStyle(node); const r = node.getBoundingClientRect();
          out.push({ left: r.left + parseFloat(s.borderLeftWidth) + parseFloat(s.paddingLeft), right: r.right - parseFloat(s.borderRightWidth) - parseFloat(s.paddingRight), width: 1 });
        }
      }
    }
    return out;
  };
  const sel = {
    badge: '[data-slot="badge"]',
    button: '[data-slot="button"][data-size="default"]:not([data-variant="link"]):not([data-variant="ghost"])',
    input: '[data-slot="input"]:not([data-slot="input-group-control"]), [data-slot="textarea"]',
    "input-group": '[data-slot="input-group"]',
    select: '[data-slot="select-trigger"]',
  };
  return Object.entries(sel).flatMap(([kind, selector]) => [...document.querySelectorAll(selector)].filter((el) => el.offsetParent && !el.closest(".sr-only") && el.innerText !== "Skip to main content").map((el) => {
    const box = el.getBoundingClientRect();
    const rects = rectsOf(el);
    const left = Math.min(...rects.map((r) => r.left)) - box.left;
    const right = box.right - Math.max(...rects.map((r) => r.right));
    return { kind, where, label: (el.innerText || el.querySelector("input")?.placeholder || el.getAttribute("placeholder") || "").trim().slice(0, 22), left: Math.round(left * 10) / 10, right: Math.round(right * 10) / 10, radius: getComputedStyle(el).borderTopLeftRadius, h: Math.round(box.height) };
  }));
}, where);

const rows = [];
await page.goto(`${webUrl}/dashboard`, { waitUntil: "networkidle" });
rows.push(...await measure("dashboard"));
await page.goto(`${webUrl}/events/${process.argv[2] ?? "testing_6"}`, { waitUntil: "networkidle" });
rows.push(...await measure("workspace"));
console.log("KPI titles", JSON.stringify(await page.locator('section[aria-label="Ticket state summary"] [data-slot="card-title"]').allInnerTexts()));
await page.getByRole("tab", { name: "Ticket types" }).click();
await page.getByRole("button", { name: "Add ticket type" }).click();
await page.waitForTimeout(400);
rows.push(...(await measure("dialog")).filter((r) => r.kind !== "badge"));
await browser.close();
console.table(rows);
