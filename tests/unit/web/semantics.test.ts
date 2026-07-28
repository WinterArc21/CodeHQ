import { describe, expect, it } from "vitest";
import {
  categoryToken,
  confidenceStyle,
  connectionStyle,
  outcomeTone,
  RETRY_EDGE_VISUAL,
  sourceStatusTone,
  statusTone,
} from "@web/design/semantics";
import type { SourceStatus } from "@web/api/types";
import type { Workflow, WorkflowStep } from "@schema/workflow";

describe("categoryToken", () => {
  const cases: Array<[WorkflowStep["category"], string]> = [
    ["entry", "--accent-blue"],
    ["logic", "--accent-neutral"],
    ["decision", "--accent-amber"],
    ["data", "--accent-green"],
    ["external", "--accent-violet"],
    ["output", "--accent-output"],
  ];

  it.each(cases)("maps category %s to %s", (category, varName) => {
    expect(categoryToken(category).varName).toBe(varName);
  });

  it("falls back to a neutral marker when category is unspecified", () => {
    const result = categoryToken(undefined);
    expect(result.varName).toBe("--accent-neutral");
    expect(result.label).toBeTruthy();
  });
});

describe("confidenceStyle", () => {
  it("marks verified as a solid marker", () => {
    expect(confidenceStyle("verified").marker).toBe("solid");
  });

  it("marks inferred as a dashed marker", () => {
    expect(confidenceStyle("inferred").marker).toBe("dashed");
  });

  it("marks human-confirmed as a solid marker with a dot", () => {
    expect(confidenceStyle("human-confirmed").marker).toBe("solid-dot");
  });

  it("defaults to solid when confidence is unspecified", () => {
    expect(confidenceStyle(undefined).marker).toBe("solid");
  });
});

describe("connectionStyle", () => {
  it("renders failure as muted red and dashed, with its short label shown", () => {
    const result = connectionStyle("failure");
    expect(result.varName).toBe("--accent-red");
    expect(result.dash).toBe("dashed");
    expect(result.showLabel).toBe(true);
  });

  it("renders conditional as amber, dashed, with the label shown", () => {
    const result = connectionStyle("conditional");
    expect(result.varName).toBe("--accent-amber");
    expect(result.dash).toBe("dashed");
    expect(result.showLabel).toBe(true);
  });

  it("renders async as blue and dotted, with its short label shown", () => {
    const result = connectionStyle("async");
    expect(result.varName).toBe("--accent-blue");
    expect(result.dash).toBe("dotted");
    expect(result.showLabel).toBe(true);
  });

  it("renders success (and the default) as neutral and solid, without a label", () => {
    const success = connectionStyle("success");
    const fallback = connectionStyle(undefined);
    expect(success.varName).toBe("--accent-neutral");
    expect(success.dash).toBe("none");
    expect(success.showLabel).toBe(false);
    expect(fallback).toEqual(success);
  });

  it("every branch connection type distinguishes itself by stroke pattern, not colour alone", () => {
    expect(connectionStyle("failure").dash).not.toBe("none");
    expect(connectionStyle("conditional").dash).not.toBe("none");
    expect(connectionStyle("async").dash).not.toBe("none");
    // Failure and conditional would be indistinguishable to someone who can't perceive their
    // colour difference if they shared a dash pattern too — they don't.
    expect(connectionStyle("failure").dash).toBe(connectionStyle("conditional").dash);
    expect(connectionStyle("failure").varName).not.toBe(connectionStyle("conditional").varName);
  });
});

describe("RETRY_EDGE_VISUAL", () => {
  it("is amber and dashed, distinct from a plain failure edge's colour", () => {
    expect(RETRY_EDGE_VISUAL.varName).toBe("--accent-amber");
    expect(RETRY_EDGE_VISUAL.dash).toBe("dashed");
    expect(RETRY_EDGE_VISUAL.varName).not.toBe(connectionStyle("failure").varName);
  });
});

describe("outcomeTone", () => {
  it("reads as failure when every incoming connection is failure/conditional", () => {
    expect(outcomeTone(["failure"])).toBe("failure");
    expect(outcomeTone(["conditional", "failure"])).toBe("failure");
  });

  it("reads as success when every incoming connection is success/default/async", () => {
    expect(outcomeTone(["success"])).toBe("success");
    expect(outcomeTone([undefined])).toBe("success");
    expect(outcomeTone(["async", "success"])).toBe("success");
  });

  it("falls back to neutral for a genuinely mixed set of incoming types", () => {
    expect(outcomeTone(["success", "failure"])).toBe("neutral");
  });

  it("falls back to neutral when nothing points at the step at all", () => {
    expect(outcomeTone([])).toBe("neutral");
  });
});

describe("statusTone", () => {
  const cases: Array<[Workflow["status"], string]> = [
    ["draft", "neutral"],
    ["verified", "green"],
    ["needs-review", "amber"],
  ];

  it.each(cases)("maps workflow status %s to tone %s", (status, tone) => {
    expect(statusTone(status).tone).toBe(tone);
  });

  it("falls back to neutral when status is unspecified", () => {
    expect(statusTone(undefined).tone).toBe("neutral");
  });
});

describe("sourceStatusTone", () => {
  const cases: Array<[SourceStatus, string]> = [
    ["verified", "green"],
    ["file-only", "amber"],
    ["missing", "red"],
  ];

  it.each(cases)("maps source status %s to tone %s", (status, tone) => {
    expect(sourceStatusTone(status).tone).toBe(tone);
  });
});
