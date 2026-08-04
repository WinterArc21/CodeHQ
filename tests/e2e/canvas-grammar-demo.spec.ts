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
import { startCodeHQServer, type ManagedServer } from "./helpers/server";

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

/**
 * Samples the browser's final SVG geometry in screen coordinates. Every unrelated card is an
 * obstacle with a visible safety margin. Source and target cards are exempt only near the path's
 * own endpoints, where touching the boundary is required; the rest of a long route is still
 * checked against them, preventing a return path from disappearing behind one of its own cards
 * later in the route.
 */
async function renderedEdgeNodeOcclusions(page: Page, clearancePx = 12): Promise<string[]> {
  return page.locator("[data-workflow-edge]").evaluateAll((edgeGroups, clearance) => {
    if (edgeGroups.length === 0) {
      return ["missing-rendered-edges"];
    }
    const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-step-node]")).map((node) => ({
      id: node.dataset.stepNode ?? "?",
      rect: node.getBoundingClientRect(),
    }));
    const occlusions = new Set<string>();

    for (const group of edgeGroups) {
      const edge = group as SVGGElement;
      const edgeId = edge.dataset.workflowEdge ?? "?";
      const sourceId = edge.dataset.edgeSource;
      const targetId = edge.dataset.edgeTarget;
      const path = edge.querySelector<SVGPathElement>("path.react-flow__edge-path");
      const matrix = path?.getScreenCTM();
      if (path === null || matrix === null) {
        occlusions.add(`${edgeId}/missing-path`);
        continue;
      }

      const length = path.getTotalLength();
      const samples = Math.max(2, Math.ceil(length));
      for (let index = 0; index <= samples; index += 1) {
        const distance = (length * index) / samples;
        const point = path.getPointAtLength(distance);
        const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        for (const node of nodes) {
          const isEndpoint = node.id === sourceId || node.id === targetId;
          const isNearOwnEndpoint = isEndpoint && (distance <= 90 || length - distance <= 90);
          if (isNearOwnEndpoint) {
            continue;
          }
          const nodeClearance = isEndpoint ? 1 : clearance;
          if (
            screenPoint.x > node.rect.left - nodeClearance &&
            screenPoint.x < node.rect.right + nodeClearance &&
            screenPoint.y > node.rect.top - nodeClearance &&
            screenPoint.y < node.rect.bottom + nodeClearance
          ) {
            occlusions.add(`${edgeId}/${node.id}`);
          }
        }
      }
    }
    return Array.from(occlusions).sort();
  }, clearancePx);
}

async function edgeEndpointDistance(
  page: Page,
  edgeId: string,
  nodeId: string,
  handleId: string,
  endpoint: "source" | "target",
): Promise<number> {
  return page.evaluate(({ edgeId, nodeId, handleId, endpoint }) => {
    const path = document.querySelector<SVGPathElement>(
      `.react-flow__edge[data-id="${edgeId}"] path.react-flow__edge-path`,
    );
    const handle = document.querySelector<HTMLElement>(
      `[data-nodeid="${nodeId}"][data-handleid="${handleId}"]`,
    );
    if (path === null || handle === null) {
      return Number.POSITIVE_INFINITY;
    }
    const point = path.getPointAtLength(endpoint === "source" ? 0 : path.getTotalLength());
    const screenPoint = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM() ?? new DOMMatrix());
    const rect = handle.getBoundingClientRect();
    return Math.hypot(screenPoint.x - (rect.left + rect.width / 2), screenPoint.y - (rect.top + rect.height / 2));
  }, { edgeId, nodeId, handleId, endpoint });
}

test.beforeAll(async () => {
  root = await createTempFixtureCopy("canvas-grammar");
  await fsp.copyFile(DEMO_SOURCE, path.join(root, ".codehq", "workflows", "canvas-grammar-demo.json"));
  await fsp.mkdir(ARTIFACT_DIR, { recursive: true });
  server = await startCodeHQServer(root, PORTS.canvasGrammar);
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
  await expect(retry).toHaveCSS("stroke-dasharray", /8px, 6px/);
  await expect(returned).toHaveCSS("stroke-dasharray", /8px, 6px/);
  await expect(asyncHandoff).toHaveCSS("stroke-dasharray", /1px, 6px/);
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
  expect(await renderedEdgeNodeOcclusions(page)).toEqual([]);
});

test("keeps every example-workflow edge clear of card interiors", async ({ page }) => {
  await page.goto(server.url);
  await waitForBoot(page);

  for (const workflow of ["Generate Video Prompt", "Upload Reference Asset", "Canvas Grammar Demo"]) {
    await selectWorkflowByName(page, workflow);
    await waitForBoot(page);
    expect(await renderedEdgeNodeOcclusions(page), workflow).toEqual([]);
  }
});

test("keeps a connection attached while its card is freely dragged", async ({ page }) => {
  await page.goto(server.url);
  await waitForBoot(page);
  await selectWorkflowByName(page, "Generate Video Prompt");

  const node = page.locator('[data-step-node="validate-request"]');
  const edge = page.locator('.react-flow__edge[data-id^="receive-request->validate-request"] path.react-flow__edge-path');
  const before = await edge.getAttribute("d");
  const box = await node.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width / 2 + 120, box!.y + box!.height / 2 + 70, { steps: 12 });
  await page.mouse.up();

  await expect.poll(() => edge.getAttribute("d")).not.toBe(before);
  const endpointDistance = await edge.evaluate((path) => {
    const svgPath = path as SVGPathElement;
    const endpoint = svgPath.getPointAtLength(svgPath.getTotalLength());
    const screenEndpoint = new DOMPoint(endpoint.x, endpoint.y).matrixTransform(svgPath.getScreenCTM() ?? new DOMMatrix());
    const handle = document.querySelector<HTMLElement>('[data-nodeid="validate-request"][data-handleid="in"]');
    if (handle === null) return Number.POSITIVE_INFINITY;
    const rect = handle.getBoundingClientRect();
    return Math.hypot(screenEndpoint.x - (rect.left + rect.width / 2), screenEndpoint.y - (rect.top + rect.height / 2));
  });
  expect(endpointDistance).toBeLessThan(5);
});

test("switches ordinary connections to the closest facing card sides while dragging", async ({ page }) => {
  await page.goto(server.url);
  await waitForBoot(page);
  await selectWorkflowByName(page, "Generate Video Prompt");

  const edgeId = "receive-request->validate-request#0";
  const sourceId = "receive-request";
  const targetId = "validate-request";
  const source = page.locator(`[data-step-node="${sourceId}"]`);
  const target = page.locator(`[data-step-node="${targetId}"]`);
  const sourceBox = await source.boundingBox();
  const initialTargetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(initialTargetBox).not.toBeNull();

  // Move B from the right of A to the left. Assert before mouse-up to prove the handles switch
  // continuously during the drag rather than only after React Flow commits a final position.
  await page.mouse.move(
    initialTargetBox!.x + initialTargetBox!.width / 2,
    initialTargetBox!.y + initialTargetBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    sourceBox!.x - initialTargetBox!.width / 2 - 80,
    sourceBox!.y + sourceBox!.height / 2,
    { steps: 16 },
  );
  await expect.poll(() => edgeEndpointDistance(page, edgeId, sourceId, "out-left", "source")).toBeLessThan(5);
  await expect.poll(() => edgeEndpointDistance(page, edgeId, targetId, "in-right", "target")).toBeLessThan(5);
  await page.mouse.up();

  // Moving B below A should choose the source bottom and target top instead of either horizontal
  // side, using the same dominant-axis rule as the production canvas. Start from a fresh board so
  // the first scenario's deliberately off-mainline card cannot be clipped by the viewport.
  await page.goto(server.url);
  await waitForBoot(page);
  await selectWorkflowByName(page, "Generate Video Prompt");
  const verticalSourceBox = await source.boundingBox();
  const verticalTargetBox = await target.boundingBox();
  expect(verticalSourceBox).not.toBeNull();
  expect(verticalTargetBox).not.toBeNull();
  await page.mouse.move(
    verticalTargetBox!.x + verticalTargetBox!.width / 2,
    verticalTargetBox!.y + verticalTargetBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    verticalSourceBox!.x + verticalSourceBox!.width / 2,
    verticalSourceBox!.y + verticalSourceBox!.height + verticalTargetBox!.height / 2 + 80,
    { steps: 16 },
  );
  await expect.poll(() => edgeEndpointDistance(page, edgeId, sourceId, "out-bottom", "source")).toBeLessThan(5);
  await expect.poll(() => edgeEndpointDistance(page, edgeId, targetId, "in-top", "target")).toBeLessThan(5);
  await page.mouse.up();
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
