import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseProject, parseWorkflow } from "@schema/validate";
import { runInit } from "../../../src/cli/commands/init";

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "observatory-cli-init-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

const PROJECT_FILE = ".observatory/project.json";
const SKILL_FILE = ".observatory/SKILL.md";
const WORKFLOWS_DIR = ".observatory/workflows";
const EXAMPLE_WORKFLOW_FILE = ".observatory/workflows/generate-video.json";
const DIAGNOSTICS_FILE = ".observatory/diagnostics.json";

function abs(relative: string): string {
  return path.join(root, ...relative.split("/"));
}

describe("runInit — fresh repository", () => {
  it("creates the expected tree, including a parseable project.json and example workflow", async () => {
    const result = await runInit({ root });

    expect(result.exitCode).toBe(0);
    expect(existsSync(abs(PROJECT_FILE))).toBe(true);
    expect(existsSync(abs(SKILL_FILE))).toBe(true);
    expect(existsSync(abs(WORKFLOWS_DIR))).toBe(true);
    expect(existsSync(abs(EXAMPLE_WORKFLOW_FILE))).toBe(true);
    expect(existsSync(abs(DIAGNOSTICS_FILE))).toBe(true);

    expect(result.created).toEqual([".observatory/project.json", ".observatory/workflows/", ".observatory/SKILL.md"]);
    expect(result.unchanged).toEqual([]);

    const projectJson = JSON.parse(readFileSync(abs(PROJECT_FILE), "utf-8")) as unknown;
    const projectResult = parseProject(projectJson, PROJECT_FILE);
    expect(projectResult.ok).toBe(true);

    const workflowJson = JSON.parse(readFileSync(abs(EXAMPLE_WORKFLOW_FILE), "utf-8")) as unknown;
    const workflowResult = parseWorkflow(workflowJson, EXAMPLE_WORKFLOW_FILE);
    expect(workflowResult.ok).toBe(true);

    const diagnostics = JSON.parse(readFileSync(abs(DIAGNOSTICS_FILE), "utf-8")) as { valid: boolean; issues: unknown[] };
    expect(diagnostics.valid).toBe(true);
    expect(diagnostics.issues).toEqual([]);
  });

  it("appends .observatory/.runtime/ to .gitignore exactly once, and never duplicates it on rerun", async () => {
    await runInit({ root });
    const firstContent = readFileSync(path.join(root, ".gitignore"), "utf-8");
    expect(firstContent).toContain(".observatory/.runtime/");

    await runInit({ root });
    const secondContent = readFileSync(path.join(root, ".gitignore"), "utf-8");
    const occurrences = secondContent.split(".observatory/.runtime/").length - 1;
    expect(occurrences).toBe(1);
  });

  it("handles an existing .gitignore with no trailing newline", async () => {
    writeFileSync(path.join(root, ".gitignore"), "node_modules");
    await runInit({ root });
    const content = readFileSync(path.join(root, ".gitignore"), "utf-8");
    expect(content).toBe("node_modules\n.observatory/.runtime/\n");
  });

  it("never duplicates an equivalent pre-existing ignore pattern", async () => {
    writeFileSync(path.join(root, ".gitignore"), "/.observatory/.runtime\n");
    await runInit({ root });
    const content = readFileSync(path.join(root, ".gitignore"), "utf-8");
    expect(content).toBe("/.observatory/.runtime\n");
  });
});

describe("runInit — idempotency", () => {
  it("leaves a human-edited SKILL.md byte-identical on rerun, and reports it unchanged", async () => {
    await runInit({ root });
    const editedContent = "# My custom skill notes\n\nDo not touch this.\n";
    writeFileSync(abs(SKILL_FILE), editedContent, "utf-8");

    const secondResult = await runInit({ root });

    expect(readFileSync(abs(SKILL_FILE), "utf-8")).toBe(editedContent);
    expect(secondResult.unchanged).toContain(SKILL_FILE);
    expect(secondResult.created).not.toContain(SKILL_FILE);
  });

  it("also reports an existing example workflow as unchanged on rerun", async () => {
    await runInit({ root });
    const secondResult = await runInit({ root });
    expect(secondResult.unchanged).toContain(EXAMPLE_WORKFLOW_FILE);
  });
});

describe("runInit — --force", () => {
  it("overwrites a previously edited SKILL.md", async () => {
    await runInit({ root });
    writeFileSync(abs(SKILL_FILE), "custom content that should be replaced\n", "utf-8");

    const result = await runInit({ root, force: true });

    expect(readFileSync(abs(SKILL_FILE), "utf-8")).not.toBe("custom content that should be replaced\n");
    expect(result.created).toContain(SKILL_FILE);
    expect(result.unchanged).not.toContain(SKILL_FILE);
  });
});

describe("runInit — --no-example", () => {
  it("omits the example workflow file entirely", async () => {
    const result = await runInit({ root, example: false });
    expect(existsSync(abs(EXAMPLE_WORKFLOW_FILE))).toBe(false);
    expect(existsSync(abs(WORKFLOWS_DIR))).toBe(true);
    expect(result.unchanged).not.toContain(EXAMPLE_WORKFLOW_FILE);
  });
});

describe("runInit — non-project-root warning", () => {
  it("warns when the target has neither .git nor package.json", async () => {
    const result = await runInit({ root });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("does not warn when a .git directory is present", async () => {
    const gitRoot = mkdtempSync(path.join(tmpdir(), "observatory-cli-init-git-"));
    try {
      const fs = await import("node:fs");
      fs.mkdirSync(path.join(gitRoot, ".git"));
      const result = await runInit({ root: gitRoot });
      expect(result.warnings).toEqual([]);
    } finally {
      rmSync(gitRoot, { recursive: true, force: true });
    }
  });
});
