import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createObservatoryServer, type ObservatoryServer } from "@server/app";

let root: string;
let server: ObservatoryServer | null = null;

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), "observatory-export-"));
  const workflowsDir = path.join(root, ".observatory", "workflows");
  mkdirSync(workflowsDir, { recursive: true });
  writeFileSync(path.join(root, "real-source.ts"), "export function realFunction() {}\n");
  writeFileSync(
    path.join(root, ".observatory", "project.json"),
    JSON.stringify({
      schemaVersion: "0.1",
      project: { id: "fixture", name: "Fixture Project" },
      settings: { defaultWorkflowId: "sample" },
    }),
  );
  writeFileSync(
    path.join(workflowsDir, "sample.json"),
    JSON.stringify({
      schemaVersion: "0.1",
      id: "sample",
      name: "Sample",
      purpose: "A sample workflow.",
      entryPoint: { file: "real-source.ts", symbol: "realFunction" },
      steps: [
        {
          id: "step-1",
          name: "Step 1",
          purpose: "Does the thing.",
          category: "entry",
          sources: [{ file: "real-source.ts", symbol: "realFunction" }],
        },
      ],
      connections: [],
    }),
  );
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

afterEach(async () => {
  if (server !== null) {
    await server.close();
    server = null;
  }
});

async function startServer(): Promise<ObservatoryServer> {
  server = await createObservatoryServer({ root, port: 0, serveWeb: false });
  return server;
}

describe("GET /api/export/:id", () => {
  it("returns 404 for an unknown workflow id", async () => {
    const running = await startServer();
    const response = await fetch(`${running.url}/api/export/does-not-exist`);
    expect(response.status).toBe(404);
  });

  it("returns a self-contained HTML file with correct headers", async () => {
    const running = await startServer();
    const response = await fetch(`${running.url}/api/export/sample`);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");

    const disposition = response.headers.get("content-disposition");
    expect(disposition).toContain("attachment");
    expect(disposition).toContain(".html");

    const html = await response.text();
    // It's a complete HTML document.
    expect(html).toMatch(/^<!doctype html>/i);
    expect(html).toContain("</html>");

    // No external resources.
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/<link[^>]+href=/i);

    // Contains the workflow data.
    expect(html).toContain("Sample");
    expect(html).toContain("real-source.ts");

    // Machine-local data stripped.
    expect(html).not.toContain(root);
    expect(html).not.toContain(".observatory/workflows/sample.json");
    expect(html).not.toContain("absolutePath");
    expect(html).not.toContain("observatoryDir");

    // Contains the export viewer JS (IIFE) and CSS inlined.
    expect(html).toContain("<style>");
    expect(html).toContain("<script>");
  });
});
