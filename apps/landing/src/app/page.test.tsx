import { render, screen } from "@testing-library/react";
import { beforeEach, expect, vi } from "vitest";
import LandingPage from "./page";

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_FOCACCIA_TICKETS_URL", "https://tickets.focaccia.test/events?ignored=true");
  vi.stubEnv("NEXT_PUBLIC_FOCACCIA_WEB_URL", "https://organizer.focaccia.test/workspace");
});

it("renders a semantic full landing page", () => {
  render(<LandingPage />);
  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "How it works" })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Private by design." })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Run your event." })).toBeVisible();
  expect(screen.getByRole("contentinfo")).toBeInTheDocument();
});

it("links conversion actions to the configured app origins", () => {
  render(<LandingPage />);

  for (const link of screen.getAllByRole("link", { name: /browse events/i })) {
    expect(link).toHaveAttribute("href", "https://tickets.focaccia.test");
  }

  expect(
    screen
      .getAllByRole("link", { name: /for organizers/i })
      .some((link) => link.getAttribute("href") === "https://organizer.focaccia.test/login"),
  ).toBe(true);
});
