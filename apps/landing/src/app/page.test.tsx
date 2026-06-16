import { render, screen } from "@testing-library/react";
import LandingPage from "./page";

it("renders a semantic full landing page", () => {
  render(<LandingPage />);
  expect(screen.getByRole("main")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "From discovery to the door." })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Private by architecture, not by promise." })).toBeVisible();
  expect(screen.getByRole("heading", { name: "Run the room, not the queue." })).toBeVisible();
  expect(screen.getByRole("contentinfo")).toBeInTheDocument();
});
