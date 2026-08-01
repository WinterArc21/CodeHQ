/**
 * Spawns the REAL built CLI (`node dist/node/cli.js open`) against a given repository root
 * and port, and waits until `/api/state` answers — the same server a user would get from
 * `hq open`, never an in-process fake.
 *
 * Shutdown note (see `tests/e2e/cli.spec.ts` for the full write-up): Windows has no POSIX
 * signals, so `stop()` can only force-terminate the child process here. That is sufficient
 * for tearing a test server down, but it is NOT the same thing as proving `open`'s graceful
 * `SIGINT`/`SIGTERM` handler ran — `cli.spec.ts` is explicit about which of those two claims
 * it is actually making.
 */
import { spawn, type ChildProcessByStdio } from "node:child_process";
import type { Readable } from "node:stream";
import { expect } from "@playwright/test";
import { CLI_ENTRY, REPO_ROOT } from "./paths";

export interface ManagedServer {
  readonly port: number;
  readonly url: string;
  /** Captured stdout so far, for assertions and for readable failure output. */
  stdout(): string;
  stderr(): string;
  /** Force-terminates the process and waits for it to exit (or a 5s fallback). */
  stop(): Promise<void>;
}

const READY_TIMEOUT_MS = 20_000;
const READY_POLL_INTERVAL_MS = 150;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForReady(
  port: number,
  child: ChildProcessByStdio<null, Readable, Readable>,
  describeFailure: () => string,
): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let lastError: unknown;

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`hq open exited early (code ${child.exitCode}) before it became ready.\n${describeFailure()}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/state`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      lastError = error;
    }
    await wait(READY_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Server on port ${port} did not become ready within ${READY_TIMEOUT_MS}ms. Last connect error: ${String(lastError)}\n${describeFailure()}`,
  );
}

/** Starts `hq open --no-open --port <port> --root <root>` and waits for it to serve `/api/state`. */
export async function startHQServer(root: string, port: number): Promise<ManagedServer> {
  const child = spawn(process.execPath, [CLI_ENTRY, "open", "--no-open", "--port", String(port), "--root", root], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdoutBuffer = "";
  let stderrBuffer = "";
  child.stdout.on("data", (chunk: Buffer) => {
    stdoutBuffer += chunk.toString("utf-8");
  });
  child.stderr.on("data", (chunk: Buffer) => {
    stderrBuffer += chunk.toString("utf-8");
  });

  const describeFailure = (): string => `--- stdout ---\n${stdoutBuffer}\n--- stderr ---\n${stderrBuffer}`;

  await waitForReady(port, child, describeFailure);

  return {
    port,
    url: `http://127.0.0.1:${port}`,
    stdout: () => stdoutBuffer,
    stderr: () => stderrBuffer,
    stop: async () => {
      if (child.exitCode !== null) {
        return;
      }
      const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
      child.kill();
      await Promise.race([exited, wait(5_000)]);
    },
  };
}

/** Polls until `port` stops accepting HTTP connections — proves the OS released it after shutdown. */
export async function waitForPortFree(port: number): Promise<void> {
  await expect(async () => {
    let reachable = true;
    try {
      await fetch(`http://127.0.0.1:${port}/api/state`);
    } catch {
      reachable = false;
    }
    expect(reachable).toBe(false);
  }).toPass({ timeout: 5_000 });
}
