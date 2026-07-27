/**
 * Constants shared between `playwright.config.ts`, the fixture-server bootstrap
 * (`start-server.ts`), and the spec files themselves — one source of truth for where the e2e
 * suite's scratch fixture lives and which port it listens on, so nothing can drift out of sync.
 */
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** `tests/e2e/helpers` -> repository root. */
export const REPO_ROOT = path.resolve(HERE, "..", "..", "..");

/** The committed, read-only fixture repo. Never written to by tests. */
export const SOURCE_FIXTURE_DIR = path.join(REPO_ROOT, "examples", "motiona");

/** A stable (non-random) scratch copy so `reuseExistingServer` keeps pointing at the same
 * directory a repeated local run expects. */
export const FIXTURE_WORK_DIR = path.join(os.tmpdir(), "code-observatory-e2e-fixture");

export const FIXTURE_PORT = 4399;

export const BASE_URL = `http://localhost:${FIXTURE_PORT}`;

export function workflowFilePath(workflowId: string): string {
  return path.join(FIXTURE_WORK_DIR, ".observatory", "workflows", `${workflowId}.json`);
}

export function sourceWorkflowFilePath(workflowId: string): string {
  return path.join(SOURCE_FIXTURE_DIR, ".observatory", "workflows", `${workflowId}.json`);
}
