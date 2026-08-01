import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Position, ReactFlowProvider, type EdgeProps } from "@xyflow/react";
import type { WorkflowConnection } from "@schema/workflow";
import { WorkflowEdge } from "@web/components/canvas/edges/WorkflowEdge";
import type { WorkflowEdgeData, WorkflowFlowEdge } from "@web/components/canvas/types";

/**
 * `WorkflowEdge` is exercised directly (mirroring `canvas-node.test.tsx`'s approach for nodes):
 * it only reads `data` and the position props React Flow would normally supply, so a
 * `ReactFlowProvider` ancestor is enough for its `BaseEdge`/`EdgeLabelRenderer` internals to run
 * without a full `<ReactFlow>` tree and the real layout measurement jsdom cannot provide.
 */
function renderEdge(data: WorkflowEdgeData, id = "e1"): HTMLElement {
  const props = {
    id,
    type: "workflow",
    source: "a",
    target: "b",
    sourceX: 0,
    sourceY: 0,
    targetX: 0,
    targetY: 100,
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
    data,
  } as unknown as EdgeProps<WorkflowFlowEdge>;
  const { container } = render(
    <ReactFlowProvider>
      <WorkflowEdge {...props} />
    </ReactFlowProvider>,
  );
  return container;
}

function makeConnection(overrides: Partial<WorkflowConnection> = {}): WorkflowConnection {
  return { from: "a", to: "b", ...overrides };
}

function makeData(overrides: Partial<WorkflowEdgeData> = {}): WorkflowEdgeData {
  return { connection: makeConnection(), dimmed: false, traced: false, ...overrides };
}

/** The semantic stroke is the BaseEdge path (`react-flow__edge-path`); the halo is the plain
 * `<path>` underlay rendered before it (no edge-path/edge-interaction class). BaseEdge may also
 * emit an invisible interaction path — both are filtered out when locating the halo. */
function edgePaths(container: HTMLElement): { semantic: SVGPathElement; halo: SVGPathElement } {
  const group = container.querySelector(`[data-workflow-edge="${"e1"}"]`);
  expect(group).not.toBeNull();
  const paths = Array.from(group!.querySelectorAll("path"));
  const semantic = paths.find((p) => p.classList.contains("react-flow__edge-path"));
  const halo = paths.find(
    (p) => !p.classList.contains("react-flow__edge-path") && !p.classList.contains("react-flow__edge-interaction"),
  );
  expect(semantic, "semantic edge-path not rendered").toBeDefined();
  expect(halo, "halo underlay path not rendered").toBeDefined();
  return { semantic: semantic!, halo: halo! };
}

describe("WorkflowEdge visual grammar", () => {
  describe("stroke width per connection type", () => {
    it("renders the primary (success/default) path at 2.5px", () => {
      const { semantic } = edgePaths(renderEdge(makeData({ connection: makeConnection({ type: "success" }) })));
      expect(semantic.style.strokeWidth).toBe("2.5");
    });

    it("renders an untyped (default) connection at the primary width", () => {
      const { semantic } = edgePaths(renderEdge(makeData({ connection: makeConnection() })));
      expect(semantic.style.strokeWidth).toBe("2.5");
    });

    it("renders failure and conditional at 2px", () => {
      for (const type of ["failure", "conditional"] as const) {
        const { semantic } = edgePaths(renderEdge(makeData({ connection: makeConnection({ type }) })));
        expect(semantic.style.strokeWidth, type).toBe("2");
      }
    });

    it("renders async at 2.25px", () => {
      const { semantic } = edgePaths(renderEdge(makeData({ connection: makeConnection({ type: "async" }) })));
      expect(semantic.style.strokeWidth).toBe("2.25");
    });

    it("renders a retry self-loop at 2px", () => {
      const { semantic } = edgePaths(
        renderEdge(
          makeData({
            connection: makeConnection({ from: "a", to: "a", type: "conditional", label: "retry" }),
            retryLoop: { x: 0, y: 0, width: 200, height: 80 },
          }),
        ),
      );
      expect(semantic.style.strokeWidth).toBe("2");
    });
  });

  describe("dash patterns", () => {
    it("uses 7 5 dashes for failure/conditional/retry", () => {
      for (const type of ["failure", "conditional"] as const) {
        const { semantic } = edgePaths(renderEdge(makeData({ connection: makeConnection({ type }) })));
        expect(semantic.style.strokeDasharray, type).toBe("7 5");
      }
      const { semantic: retry } = edgePaths(
        renderEdge(
          makeData({
            connection: makeConnection({ from: "a", to: "a", type: "conditional", label: "retry" }),
            retryLoop: { x: 0, y: 0, width: 200, height: 80 },
          }),
        ),
      );
      expect(retry.style.strokeDasharray).toBe("7 5");
    });

    it("renders async as rounded beads: 1 5 dashes with round line-caps", () => {
      const { semantic } = edgePaths(renderEdge(makeData({ connection: makeConnection({ type: "async" }) })));
      expect(semantic.style.strokeDasharray).toBe("1 5");
      expect(semantic.style.strokeLinecap).toBe("round");
    });

    it("leaves solid (success) edges undashed with default line-caps", () => {
      const { semantic } = edgePaths(renderEdge(makeData({ connection: makeConnection({ type: "success" }) })));
      expect(semantic.style.strokeDasharray).toBe("");
      expect(semantic.style.strokeLinecap).toBe("");
    });
  });

  describe("resting opacity and path tracing", () => {
    it("renders every edge at full resting opacity", () => {
      for (const type of ["success", "failure", "conditional", "async"] as const) {
        const { semantic } = edgePaths(renderEdge(makeData({ connection: makeConnection({ type }) })));
        expect(semantic.style.opacity, type).toBe("1");
      }
    });

    it("dims an unrelated edge to the dimmed factor while tracing", () => {
      const { semantic, halo } = edgePaths(renderEdge(makeData({ connection: makeConnection({ type: "failure" }), dimmed: true })));
      expect(semantic.style.opacity).toBe("0.3");
      expect(halo.style.opacity).toBe("0.3");
    });

    it("strengthens a traced edge's stroke by 0.6px without dimming it", () => {
      const { semantic, halo } = edgePaths(
        renderEdge(makeData({ connection: makeConnection({ type: "success" }), traced: true })),
      );
      expect(semantic.style.strokeWidth).toBe("3.1");
      expect(semantic.style.opacity).toBe("1");
      // The halo grows with the semantic stroke so the casing stays proportionate.
      expect(halo.style.strokeWidth).toBe("6.1");
    });

    it("does not strengthen an untraced edge", () => {
      const { semantic } = edgePaths(renderEdge(makeData({ connection: makeConnection({ type: "failure" }) })));
      expect(semantic.style.strokeWidth).toBe("2");
    });
  });

  describe("edge casing / halo", () => {
    it("paints a background-coloured underlay 3px wider than the semantic stroke", () => {
      const { semantic, halo } = edgePaths(renderEdge(makeData({ connection: makeConnection({ type: "failure" }) })));
      expect(halo.getAttribute("fill")).toBe("none");
      expect(halo.style.stroke).toBe("var(--bg-canvas)");
      expect(Number(halo.style.strokeWidth)).toBe(Number(semantic.style.strokeWidth) + 3);
    });

    it("never captures pointer events", () => {
      const { halo } = edgePaths(renderEdge(makeData({ connection: makeConnection({ type: "success" }) })));
      expect(halo.style.pointerEvents).toBe("none");
    });

    it("keeps the arrowhead marker on the semantic stroke, not the halo", () => {
      const { semantic, halo } = edgePaths(renderEdge(makeData({ connection: makeConnection({ type: "failure" }) })));
      expect(semantic.getAttribute("marker-end")).toBe("url(#hq-arrow-failure)");
      expect(halo.getAttribute("marker-end")).toBeNull();
    });
  });
});
