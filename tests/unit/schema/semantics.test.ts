import { describe, expect, it } from "vitest";
import { validateWorkflowSemantics } from "@schema/semantics";
import type { Workflow } from "@schema/workflow";

const FILE = ".observatory/workflows/sample.json";

/**
 * `validateWorkflowSemantics` is a pure function operating on an already shape-valid
 * `Workflow`. These tests build minimal workflow-shaped objects by hand (bypassing Zod
 * entirely) so each of the 8 contract §5 rules is exercised directly and independently,
 * including the ones that `parseWorkflow` normally short-circuits via Zod-level guards.
 */
function baseWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  return {
    schemaVersion: "0.1",
    id: "sample-workflow",
    name: "Sample Workflow",
    purpose: "A minimal workflow used to exercise semantic rules in isolation.",
    steps: [
      { id: "start", name: "Start", purpose: "Entry step.", category: "entry" },
      { id: "finish", name: "Finish", purpose: "Terminal step.", category: "output" },
    ],
    connections: [{ from: "start", to: "finish", type: "success" }],
    ...overrides,
  };
}

describe("validateWorkflowSemantics", () => {
  it("returns no issues for a well-formed workflow", () => {
    expect(validateWorkflowSemantics(baseWorkflow(), FILE)).toEqual([]);
  });

  it("rule 1 — flags duplicate step ids", () => {
    const workflow = baseWorkflow({
      steps: [
        { id: "start", name: "Start", purpose: "Entry step.", category: "entry" },
        { id: "start", name: "Duplicate", purpose: "Same id as the first step." },
      ],
      connections: [],
    });

    const issues = validateWorkflowSemantics(workflow, FILE);
    const duplicate = issues.find((issue) => issue.message.includes("Duplicate step id"));
    expect(duplicate).toBeDefined();
    expect(duplicate?.severity).toBe("error");
    expect(duplicate?.message).toContain("'start'");
  });

  it("rule 2 — flags a connection referencing a missing step", () => {
    const workflow = baseWorkflow({ connections: [{ from: "start", to: "missing-step", type: "success" }] });

    const issues = validateWorkflowSemantics(workflow, FILE);
    expect(issues).toContainEqual(
      expect.objectContaining({
        severity: "error",
        path: "connections[0].to",
        message: "Connection references missing step 'missing-step'.",
      }),
    );
  });

  it("rule 3 — flags an empty steps array", () => {
    const workflow = baseWorkflow({ steps: [], connections: [] });

    const issues = validateWorkflowSemantics(workflow, FILE);
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "error", path: "steps", message: "Workflow has no steps." }),
    );
  });

  it("rule 4 — flags a non-repository-relative SourceReference.file", () => {
    const workflow = baseWorkflow({
      steps: [
        {
          id: "start",
          name: "Start",
          purpose: "Entry step.",
          category: "entry",
          sources: [{ file: "C:\\secrets\\config.ts" }],
        },
        { id: "finish", name: "Finish", purpose: "Terminal step.", category: "output" },
      ],
    });

    const issues = validateWorkflowSemantics(workflow, FILE);
    const pathIssue = issues.find((issue) => issue.path === "steps[0].sources[0].file");
    expect(pathIssue).toBeDefined();
    expect(pathIssue?.severity).toBe("error");
  });

  it("rule 5 — flags line > endLine on a SourceReference", () => {
    const workflow = baseWorkflow({
      steps: [
        {
          id: "start",
          name: "Start",
          purpose: "Entry step.",
          category: "entry",
          sources: [{ file: "src/index.ts", line: 50, endLine: 10 }],
        },
        { id: "finish", name: "Finish", purpose: "Terminal step.", category: "output" },
      ],
    });

    const issues = validateWorkflowSemantics(workflow, FILE);
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "error", path: "steps[0].sources[0].line" }),
    );
  });

  it("rule 4 — flags a non-repository-relative entryPoint.file", () => {
    const workflow = baseWorkflow({ entryPoint: { file: "../outside.ts" } });

    const issues = validateWorkflowSemantics(workflow, FILE);
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "error", path: "entryPoint.file" }),
    );
  });

  it("rule 5 — flags entryPoint.line greater than entryPoint.endLine", () => {
    const workflow = baseWorkflow({ entryPoint: { file: "src/index.ts", line: 50, endLine: 10 } });

    const issues = validateWorkflowSemantics(workflow, FILE);
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "error", path: "entryPoint.line" }),
    );
  });

  it("rule 7 — entryPoint does not affect reachability; it is a source pointer, not a step reference", () => {
    const workflow = baseWorkflow({ entryPoint: { file: "src/index.ts", symbol: "unrelatedSymbol" } });

    const issues = validateWorkflowSemantics(workflow, FILE);
    expect(issues.some((issue) => issue.message.includes("unreachable"))).toBe(false);
  });

  it("rule 6 — flags a workflow id that does not match the required pattern", () => {
    const workflow = baseWorkflow({ id: "Not_Valid!" });

    const issues = validateWorkflowSemantics(workflow, FILE);
    expect(issues).toContainEqual(expect.objectContaining({ severity: "error", path: "id" }));
  });

  it("rule 7 — warns (not errors) on a step unreachable from any entry step", () => {
    const workflow = baseWorkflow({
      steps: [
        { id: "start", name: "Start", purpose: "Entry step.", category: "entry" },
        { id: "finish", name: "Finish", purpose: "Terminal step.", category: "output" },
        { id: "orphan", name: "Orphan", purpose: "Never connected." },
      ],
    });

    const issues = validateWorkflowSemantics(workflow, FILE);
    const warning = issues.find((issue) => issue.message.includes("orphan"));
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("warning");
  });

  it("rule 7 — warns on a workflow with more than 14 steps", () => {
    const manySteps: Workflow["steps"] = Array.from({ length: 15 }, (_, index) => ({
      id: `step-${index}`,
      name: `Step ${index}`,
      purpose: "Padding step.",
      ...(index === 0 ? { category: "entry" as const } : {}),
    }));
    const connections: Workflow["connections"] = manySteps.slice(1).map((step, index) => ({
      from: manySteps[index]!.id,
      to: step.id,
      type: "success" as const,
    }));
    const workflow = baseWorkflow({ steps: manySteps, connections });

    const issues = validateWorkflowSemantics(workflow, FILE);
    expect(issues).toContainEqual(
      expect.objectContaining({ severity: "warning", path: "steps", message: expect.stringContaining("15 steps") }),
    );
  });

  it("rule 8 — warns (not errors) on a duplicate connection", () => {
    const workflow = baseWorkflow({
      connections: [
        { from: "start", to: "finish", type: "success" },
        { from: "start", to: "finish", type: "success" },
      ],
    });

    const issues = validateWorkflowSemantics(workflow, FILE);
    const duplicate = issues.find((issue) => issue.message.includes("Duplicate connection"));
    expect(duplicate).toBeDefined();
    expect(duplicate?.severity).toBe("warning");
  });

  it("rejects visual/layout keys found anywhere in the workflow", () => {
    const workflow = baseWorkflow();
    const polluted = { ...workflow, steps: [{ ...workflow.steps[0], color: "#fff" }, workflow.steps[1]] };

    const issues = validateWorkflowSemantics(polluted as Workflow, FILE);
    expect(issues).toContainEqual(
      expect.objectContaining({
        path: "steps[0].color",
        message: "Visual properties are owned by Code Observatory and must not appear in workflow files.",
      }),
    );
  });
});
