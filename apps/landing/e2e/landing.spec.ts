import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

function parseEnvFile(): Record<string, string> {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return {};

  return Object.fromEntries(
    readFileSync(envPath, "utf8")
      .split(/\r?\n/)
      .flatMap((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return [];
        const separator = trimmed.indexOf("=");
        if (separator < 1) return [];
        return [[trimmed.slice(0, separator), trimmed.slice(separator + 1).replace(/^"|"$/g, "")]];
      }),
  );
}

function selectedOrigin(value: string | undefined, fallback: string): string {
  return new URL(value?.trim() || fallback).origin;
}

function normalizeHref(value: string | null): string {
  if (!value) return "";
  return value.replace(/\/$/, "");
}

test("landing page navigation, FAQ, and layout remain usable", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Your face is your ticket" })).toBeVisible();
  await expect(page.locator("img")).toHaveCount(0);

  await page.getByRole("link", { name: "Explore the system" }).click();
  await expect(page.locator("#how-it-works")).toBeInViewport();

  await page.getByRole("button", { name: "Is biometric data stored centrally?" }).click();
  await expect(page.getByText(/Raw images and embeddings are never uploaded/)).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test("conversion links preserve their destinations", async ({ page }) => {
  await page.goto("/");
  const env = parseEnvFile();
  const ticketsOrigin = selectedOrigin(env.NEXT_PUBLIC_FOCACCIA_TICKETS_URL, "http://127.0.0.1:3001");
  const webOrigin = selectedOrigin(env.NEXT_PUBLIC_FOCACCIA_WEB_URL, "http://127.0.0.1:3000");
  const organizerHref = `${webOrigin}/login`;
  const attendeeLinks = page.getByRole("link", { name: /browse events/i });
  const organizerLinks = page.getByRole("link", { name: /for organizers|open dashboard/i });

  expect(await attendeeLinks.count()).toBeGreaterThan(0);
  expect(await organizerLinks.count()).toBeGreaterThan(0);
  expect(await attendeeLinks.evaluateAll((links, expected) => links.every((link) => link.getAttribute("href")?.replace(/\/$/, "") === expected), normalizeHref(ticketsOrigin))).toBe(true);
  expect(
    await organizerLinks.evaluateAll(
      (links, expected) => links
        .map((link) => link.getAttribute("href")?.replace(/\/$/, "") ?? "")
        .filter((href) => href.startsWith("http"))
        .every((href) => href === expected),
      normalizeHref(organizerHref),
    ),
  ).toBe(true);
});

test("mobile menu is keyboard and touch accessible", async ({ page }) => {
  test.skip((await page.viewportSize())!.width > 600, "mobile project only");
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
