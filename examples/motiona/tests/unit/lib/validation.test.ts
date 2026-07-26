import { describe, expect, it } from "vitest";
import { validateGenerateRequest, hasRemainingQuota } from "../../../lib/validation";

describe("validateGenerateRequest", () => {
  it("accepts a valid generation request", () => {
    const result = validateGenerateRequest({ url: "https://example.com" });
    expect(result.ok).toBe(true);
  });

  it("rejects a malformed URL", () => {
    const result = validateGenerateRequest({ url: "not-a-url" });
    expect(result.ok).toBe(false);
  });
});

describe("hasRemainingQuota", () => {
  it("returns false once the monthly quota is reached", () => {
    expect(hasRemainingQuota(20)).toBe(false);
    expect(hasRemainingQuota(1)).toBe(true);
  });
});
