import { describe, expect, it } from "vitest";
import {
  categoryToken,
  confidenceStyle,
  connectionStyle,
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
  it("renders failure as muted red and dashed, without a forced label", () => {
    const result = connectionStyle("failure");
    expect(result.varName).toBe("--accent-red");
    expect(result.dash).toBe("dashed");
    expect(result.showLabel).toBe(false);
  });

  it("renders conditional as amber, dashed, with the label shown", () => {
    const result = connectionStyle("conditional");
    expect(result.varName).toBe("--accent-amber");
    expect(result.dash).toBe("dashed");
    expect(result.showLabel).toBe(true);
  });

  it("renders async as neutral and dotted", () => {
    const result = connectionStyle("async");
    expect(result.varName).toBe("--accent-neutral");
    expect(result.dash).toBe("dotted");
  });

  it("renders success (and the default) as neutral and solid", () => {
    const success = connectionStyle("success");
    const fallback = connectionStyle(undefined);
    expect(success.varName).toBe("--accent-neutral");
    expect(success.dash).toBe("none");
    expect(fallback).toEqual(success);
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
