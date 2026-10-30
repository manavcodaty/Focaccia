import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import * as motion from "framer-motion";

import { CommandDemo, EnrollmentDemo, GateDecisionDemo } from "./animated-demos";
import { Hero } from "./hero";
import { Reveal } from "./reveal";

it.each([false, true])("hydrates visible content with reduced motion set to %s", async (reduced) => {
  const preference = vi.spyOn(motion, "useReducedMotion").mockReturnValue(null);
  const content = <><Hero /><Reveal>Visible content</Reveal><EnrollmentDemo /><CommandDemo /><GateDecisionDemo /></>;
  const container = document.createElement("div");
  container.innerHTML = renderToString(content);
  expect(container.innerHTML).not.toContain("opacity:0");
  preference.mockReturnValue(reduced);
  const errors: unknown[] = [];
  let root: ReturnType<typeof hydrateRoot> | undefined;

  try {
    await act(async () => {
      root = hydrateRoot(container, content, { onRecoverableError: (error) => errors.push(error) });
    });
    expect(errors).toEqual([]);
    expect(container.textContent).toContain("Your face is your ticket");
    expect(container.textContent).toContain("Visible content");
  } finally {
    await act(async () => root?.unmount());
    preference.mockRestore();
  }
});
