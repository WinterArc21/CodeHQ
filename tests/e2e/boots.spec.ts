/**
 * Runs against the shared, read-only server (see playwright.config.ts's `webServer`), which
 * serves a private temp copy of `examples/motiona` — never the committed fixture itself.
 */
import { expect, test } from "@playwright/test";

test("loads the example project, auto-selects the default workflow, and renders its board with no console errors", async ({
  page,
}) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });

  await page.goto("/");
  await page.locator("[data-step-node]").first().waitFor({ state: "visible", timeout: 15_000 });

  // Repository name (from .observatory/project.json's project.name) appears in the top bar.
  await expect(page.getByText("MotionA", { exact: true })).toBeVisible();

  // The default workflow (settings.defaultWorkflowId === "generate-video") is auto-selected.
  const defaultWorkflowItem = page.locator('button[data-workflow-item][aria-current="true"]');
  await expect(defaultWorkflowItem).toContainText("Generate Video Prompt");

  // Its 7 step nodes render.
  await expect(page.locator("[data-step-node]")).toHaveCount(7);

  // Its 9 connectors render, each with non-zero rendered geometry.
  const edges = page.locator(".react-flow__edge");
  await expect(edges).toHaveCount(9);

  const edgePathLengths = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".react-flow__edge path.react-flow__edge-path")).map((el) =>
      (el as SVGPathElement).getTotalLength(),
    ),
  );
  expect(edgePathLengths).toHaveLength(9);
  for (const length of edgePathLengths) {
    expect(length).toBeGreaterThan(0);
  }

  expect(consoleErrors, `Unexpected browser console errors during load:\n${consoleErrors.join("\n")}`).toEqual([]);
  expect(pageErrors, `Unexpected uncaught page errors during load:\n${pageErrors.join("\n")}`).toEqual([]);
});
