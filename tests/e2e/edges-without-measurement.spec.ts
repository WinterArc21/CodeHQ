/**
 * Regression guard for the "board renders every card but not one connector" failure.
 *
 * React Flow will not draw an edge until `isNodeInitialized` passes for both endpoints, which
 * needs `internals.handleBounds`. Those bounds have two possible sources: the `handles` array on
 * the node object (parsed synchronously inside `adoptUserNodes`), or a ResizeObserver delivery
 * that measures the rendered `.react-flow__handle` elements. When the canvas supplied only
 * explicit width/height and no `handles`, the DOM path was the *only* source — and
 * `adoptUserNodes` discards `handleBounds` every time a node object's identity changes (which
 * happens on every server snapshot, since a new `workflow` rebuilds every node). Any lost
 * measurement therefore wedged the board at zero edges with no recovery path: ResizeObserver
 * does not re-fire for an unchanged size, and the app never re-syncs nodes.
 *
 * That made the bug load-dependent — it reproduced under CPU contention and vanished on an idle
 * machine, so a green CI run proved nothing. Stubbing ResizeObserver out entirely turns the
 * worst case (measurement never arrives) into a deterministic assertion: with the `handles`
 * array in place, edges must render from the very first commit, with no measurement at all.
 *
 * Runs against the shared, read-only server (see playwright.config.ts's `webServer`).
 */
import { expect, test } from "@playwright/test";

test("renders every connector even when node measurement never arrives", async ({ page }) => {
  // Must run before any page script so React Flow's own observers pick up the stub.
  await page.addInitScript(() => {
    class NeverDeliveringResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    window.ResizeObserver = NeverDeliveringResizeObserver as unknown as typeof ResizeObserver;
  });

  await page.goto("/");
  await page.locator("[data-step-node]").first().waitFor({ state: "attached", timeout: 15_000 });

  // The cards were never the problem — they carry explicit width/height, so they render with or
  // without measurement. Asserted here so a future failure is unambiguous about which half broke.
  await expect(page.locator("[data-step-node]")).toHaveCount(11);

  // The actual guard. React Flow renders edges as SVG <g> elements, which Playwright treats as
  // hidden, so this counts attached elements rather than waiting on visibility.
  await expect(page.locator(".react-flow__edge")).toHaveCount(10);

  // Present in the DOM is not enough — every connector must also have real geometry, which is
  // what proves the handle bounds fed into the path were the true ones and not a degenerate
  // zero-length fallback.
  const edgePathLengths = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".react-flow__edge path.react-flow__edge-path")).map((el) =>
      (el as SVGPathElement).getTotalLength(),
    ),
  );
  expect(edgePathLengths).toHaveLength(10);
  for (const length of edgePathLengths) {
    expect(length).toBeGreaterThan(0);
  }
});
