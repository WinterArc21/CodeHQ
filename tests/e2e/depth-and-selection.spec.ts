/**
 * Runs against the shared, read-only server (see playwright.config.ts's `webServer`).
 */
import { expect, test } from "@playwright/test";
import { switchDepth } from "./helpers/app";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.locator("[data-step-node]").first().waitFor({ state: "visible", timeout: 15_000 });
});

test("switching depth changes a node's rendered content", async ({ page }) => {
  // At "workflow" depth, StepNode never renders a Files/Symbols section.
  await expect(page.getByText("Files", { exact: true })).toHaveCount(0);

  await switchDepth(page, "Modules");

  // "modules" depth adds a Files section naming the step's source file.
  const node = page.locator('[data-step-node="receive-request"]');
  await expect(node.getByText("Files", { exact: true })).toBeVisible();
  await expect(node).toContainText("route.ts");
});

test("clicking a node opens the step drawer showing that step's name and purpose", async ({ page }) => {
  await page.locator('[data-step-node="scrape-website"]').click();

  // StepDrawer sets both aria-label ("... details") and aria-labelledby (pointing at the h2);
  // per the accessible-name algorithm aria-labelledby wins, so the dialog's real accessible
  // name is just the step name.
  const drawer = page.getByRole("dialog", { name: "Scrape Website" });
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole("heading", { name: "Scrape Website" })).toBeVisible();
  await expect(drawer).toContainText("Fetches the submitted page and extracts its title, description, body text, and images.");
});

test("keyboard navigation moves selection between steps", async ({ page }) => {
  const first = page.locator('[data-step-node="receive-request"]');
  await first.focus();
  await expect(first).toBeFocused();

  await first.press("ArrowDown");
  const second = page.locator('[data-step-node="validate-request"]');
  await expect(second).toBeFocused();

  await second.press("ArrowRight");
  const third = page.locator('[data-step-node="check-quota"]');
  await expect(third).toBeFocused();

  await third.press("ArrowLeft");
  await expect(second).toBeFocused();
});

test("Escape closes the drawer and restores focus to the originating node", async ({ page }) => {
  const node = page.locator('[data-step-node="check-quota"]');
  await node.click();

  const drawer = page.getByRole("dialog", { name: "Check Quota" });
  await expect(drawer).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(node).toBeFocused();
});
