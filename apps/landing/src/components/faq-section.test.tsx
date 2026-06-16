import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FaqSection } from "./faq-section";

it("reveals FAQ answers accessibly", async () => {
  const user = userEvent.setup();
  render(<FaqSection />);
  const trigger = screen.getByRole("button", { name: "Is biometric data stored centrally?" });
  await user.click(trigger);
  expect(screen.getByText(/Raw images and embeddings are never uploaded/)).toBeVisible();
});
