/**
 * Two independent repository states, each with its own server/port/temp-dir (PORTS.uninitialized
 * / PORTS.empty) so the two `describe` blocks below are safe to run concurrently with the rest
 * of the suite under `fullyParallel`.
 */
import { promises as fsp } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createEmptyTempDir, createTempFixtureCopy, removeTempDir } from "./helpers/fixture";
import { PORTS } from "./helpers/paths";
import { startCodeHQServer, type ManagedServer } from "./helpers/server";

test.describe("no .codehq directory at all", () => {
  let root: string;
  let server: ManagedServer;

  test.beforeAll(async () => {
    root = await createEmptyTempDir("uninitialized");
    server = await startCodeHQServer(root, PORTS.uninitialized);
  });

  test.afterAll(async () => {
    await server.stop();
    await removeTempDir(root);
  });

  test("renders the uninitialized state with the init command", async ({ page }) => {
    await page.goto(server.url);
    await expect(page.getByText("CodeHQ isn't set up in this repository yet")).toBeVisible();
    await expect(page.locator("code").filter({ hasText: "npx codehq init" })).toBeVisible();
  });
});

test.describe("initialized but no workflow files", () => {
  let root: string;
  let server: ManagedServer;

  test.beforeAll(async () => {
    root = await createTempFixtureCopy("empty");
    await fsp.rm(path.join(root, ".codehq", "workflows", "generate-video.json"), { force: true });
    await fsp.rm(path.join(root, ".codehq", "workflows", "upload-assets.json"), { force: true });
    server = await startCodeHQServer(root, PORTS.empty);
  });

  test.afterAll(async () => {
    await server.stop();
    await removeTempDir(root);
  });

  test("renders the guided empty state with its copy-prompt action", async ({ page }) => {
    await page.goto(server.url);
    await expect(page.getByText("No workflows mapped yet")).toBeVisible();
    await expect(page.getByRole("button", { name: "Copy prompt" })).toBeVisible();
  });
});
