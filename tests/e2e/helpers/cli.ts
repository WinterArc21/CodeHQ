/**
 * Runs a single, short-lived CLI invocation (`init` / `validate`) to completion and captures
 * its exit code and output — the counterpart to `helpers/server.ts`, which manages the
 * long-running `open` process instead.
 */
import { spawn } from "node:child_process";
import { CLI_ENTRY, REPO_ROOT } from "./paths";

export interface CliResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}

export interface RunCliOptions {
  /** Working directory the CLI resolves its repository root from when no `--root` is passed. */
  cwd?: string;
}

export function runCli(args: string[], options: RunCliOptions = {}): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [CLI_ENTRY, ...args], {
      cwd: options.cwd ?? REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf-8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf-8");
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve({ exitCode: code, stdout, stderr }));
  });
}
