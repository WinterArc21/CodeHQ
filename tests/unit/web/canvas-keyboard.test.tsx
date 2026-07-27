import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import type { Workflow } from "@schema/workflow";
import { WorkflowCanvas } from "@web/components/canvas";
import { resetObservatoryStore, useObservatoryStore } from "@web/store/useObservatoryStore";

const WORKFLOW: Workflow = {
  schemaVersion: "0.1",
  id: "checkout",
  name: "Checkout",
  purpose: "Captures payment for a cart.",
  steps: [
    { id: "receive", name: "Receive Request", purpose: "Accepts the checkout payload." },
    { id: "validate", name: "Validate Cart", purpose: "Confirms the cart is still valid." },
    { id: "charge", name: "Charge Card", purpose: "Captures the payment." },
    { id: "confirm", name: "Send Confirmation", purpose: "Emails the receipt." },
  ],
  connections: [
    { from: "receive", to: "validate" },
    { from: "validate", to: "charge" },
    { from: "charge", to: "confirm" },
  ],
};

afterEach(() => {
  resetObservatoryStore();
});

/**
 * The canvas frame now has a real, focusable header (depth switch, zoom, fit, collapse-all —
 * contract §10.4) sitting before the graph in DOM/tab order, so reaching the first step node no
 * longer takes exactly one Tab press. Presses Tab until a `[data-step-node]` element is focused,
 * capped well above the toolbar's control count so a real regression still fails loudly instead
 * of hanging.
 */
async function tabToFirstStepNode(user: ReturnType<typeof userEvent.setup>): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await user.tab();
    if ((document.activeElement as HTMLElement | null)?.dataset.stepNode !== undefined) {
      return;
    }
  }
}

describe("WorkflowCanvas keyboard navigation", () => {
  it("is reachable by Tab and exposes an accessible name", async () => {
    render(<WorkflowCanvas workflow={WORKFLOW} sourceChecks={{}} />);
    expect(await screen.findByRole("application", { name: /checkout workflow canvas/i })).toBeInTheDocument();

    const user = userEvent.setup();
    await tabToFirstStepNode(user);
    await waitFor(() => {
      expect(document.querySelector('[data-step-node="receive"]')).toHaveFocus();
    });
  });

  it("moves focus to a successor on ArrowRight and a predecessor on ArrowLeft", async () => {
    render(<WorkflowCanvas workflow={WORKFLOW} sourceChecks={{}} />);
    const user = userEvent.setup();

    await tabToFirstStepNode(user);
    await waitFor(() => expect(document.querySelector('[data-step-node="receive"]')).toHaveFocus());

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(document.querySelector('[data-step-node="validate"]')).toHaveFocus());

    await user.keyboard("{ArrowRight}");
    await waitFor(() => expect(document.querySelector('[data-step-node="charge"]')).toHaveFocus());

    await user.keyboard("{ArrowLeft}");
    await waitFor(() => expect(document.querySelector('[data-step-node="validate"]')).toHaveFocus());
  });

  it("moves to the last step in topological order on End, and back to first on Home", async () => {
    render(<WorkflowCanvas workflow={WORKFLOW} sourceChecks={{}} />);
    const user = userEvent.setup();

    await tabToFirstStepNode(user);
    await waitFor(() => expect(document.querySelector('[data-step-node="receive"]')).toHaveFocus());

    await user.keyboard("{End}");
    await waitFor(() => expect(document.querySelector('[data-step-node="confirm"]')).toHaveFocus());

    await user.keyboard("{Home}");
    await waitFor(() => expect(document.querySelector('[data-step-node="receive"]')).toHaveFocus());
  });

  it("selects the focused step in the store on Enter, and clears it on Escape", async () => {
    render(<WorkflowCanvas workflow={WORKFLOW} sourceChecks={{}} />);
    const user = userEvent.setup();

    await tabToFirstStepNode(user);
    await waitFor(() => expect(document.querySelector('[data-step-node="receive"]')).toHaveFocus());

    await user.keyboard("{Enter}");
    await waitFor(() => expect(useObservatoryStore.getState().selectedStepId).toBe("receive"));

    await user.keyboard("{Escape}");
    await waitFor(() => expect(useObservatoryStore.getState().selectedStepId).toBeNull());
  });
});
