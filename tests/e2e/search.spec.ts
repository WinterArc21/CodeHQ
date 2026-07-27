/**
 * Runs against the shared, read-only server (see playwright.config.ts's `webServer`).
 */
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-step-node]").first().waitFor({ state: "visible", timeout: 15_000 });
});

test("Ctrl+K opens the palette, typing filters results, and Enter opens the matching workflow/step/drawer", async ({
  page,
}) => {
  await page.keyboard.press("Control+k");
  const dialog = page.getByRole("dialog", { name: "Search Code Observatory" });
  await expect(dialog).toBeVisible();

  const input = dialog.getByRole("combobox");
  await expect(input).toBeFocused();

  // Empty query: the default listing is every workflow (2) plus the fixed action list (3).
  await expect(dialog.getByRole("option")).toHaveCount(5);
  await expect(dialog.getByRole("option").filter({ hasText: "Generate Video Prompt" })).toBeVisible();
  await expect(dialog.getByRole("option").filter({ hasText: "Upload Reference Asset" })).toBeVisible();

  // Search for a step that lives in the NON-default workflow, so activating it proves the
  // palette switches workflows, not just steps within the one already on screen.
  await input.fill("Validate File");

  const results = dialog.getByRole("option");
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText("Validate File");
  await expect(results.first()).toContainText("Upload Reference Asset");

  await input.press("Enter");
  await expect(dialog).toBeHidden();

  // The correct workflow is now showing (not the default "Generate Video Prompt")...
  await expect(page.locator('button[data-workflow-item][aria-current="true"]')).toContainText("Upload Reference Asset");

  // ...the step drawer opened for the matched step (StepDrawer's accessible name comes from
  // aria-labelledby, which wins over its redundant aria-label, so it's just the step name)...
  const drawer = page.getByRole("dialog", { name: "Validate File" });
  await expect(drawer).toBeVisible();

  // ...and the canvas re-centred so the selected node is actually in view (search→canvas
  // centering), not just selected off-screen.
  await expect(page.locator('[data-step-node="validate-file"]')).toBeInViewport();
});
