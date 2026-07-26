import { describe, expect, it } from "vitest";
import { extractMetadata, extractImages } from "../../../lib/scraper";

describe("extractMetadata", () => {
  it("extracts the title and description", () => {
    const html = '<html><head><title>Acme</title><meta name="description" content="Great stuff"></head></html>';
    expect(extractMetadata(html)).toEqual({ title: "Acme", description: "Great stuff" });
  });
});

describe("extractImages", () => {
  it("resolves relative image URLs against the base URL", () => {
    const html = '<img src="/hero.png"><img src="https://cdn.example.com/logo.png">';
    expect(extractImages(html, "https://example.com/page")).toEqual([
      "https://example.com/hero.png",
      "https://cdn.example.com/logo.png",
    ]);
  });
});
