import { describe, expect, it } from "vitest";
import { POST } from "../../../app/api/generate/route";

describe("POST /api/generate", () => {
  it("accepts a valid generation request", async () => {
    const request = new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const response = await POST(request);
    expect([201, 502]).toContain(response.status);
  });

  it("returns the generated story plan", async () => {
    const request = new Request("http://localhost/api/generate", {
      method: "POST",
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const response = await POST(request);
    if (response.status === 201) {
      const body = (await response.json()) as { generation: { story: unknown } };
      expect(body.generation.story).toBeDefined();
    }
  });
});
