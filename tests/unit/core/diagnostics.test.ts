import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Issue } from "@schema/diagnostics";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildDiagnostics, writeDiagnostics } from "@core/diagnostics";

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "observatory-diagnostics-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("buildDiagnostics", () => {
  it("is valid when there are no issues", () => {
    expect(buildDiagnostics([]).valid).toBe(true);
  });

  it("is invalid iff at least one issue is an error", () => {
    const warningOnly: Issue[] = [{ severity: "warning", file: "a.json", message: "w" }];
    expect(buildDiagnostics(warningOnly).valid).toBe(true);

    const withError: Issue[] = [...warningOnly, { severity: "error", file: "b.json", message: "e" }];
    expect(buildDiagnostics(withError).valid).toBe(false);
  });

  it("sorts errors before warnings, then by file, then by path", () => {
    const issues: Issue[] = [
      { severity: "warning", file: "b.json", path: "z", message: "1" },
      { severity: "error", file: "b.json", path: "a", message: "2" },
      { severity: "error", file: "a.json", path: "b", message: "3" },
      { severity: "error", file: "a.json", path: "a", message: "4" },
      { severity: "warning", file: "a.json", message: "5" },
    ];

    const report = buildDiagnostics(issues);

    expect(report.issues.map((i) => i.message)).toEqual(["4", "3", "2", "5", "1"]);
  });

  it("stamps a fresh ISO generatedAt", () => {
    const before = Date.now();
    const report = buildDiagnostics([]);
    const generatedAtMs = new Date(report.generatedAt).getTime();
    expect(generatedAtMs).toBeGreaterThanOrEqual(before);
  });
});

describe("writeDiagnostics", () => {
  it("is a no-op when .observatory does not exist", async () => {
    await writeDiagnostics(root, buildDiagnostics([]));
    expect(existsSync(path.join(root, ".observatory"))).toBe(false);
  });

  it("writes valid, pretty-printed JSON with a trailing newline, atomically", async () => {
    mkdirSync(path.join(root, ".observatory"));
    const report = buildDiagnostics([{ severity: "error", file: "x.json", message: "bad" }]);

    await writeDiagnostics(root, report);

    const filePath = path.join(root, ".observatory", "diagnostics.json");
    const contents = readFileSync(filePath, "utf-8");

    expect(contents.endsWith("\n")).toBe(true);
    expect(contents).toContain("  \"valid\": false");
    expect(JSON.parse(contents)).toEqual(report);

    // No leftover .tmp staging files.
    const leftovers = readdirSync(path.join(root, ".observatory")).filter((name) => name.endsWith(".tmp"));
    expect(leftovers).toEqual([]);
  });

  it("overwrites a previous diagnostics.json cleanly", async () => {
    mkdirSync(path.join(root, ".observatory"));
    await writeDiagnostics(root, buildDiagnostics([{ severity: "error", file: "x.json", message: "first" }]));
    await writeDiagnostics(root, buildDiagnostics([]));

    const filePath = path.join(root, ".observatory", "diagnostics.json");
    const parsed = JSON.parse(readFileSync(filePath, "utf-8")) as { valid: boolean; issues: unknown[] };
    expect(parsed.valid).toBe(true);
    expect(parsed.issues).toEqual([]);
  });
});
