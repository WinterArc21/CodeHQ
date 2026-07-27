/**
 * THE CORE PRODUCT PROMISE: edits to a workflow file on disk are reflected on the board over
 * SSE, with no `page.reload()` anywhere in this file.
 *
 * Isolation: owns port 4501 (helpers/paths.ts PORTS.liveUpdate) and a private temp copy of
 * examples/motiona created fresh in `beforeAll` and removed in `afterAll` — never the
 * committed fixture, so other specs' parallel workers never collide with this one.
 */
import { promises as fsp } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createTempFixtureCopy, removeTempDir } from "./helpers/fixture";
import { PORTS } from "./helpers/paths";
import { startObservatoryServer, type ManagedServer } from "./helpers/server";

interface MinimalWorkflowFile {
  steps: Array<{ id: string; name: string; [key: string]: unknown }>;
  connections: Array<{ from: string; to: string; [key: string]: unknown }>;
  [key: string]: unknown;
}

let root: string;
let server: ManagedServer;

test.beforeAll(async () => {
  root = await createTempFixtureCopy("live-update");
  server = await startObservatoryServer(root, PORTS.liveUpdate);
});

test.afterAll(async () => {
  await server.stop();
  await removeTempDir(root);
});

test("renaming a step, then adding a step and connection, both appear live without a page reload", async ({ page }) => {
  await page.goto(server.url);
  await page.locator("[data-step-node]").first().waitFor({ state: "visible", timeout: 15_000 });
  await expect(page.locator("[data-step-node]")).toHaveCount(7);

  const workflowFile = path.join(root, ".observatory", "workflows", "generate-video.json");
  const original = JSON.parse(await fsp.readFile(workflowFile, "utf-8")) as MinimalWorkflowFile;

  // --- Step 1: rename a step ---------------------------------------------------------------
  const renamed = structuredClone(original);
  const receiveRequest = renamed.steps.find((step) => step.id === "receive-request");
  if (receiveRequest === undefined) {
    throw new Error("Fixture changed: expected a 'receive-request' step in generate-video.json.");
  }
  receiveRequest.name = "Receive Incoming Request";
  await fsp.writeFile(workflowFile, `${JSON.stringify(renamed, null, 2)}\n`, "utf-8");

  await expect(page.locator('[data-step-node="receive-request"]')).toContainText("Receive Incoming Request", {
    timeout: 10_000,
  });
  await expect(page.getByText("Receive Request", { exact: true })).toHaveCount(0);

  // --- Step 2: add a new step plus a connection into it -------------------------------------
  const withNewStep = structuredClone(renamed);
  withNewStep.steps.push({
    id: "post-process-video",
    name: "Post-process Video",
    purpose: "Applies final color and audio mastering before delivery.",
    category: "logic",
    confidence: "verified",
  });
  withNewStep.connections.push({ from: "save-result", to: "post-process-video" });
  await fsp.writeFile(workflowFile, `${JSON.stringify(withNewStep, null, 2)}\n`, "utf-8");

  await expect(page.locator("[data-step-node]")).toHaveCount(8, { timeout: 10_000 });
  await expect(page.locator('[data-step-node="post-process-video"]')).toContainText("Post-process Video");
  await expect(page.locator(".react-flow__edge")).toHaveCount(10, { timeout: 10_000 });
});
