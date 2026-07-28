/**
 * Small, page-level helpers reused across specs. These stable selectors are exercised by the
 * committed Playwright interaction and screenshot coverage.
 */
import type { Locator, Page } from "@playwright/test";

export type DepthLabel = "Workflow" | "Modules" | "Symbols";

/** Waits for the board to have rendered at least one step node. */
export async function waitForBoot(page: Page): Promise<void> {
  await page.locator("[data-step-node]").first().waitFor({ state: "visible", timeout: 15_000 });
}

export function workflowNavItem(page: Page, workflowName: string): Locator {
  return page.locator("button[data-workflow-item]").filter({ hasText: workflowName });
}

export async function selectWorkflowByName(page: Page, workflowName: string): Promise<void> {
  await workflowNavItem(page, workflowName).click();
}

export async function switchDepth(page: Page, depth: DepthLabel): Promise<void> {
  await page.getByRole("group", { name: "Detail level" }).getByRole("button", { name: depth, exact: true }).click();
}

export function stepNode(page: Page, stepId: string): Locator {
  return page.locator(`[data-step-node="${stepId}"]`);
}
