import { fireEvent, render, screen } from "@testing-library/react";
import { SpotlightCard } from "./spotlight-card";

it("renders content and accepts pointer movement", () => {
  render(<SpotlightCard>Privacy component</SpotlightCard>);
  const card = screen.getByText("Privacy component");
  fireEvent.mouseMove(card, { clientX: 30, clientY: 40 });
  expect(card).toBeVisible();
});
