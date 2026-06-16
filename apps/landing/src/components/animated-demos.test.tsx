import { act, render, screen } from "@testing-library/react";
import { CommandDemo, EnrollmentDemo, EventSearchDemo, GateDecisionDemo, ReadinessList, SyncQueue, TicketDemo } from "./animated-demos";

describe("animated SaaS demos", () => {
  it("renders each product state without product imagery", () => {
    render(
      <>
        <EventSearchDemo />
        <TicketDemo />
        <EnrollmentDemo />
        <GateDecisionDemo />
        <ReadinessList />
        <CommandDemo />
        <SyncQueue />
      </>,
    );
    expect(screen.getByDisplayValue("Summer Assembly")).toBeVisible();
    expect(screen.getByText("One ticket, claimed.")).toBeVisible();
    expect(screen.getByText("Encrypting locally")).toBeVisible();
    expect(screen.getByText("Admit")).toBeVisible();
    expect(screen.getByText("Revocations refreshed")).toBeVisible();
    expect(screen.getByText("Show gates that need a refresh")).toBeVisible();
    expect(screen.getByText("North entrance")).toBeVisible();
    expect(document.querySelector("img")).not.toBeInTheDocument();
  });

  it("cleans up timed transitions", () => {
    vi.useFakeTimers();
    const view = render(<><EnrollmentDemo /><ReadinessList /><CommandDemo /><SyncQueue /></>);
    act(() => vi.advanceTimersByTime(5000));
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it("renders stable states when reduced motion is requested", () => {
    const view = render(<><EnrollmentDemo /><GateDecisionDemo /><ReadinessList /><CommandDemo /><SyncQueue /></>);
    expect(screen.getByText("100%")).toBeVisible();
    expect(screen.getByText("Show gates that need a refresh")).toBeVisible();
    view.unmount();
  });
});
