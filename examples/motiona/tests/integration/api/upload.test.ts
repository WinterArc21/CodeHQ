import { describe, expect, it } from "vitest";
import { POST } from "../../../app/api/upload/route";

describe("POST /api/upload", () => {
  it("rejects a request with no file field", async () => {
    const formData = new FormData();
    const request = new Request("http://localhost/api/upload", { method: "POST", body: formData });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
