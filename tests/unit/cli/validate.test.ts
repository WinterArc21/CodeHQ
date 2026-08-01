import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { printValidateResult, runValidate } from "../../../src/cli/commands/validate";

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "hq-cli-validate-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeProject(overrides: Record<string, unknown> = {}): void {
  writeFileSync(
    path.join(root, ".hq", "project.json"),
    JSON.stringify({ schemaVersion: "0.1", project: { id: "fixture", name: "Fixture" }, ...overrides }),
  );
}

function scaffold(): void {
  mkdirSync(path.join(root, ".hq", "workflows"), { recursive: true });
  writeFileSync(path.join(root, "real-source.ts"), "export function realFunction() {}\n");
  writeProject();
}

function captureConsole(): { logs: string[]; errors: string[]; restore: () => void } {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (msg?: unknown) => {
    logs.push(String(msg));
  };
  console.error = (msg?: unknown) => {
    errors.push(String(msg));
  };
  return {
    logs,
    errors,
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
    },
  };
}

describe("runValidate — clean repository", () => {
  it("exits 0 and reports every workflow valid", async () => {
    scaffold();
    writeFileSync(
      path.join(root, ".hq", "workflows", "sample.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        id: "sample",
        name: "Sample",
        purpose: "A sample workflow.",
        steps: [{ id: "step-1", name: "Step 1", purpose: "Does the thing.", category: "entry" }],
        connections: [],
      }),
    );

    const result = await runValidate({ root });
    expect(result.exitCode).toBe(0);
    expect(result.kind).toBe("report");
    if (result.kind !== "report") throw new Error("expected a report");
    expect(result.report.valid).toBe(true);

    const capture = captureConsole();
    printValidateResult(result, false);
    capture.restore();
    expect(capture.logs.some((line) => line.includes("All 1 workflow is valid."))).toBe(true);
  });
});

describe("runValidate — broken connection", () => {
  it("exits 1 and names the missing step", async () => {
    scaffold();
    writeFileSync(
      path.join(root, ".hq", "workflows", "checkout.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        id: "checkout",
        name: "Checkout",
        purpose: "Checks out a cart.",
        steps: [{ id: "step-1", name: "Step 1", purpose: "Does the thing.", category: "entry" }],
        connections: [{ from: "step-1", to: "create-order" }],
      }),
    );

    const result = await runValidate({ root });
    expect(result.exitCode).toBe(1);
    if (result.kind !== "report") throw new Error("expected a report");
    expect(result.report.valid).toBe(false);
    expect(result.report.issues.some((issue) => issue.message.includes("create-order"))).toBe(true);

    const capture = captureConsole();
    printValidateResult(result, false);
    capture.restore();
    const output = capture.logs.join("\n");
    expect(output).toContain("create-order");
    expect(output).toContain("1 error, 0 warnings.");
  });
});

describe("runValidate — warnings only", () => {
  it("exits 0 when only warnings are present", async () => {
    scaffold();
    writeFileSync(
      path.join(root, ".hq", "workflows", "sample.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        id: "sample",
        name: "Sample",
        purpose: "A sample workflow.",
        steps: [
          {
            id: "step-1",
            name: "Step 1",
            purpose: "Does the thing.",
            category: "entry",
            sources: [{ file: "does-not-exist.ts" }],
          },
        ],
        connections: [],
      }),
    );

    const result = await runValidate({ root });
    expect(result.exitCode).toBe(0);
    if (result.kind !== "report") throw new Error("expected a report");
    expect(result.report.valid).toBe(true);
    expect(result.report.issues.some((issue) => issue.severity === "warning")).toBe(true);
  });
});

describe("runValidate — --json", () => {
  it("prints only the DiagnosticsReport as JSON", async () => {
    scaffold();
    writeFileSync(
      path.join(root, ".hq", "workflows", "sample.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        id: "sample",
        name: "Sample",
        purpose: "A sample workflow.",
        steps: [{ id: "step-1", name: "Step 1", purpose: "Does the thing.", category: "entry" }],
        connections: [],
      }),
    );

    const result = await runValidate({ root, json: true });
    const capture = captureConsole();
    printValidateResult(result, true);
    capture.restore();

    expect(capture.logs).toHaveLength(1);
    const parsed: unknown = JSON.parse(capture.logs[0] ?? "");
    expect(parsed).toMatchObject({ valid: true });
  });
});

describe("runValidate — missing .hq", () => {
  it("exits 1 with a hint to run init", async () => {
    const result = await runValidate({ root });
    expect(result.exitCode).toBe(1);
    expect(result.kind).toBe("missing-hq");

    const capture = captureConsole();
    printValidateResult(result, false);
    capture.restore();
    expect(capture.errors.join("\n")).toContain("hq init");
  });
});
