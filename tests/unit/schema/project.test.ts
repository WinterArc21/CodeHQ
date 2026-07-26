import { describe, expect, it } from "vitest";
import { parseProject } from "@schema/validate";

const FILE = ".observatory/project.json";

describe("parseProject", () => {
  it("parses a valid project", () => {
    const result = parseProject(
      {
        schemaVersion: "0.1",
        project: { id: "motiona", name: "Motiona" },
        settings: { sourceLinkMode: "editor" },
      },
      FILE,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected ok result");
    }
    expect(result.value.project.id).toBe("motiona");
    expect(result.value.settings?.sourceLinkMode).toBe("editor");
  });

  it("rejects a project missing schemaVersion", () => {
    const result = parseProject({ project: { id: "motiona", name: "Motiona" } }, FILE);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.issues.length).toBeGreaterThan(0);
    expect(result.issues.every((issue) => issue.severity === "error")).toBe(true);
    expect(result.issues.some((issue) => issue.path === "schemaVersion")).toBe(true);
    expect(result.issues.every((issue) => issue.file === FILE)).toBe(true);
  });

  it("rejects a project with the wrong schemaVersion", () => {
    const result = parseProject({ schemaVersion: "1.0", project: { id: "motiona", name: "Motiona" } }, FILE);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.issues.some((issue) => issue.path === "schemaVersion")).toBe(true);
  });

  it("rejects an unknown top-level key", () => {
    const result = parseProject(
      { schemaVersion: "0.1", project: { id: "motiona", name: "Motiona" }, defaultTheme: "dark" },
      FILE,
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failure");
    }
    expect(result.issues.some((issue) => issue.path === "defaultTheme")).toBe(true);
  });
});
