import { describe, expect, it } from "vitest";
import { computeFitViewport } from "@web/components/canvas/fitViewport";

const BASE = {
  containerWidth: 1000,
  containerHeight: 800,
  minZoom: 0.5,
  maxZoom: 1.5,
  paddingRatio: 0.05,
};

describe("computeFitViewport", () => {
  it("returns null when the container or bounds are empty", () => {
    expect(computeFitViewport({ ...BASE, containerWidth: 0, bounds: { minX: 0, minY: 0, maxX: 100, maxY: 100 } })).toBeNull();
    expect(computeFitViewport({ ...BASE, bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 } })).toBeNull();
  });

  it("centres content both ways when it comfortably fits", () => {
    const result = computeFitViewport({ ...BASE, bounds: { minX: 0, minY: 0, maxX: 200, maxY: 200 } });
    expect(result).not.toBeNull();
    // Square content in a wider-than-tall container: height is the constraining dimension.
    const expectedZoom = (800 - 800 * 0.05 * 2) / 200;
    expect(result!.zoom).toBeCloseTo(Math.min(expectedZoom, BASE.maxZoom), 5);
    // Vertically centred: the content's vertical midpoint lands on the container's midpoint.
    const contentMidY = result!.y + (100 * result!.zoom);
    expect(contentMidY).toBeCloseTo(400, 1);
  });

  it("clamps to minZoom and top-aligns instead of centring when content is too tall to fit", () => {
    const result = computeFitViewport({ ...BASE, bounds: { minX: 0, minY: 0, maxX: 200, maxY: 4000 } });
    expect(result).not.toBeNull();
    expect(result!.zoom).toBe(BASE.minZoom);
    // Top-aligned: the very top of the content sits at the padding offset, not vertically centred
    // (which would push a large negative y and crop an equal amount off the top and bottom).
    const contentTopY = result!.y;
    expect(contentTopY).toBeCloseTo(800 * 0.05, 1);
  });

  it("clamps to maxZoom for a small workflow instead of zooming in arbitrarily far", () => {
    const result = computeFitViewport({ ...BASE, bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 } });
    expect(result).not.toBeNull();
    expect(result!.zoom).toBe(BASE.maxZoom);
  });

  it("accounts for a non-zero bounds origin (nodes not starting at 0,0)", () => {
    const atOrigin = computeFitViewport({ ...BASE, bounds: { minX: 0, minY: 0, maxX: 200, maxY: 200 } });
    const offset = computeFitViewport({ ...BASE, bounds: { minX: 500, minY: 300, maxX: 700, maxY: 500 } });
    expect(atOrigin).not.toBeNull();
    expect(offset).not.toBeNull();
    // Same-sized bounds should produce the same zoom regardless of where they sit in graph space.
    expect(offset!.zoom).toBeCloseTo(atOrigin!.zoom, 5);
  });
});
