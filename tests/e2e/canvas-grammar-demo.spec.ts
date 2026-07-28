/**
 * Uses a disposable copy of MotionA only as the host repository, then injects the explicitly
 * synthetic e2e fixture. The demo is never committed under examples/motiona and makes no claim
 * about that example's source behavior.
 */
import { promises as fsp } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { selectWorkflowByName, waitForBoot } from "./helpers/app";
import { createTempFixtureCopy, removeTempDir } from "./helpers/fixture";
import { PORTS, REPO_ROOT } from "./helpers/paths";
import { startObservatoryServer, type ManagedServer } from "./helpers/server";

const ARTIFACT_DIR = path.join(REPO_ROOT, ".amp", "in", "artifacts");
const DEMO_SOURCE = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "canvas-grammar-demo.json");
let root: string;
let server: ManagedServer;

async function setTheme(page: Page, theme: "dark" | "light"): Promise<void> {
  const current = await page.locator("html").getAttribute("data-theme");
  if (current !== theme) {
    await page.getByRole("button", { name: `Switch to ${theme} theme` }).click();
  }
  await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
}

async function capture(page: Page, workflow: string, slug: string, theme: "dark" | "light"): Promise<void> {
  await selectWorkflowByName(page, workflow);
  await waitForBoot(page);
  await setTheme(page, theme);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, `${slug}-${theme}-1440x900.png`), animations: "disabled" });
}

test.beforeAll(async () => {
  root = await createTempFixtureCopy("canvas-grammar");
  await fsp.copyFile(DEMO_SOURCE, path.join(root, ".observatory", "workflows", "canvas-grammar-demo.json"));
  await fsp.mkdir(ARTIFACT_DIR, { recursive: true });
  server = await startObservatoryServer(root, PORTS.canvasGrammar);
});

test.afterAll(async () => {
  await server.stop();
  await removeTempDir(root);
});

test("renders the synthetic retry, return, async, fan-out/fan-in, and outcomes without overlaps", async ({ page }) => {
  await page.goto(server.url);
  await waitForBoot(page);
  await selectWorkflowByName(page, "Canvas Grammar Demo");
  await expect(page.locator('[data-step-node="accept-job"]')).toBeVisible();

  for (const label of ["retry ≤3", "re-encode", "handoff", "invalid", "queued"]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }

  const retry = page.locator('.react-flow__edge[data-id="retry-encode"] path.react-flow__edge-path');
  const returned = page.locator('.react-flow__edge[data-id="review-reencode"] path.react-flow__edge-path');
  const asyncHandoff = page.locator('.react-flow__edge[data-id="review-notify"] path.react-flow__edge-path');
  await expect(retry).toHaveCSS("stroke-dasharray", /6px, 4px/);
  await expect(returned).toHaveCSS("stroke-dasharray", /6px, 4px/);
  await expect(asyncHandoff).toHaveCSS("stroke-dasharray", /1.5px, 4px/);
  expect(await retry.getAttribute("d")).not.toBe(await returned.getAttribute("d"));

  await expect(page.locator('[data-step-node="outcome-created"]')).toHaveAttribute("aria-label", /^Success outcome:/);
  await expect(page.locator('[data-step-node="outcome-rejected"]')).toHaveAttribute("aria-label", /^Failure outcome:/);
  await expect(page.locator('[data-step-node="outcome-queued"]')).toHaveAttribute("aria-label", /^Outcome:/);

  const overlaps = await page.locator("[data-step-node]").evaluateAll((nodes) => {
    const entries = nodes.map((node) => ({ id: (node as HTMLElement).dataset.stepNode ?? "?", rect: node.getBoundingClientRect() }));
    return entries.flatMap((left, index) => entries.slice(index + 1).flatMap((right) => {
      const intersects = left.rect.left < right.rect.right && left.rect.right > right.rect.left &&
        left.rect.top < right.rect.bottom && left.rect.bottom > right.rect.top;
      return intersects ? [`${left.id}/${right.id}`] : [];
    }));
  });
  expect(overlaps).toEqual([]);
});

test("captures deterministic dark and light review screenshots", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(server.url);
  await waitForBoot(page);

  for (const theme of ["dark", "light"] as const) {
    await capture(page, "Generate Video Prompt", "generate-video", theme);
    await capture(page, "Upload Reference Asset", "upload-assets", theme);
    await capture(page, "Canvas Grammar Demo", "canvas-grammar-demo", theme);
  }
});
