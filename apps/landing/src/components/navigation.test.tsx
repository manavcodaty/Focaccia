import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Navigation } from "./navigation";

describe("Navigation", () => {
  it("exposes section links and conversion destinations", () => {
    render(<Navigation />);
    expect(screen.getByRole("link", { name: "How it works" })).toHaveAttribute("href", "#how-it-works");
    expect(screen.getByRole("link", { name: "Browse events" })).toHaveAttribute("href", "http://127.0.0.1:3001");
    expect(screen.getAllByRole("link", { name: "For organizers" }).some((link) => link.getAttribute("href") === "http://127.0.0.1:3000/login")).toBe(true);
  });

  it("opens and closes the mobile menu", async () => {
    const user = userEvent.setup();
    render(<Navigation />);
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("dialog")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Close navigation" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
