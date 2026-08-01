import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkSourceReference, computeWorkflowSourceChecks } from "@core/source-check";
import { parseWorkflow } from "@schema/validate";

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "codehq-source-check-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function write(relPath: string, contents: string): void {
  const absolute = path.join(root, relPath);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
}

describe("checkSourceReference — missing", () => {
  it("is missing when the file does not exist", () => {
    expect(checkSourceReference(root, { file: "does/not/exist.ts" })).toBe("missing");
  });

  it("is missing when the path escapes the repository", () => {
    expect(checkSourceReference(root, { file: "../outside.ts" })).toBe("missing");
  });
});

describe("checkSourceReference — file-only", () => {
  it("is file-only when no symbol is given, even if the file exists", () => {
    write("lib/thing.ts", "export function thing() {}\n");
    expect(checkSourceReference(root, { file: "lib/thing.ts" })).toBe("file-only");
  });

  it("is file-only for a non JS/TS file regardless of symbol", () => {
    write("README.md", "## thing\n");
    expect(checkSourceReference(root, { file: "README.md", symbol: "thing" })).toBe("file-only");
  });

  it("is file-only when the symbol only appears in a line comment", () => {
    write("lib/thing.ts", "// function realSymbol() {}\nexport const other = 1;\n");
    expect(checkSourceReference(root, { file: "lib/thing.ts", symbol: "realSymbol" })).toBe("file-only");
  });

  it("is file-only when the symbol only appears in a block comment", () => {
    write("lib/thing.ts", "/* function realSymbol() {} */\nexport const other = 1;\n");
    expect(checkSourceReference(root, { file: "lib/thing.ts", symbol: "realSymbol" })).toBe("file-only");
  });

  it("is file-only when the symbol only appears as a substring of another identifier", () => {
    write("lib/thing.ts", "export function realSymbolExtended() { return 1; }\n");
    expect(checkSourceReference(root, { file: "lib/thing.ts", symbol: "realSymbol" })).toBe("file-only");
  });

  it("is file-only when the symbol is not found at all", () => {
    write("lib/thing.ts", "export const somethingElse = 1;\n");
    expect(checkSourceReference(root, { file: "lib/thing.ts", symbol: "missingSymbol" })).toBe("file-only");
  });
});

describe("checkSourceReference — verified", () => {
  it("verifies a function declaration", () => {
    write("lib/thing.ts", "export function doThing() { return 1; }\n");
    expect(checkSourceReference(root, { file: "lib/thing.ts", symbol: "doThing" })).toBe("verified");
  });

  it("verifies an all-caps HTTP verb export (route handler)", () => {
    write("app/route.ts", "export async function POST(request: Request) { return new Response(); }\n");
    expect(checkSourceReference(root, { file: "app/route.ts", symbol: "POST" })).toBe("verified");
  });

  it("verifies a class declaration", () => {
    write("lib/thing.ts", "export class Thing {}\n");
    expect(checkSourceReference(root, { file: "lib/thing.ts", symbol: "Thing" })).toBe("verified");
  });

  it("verifies a const arrow-function assignment", () => {
    write("lib/thing.ts", "export const doThing = (x: number) => x + 1;\n");
    expect(checkSourceReference(root, { file: "lib/thing.ts", symbol: "doThing" })).toBe("verified");
  });

  it("verifies a class method", () => {
    write("lib/thing.ts", "export class Thing {\n  doThing(x: number) {\n    return x;\n  }\n}\n");
    expect(checkSourceReference(root, { file: "lib/thing.ts", symbol: "doThing" })).toBe("verified");
  });

  it("verifies an `export { symbol }` re-export", () => {
    write("lib/thing.ts", "function doThing() { return 1; }\nexport { doThing };\n");
    expect(checkSourceReference(root, { file: "lib/thing.ts", symbol: "doThing" })).toBe("verified");
  });

  it("does not treat a URL's '://' as a comment that would hide a real declaration", () => {
    write("lib/thing.ts", 'const base = "https://example.com"; export function doThing() { return base; }\n');
    expect(checkSourceReference(root, { file: "lib/thing.ts", symbol: "doThing" })).toBe("verified");
  });

  it("re-reads after the file changes (mtime-keyed cache does not go stale)", () => {
    write("lib/thing.ts", "export const somethingElse = 1;\n");
    expect(checkSourceReference(root, { file: "lib/thing.ts", symbol: "doThing" })).toBe("file-only");

    write("lib/thing.ts", "export function doThing() { return 1; }\n");
    expect(checkSourceReference(root, { file: "lib/thing.ts", symbol: "doThing" })).toBe("verified");
  });
});

describe("computeWorkflowSourceChecks", () => {
  it("warns (not errors) on a missing source and keys the record by file#symbol", () => {
    write("lib/real.ts", "export function realThing() {}\n");
    const raw = {
      schemaVersion: "0.1",
      id: "wf",
      name: "Workflow",
      purpose: "Does things.",
      steps: [
        {
          id: "step-1",
          name: "Step 1",
          purpose: "Does the thing.",
          sources: [{ file: "lib/real.ts", symbol: "realThing" }, { file: "lib/missing.ts" }],
        },
      ],
      connections: [],
    };
    const parsed = parseWorkflow(raw, ".codehq/workflows/wf.json");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) {
      throw new Error("expected workflow to parse");
    }

    const { sourceChecks, issues } = computeWorkflowSourceChecks(root, parsed.value, ".codehq/workflows/wf.json");

    expect(sourceChecks["lib/real.ts#realThing"]).toBe("verified");
    expect(sourceChecks["lib/missing.ts"]).toBe("missing");
    expect(issues).toHaveLength(1);
    expect(issues[0]?.severity).toBe("warning");
    expect(issues[0]?.message).toContain("step-1");
    expect(issues[0]?.message).toContain("lib/missing.ts");
  });
});
