import { render, screen } from "@testing-library/react";
import { Hero } from "./hero";

it("preserves the approved hero content and crowd canvas", () => {
  render(<Hero />);
  expect(screen.getByRole("heading", { level: 1, name: "Your face is your ticket" })).toBeVisible();
  expect(screen.getByRole("link", { name: "Browse Events" })).toHaveAttribute("href", "/events");
  expect(screen.getByRole("link", { name: "For Organizers" })).toHaveAttribute("href", "/organizer/login");
  expect(screen.getByLabelText("Animated crowd of event attendees")).toBeInTheDocument();
});
