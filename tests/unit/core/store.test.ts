import { mkdirSync, mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createObservatoryStore } from "@core/store";

let root: string;
let workflowsDir: string;

function validWorkflowJson(name: string): string {
  return JSON.stringify({
    schemaVersion: "0.1",
    id: "wf",
    name,
    purpose: "A test workflow.",
    steps: [{ id: "step-1", name: "Step 1", purpose: "Does the thing.", category: "entry" }],
    connections: [],
  });
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), "observatory-store-"));
  mkdirSync(path.join(root, ".observatory"), { recursive: true });
  workflowsDir = path.join(root, ".observatory", "workflows");
  mkdirSync(workflowsDir, { recursive: true });
  writeFileSync(
    path.join(root, ".observatory", "project.json"),
    JSON.stringify({ schemaVersion: "0.1", project: { id: "test", name: "Test Project" } }),
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("ObservatoryStore — last-valid-state preservation", () => {
  it("reports a freshly written valid workflow as valid, with no stale marker", async () => {
    writeFileSync(path.join(workflowsDir, "wf.json"), validWorkflowJson("Original Name"));
    const store = createObservatoryStore(root);

    const snapshot = await store.reload();

    expect(snapshot.status).toBe("ready");
    expect(snapshot.workflows).toHaveLength(1);
    expect(snapshot.workflows[0]?.state).toBe("valid");
    expect(snapshot.workflows[0]?.staleSince).toBeUndefined();
    expect(snapshot.workflows[0]?.workflow.name).toBe("Original Name");
  });

  it("keeps the last valid workflow, marked stale, when the file becomes invalid", async () => {
    writeFileSync(path.join(workflowsDir, "wf.json"), validWorkflowJson("Original Name"));
    const store = createObservatoryStore(root);
    await store.reload();

    writeFileSync(path.join(workflowsDir, "wf.json"), "{ not valid json");
    const snapshot = await store.reload();

    expect(snapshot.workflows).toHaveLength(1);
    const record = snapshot.workflows[0];
    expect(record?.state).toBe("stale");
    expect(record?.workflow.name).toBe("Original Name");
    expect(record?.staleSince).toBeTypeOf("string");
    expect(snapshot.diagnostics.valid).toBe(false);
    expect(snapshot.diagnostics.issues.some((issue) => issue.file.endsWith("wf.json"))).toBe(true);
  });

  it("does not reset staleSince across a second consecutive failing reload", async () => {
    writeFileSync(path.join(workflowsDir, "wf.json"), validWorkflowJson("Original Name"));
    const store = createObservatoryStore(root);
    await store.reload();

    writeFileSync(path.join(workflowsDir, "wf.json"), "{ still not valid");
    const first = await store.reload();
    const firstStaleSince = first.workflows[0]?.staleSince;
    expect(firstStaleSince).toBeTypeOf("string");

    await new Promise((resolve) => setTimeout(resolve, 5));

    writeFileSync(path.join(workflowsDir, "wf.json"), "{ also not valid, differently");
    const second = await store.reload();

    expect(second.workflows[0]?.staleSince).toBe(firstStaleSince);
  });

  it("clears stale and returns to valid once the file is repaired", async () => {
    writeFileSync(path.join(workflowsDir, "wf.json"), validWorkflowJson("Original Name"));
    const store = createObservatoryStore(root);
    await store.reload();

    writeFileSync(path.join(workflowsDir, "wf.json"), "{ not valid json");
    await store.reload();

    writeFileSync(path.join(workflowsDir, "wf.json"), validWorkflowJson("Repaired Name"));
    const snapshot = await store.reload();

    expect(snapshot.workflows).toHaveLength(1);
    expect(snapshot.workflows[0]?.state).toBe("valid");
    expect(snapshot.workflows[0]?.staleSince).toBeUndefined();
    expect(snapshot.workflows[0]?.workflow.name).toBe("Repaired Name");
  });

  it("never includes a workflow file that was never valid, but still reports it in diagnostics", async () => {
    writeFileSync(path.join(workflowsDir, "never-valid.json"), "{ this was never valid json");
    const store = createObservatoryStore(root);

    const snapshot = await store.reload();

    expect(snapshot.workflows).toHaveLength(0);
    expect(snapshot.diagnostics.valid).toBe(false);
    expect(snapshot.diagnostics.issues.some((issue) => issue.file.endsWith("never-valid.json"))).toBe(true);
  });

  it("removes a workflow from the snapshot once its file is deleted", async () => {
    writeFileSync(path.join(workflowsDir, "wf.json"), validWorkflowJson("Original Name"));
    const store = createObservatoryStore(root);
    await store.reload();

    unlinkSync(path.join(workflowsDir, "wf.json"));
    const snapshot = await store.reload();

    expect(snapshot.workflows).toHaveLength(0);
  });

  it("sorts the default workflow first, then alphabetically by name", async () => {
    writeFileSync(
      path.join(root, ".observatory", "project.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        project: { id: "test", name: "Test Project" },
        settings: { defaultWorkflowId: "zeta" },
      }),
    );
    writeFileSync(
      path.join(workflowsDir, "alpha.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        id: "alpha",
        name: "Alpha",
        purpose: "p",
        steps: [{ id: "s", name: "S", purpose: "p", category: "entry" }],
        connections: [],
      }),
    );
    writeFileSync(
      path.join(workflowsDir, "zeta.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        id: "zeta",
        name: "Zeta",
        purpose: "p",
        steps: [{ id: "s", name: "S", purpose: "p", category: "entry" }],
        connections: [],
      }),
    );

    const store = createObservatoryStore(root);
    const snapshot = await store.reload();

    expect(snapshot.workflows.map((w) => w.id)).toEqual(["zeta", "alpha"]);
  });
});

describe("ObservatoryStore — status", () => {
  it("is uninitialized when .observatory does not exist", async () => {
    const bareRoot = mkdtempSync(path.join(tmpdir(), "observatory-store-bare-"));
    try {
      const store = createObservatoryStore(bareRoot);
      const snapshot = await store.reload();
      expect(snapshot.status).toBe("uninitialized");
    } finally {
      rmSync(bareRoot, { recursive: true, force: true });
    }
  });

  it("is empty when .observatory exists but has no workflow files", async () => {
    const store = createObservatoryStore(root);
    const snapshot = await store.reload();
    expect(snapshot.status).toBe("empty");
  });
});
