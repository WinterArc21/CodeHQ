import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createCodeHQServer, type CodeHQServer } from "@server/app";

let root: string;
let server: CodeHQServer | null = null;

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

beforeEach(async () => {
  root = mkdtempSync(path.join(tmpdir(), "codehq-sse-"));
  mkdirSync(path.join(root, ".codehq", "workflows"), { recursive: true });
  writeFileSync(
    path.join(root, ".codehq", "project.json"),
    JSON.stringify({ schemaVersion: "0.1", project: { id: "test", name: "Test" } }),
  );
  writeFileSync(path.join(root, ".codehq", "workflows", "wf.json"), validWorkflowJson("Original Name"));
  server = await createCodeHQServer({ root, port: 0, serveWeb: false });
});

afterEach(async () => {
  if (server !== null) {
    await server.close();
    server = null;
  }
  rmSync(root, { recursive: true, force: true });
});

interface SseFrame {
  type: string;
  payload?: { workflows?: Array<{ workflow: { name: string } }> };
}

class SseFrameReader {
  private buffer = "";
  private readonly decoder = new TextDecoder();

  constructor(private readonly reader: ReadableStreamDefaultReader<Uint8Array>) {}

  async next(timeoutMs = 5000): Promise<SseFrame> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const boundary = this.buffer.indexOf("\n\n");
      if (boundary !== -1) {
        const rawFrame = this.buffer.slice(0, boundary);
        this.buffer = this.buffer.slice(boundary + 2);
        const dataLine = rawFrame.split("\n").find((line) => line.startsWith("data: "));
        if (dataLine !== undefined) {
          return JSON.parse(dataLine.slice("data: ".length)) as SseFrame;
        }
        continue;
      }
      if (Date.now() > deadline) {
        throw new Error("Timed out waiting for an SSE frame.");
      }
      const { value, done } = await this.reader.read();
      if (done) {
        throw new Error("SSE stream ended unexpectedly.");
      }
      this.buffer += this.decoder.decode(value, { stream: true });
    }
  }

  async nextSnapshot(timeoutMs = 5000): Promise<SseFrame> {
    for (;;) {
      const frame = await this.next(timeoutMs);
      if (frame.type === "snapshot") {
        return frame;
      }
    }
  }
}

describe("GET /api/events", () => {
  it("sends the current snapshot immediately, then a fresh one on a file change", async () => {
    if (server === null) {
      throw new Error("server not started");
    }
    const controller = new AbortController();
    const response = await fetch(`${server.url}/api/events`, { signal: controller.signal });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");

    const body = response.body;
    if (body === null) {
      throw new Error("expected a streamed response body");
    }
    const frames = new SseFrameReader(body.getReader());

    const initial = await frames.nextSnapshot();
    expect(initial.payload?.workflows?.[0]?.workflow.name).toBe("Original Name");

    // chokidar needs a brief moment after the server boots to attach its OS-level watch
    // handles; writing before that would race a well-known filesystem-watcher testing
    // gotcha. The frame read below still uses bounded polling for the real outcome.
    await new Promise((resolve) => setTimeout(resolve, 400));
    writeFileSync(path.join(root, ".codehq", "workflows", "wf.json"), validWorkflowJson("Updated Name"));

    const updated = await frames.nextSnapshot(8000);
    expect(updated.payload?.workflows?.[0]?.workflow.name).toBe("Updated Name");

    controller.abort();
  }, 15000);

  it("cleans up on disconnect: the server still closes promptly afterwards", async () => {
    if (server === null) {
      throw new Error("server not started");
    }
    const controller = new AbortController();
    const response = await fetch(`${server.url}/api/events`, { signal: controller.signal });
    const body = response.body;
    if (body === null) {
      throw new Error("expected a streamed response body");
    }
    const frames = new SseFrameReader(body.getReader());
    await frames.nextSnapshot();

    controller.abort();

    // A leaked ping interval or subscription would keep the connection (and the process)
    // alive; close() resolving promptly is the outward sign cleanup actually happened.
    const closeStarted = Date.now();
    await server.close();
    expect(Date.now() - closeStarted).toBeLessThan(5000);
    server = null;
  }, 15000);
});
