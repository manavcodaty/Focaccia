import { expect, test } from "@playwright/test";

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
  const attendeeLinks = page.locator('a[href="/events"]');
  const organizerLinks = page.locator('a[href="/organizer/login"]');

  expect(await attendeeLinks.count()).toBeGreaterThan(0);
  expect(await organizerLinks.count()).toBeGreaterThan(0);
  expect(await attendeeLinks.evaluateAll((links) => links.every((link) => link.getAttribute("href") === "/events"))).toBe(true);
  expect(await organizerLinks.evaluateAll((links) => links.every((link) => link.getAttribute("href") === "/organizer/login"))).toBe(true);
});

test("mobile menu is keyboard and touch accessible", async ({ page }) => {
  test.skip((await page.viewportSize())!.width > 600, "mobile project only");
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
});
