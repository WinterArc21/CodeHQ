/**
 * The ONLY place domain semantics map to visual tokens (contract §10). Every other module
 * that needs a colour, marker style, or dash pattern for a category/confidence/connection
 * type/status imports from here instead of re-deriving the mapping. Plain data only, no JSX.
 */
import type { Workflow } from "@schema/workflow";
import type { WorkflowStep } from "@schema/workflow";
import type { SourceStatus } from "../api/types";

export type BadgeTone = "neutral" | "blue" | "green" | "amber" | "red" | "violet";

export interface CategoryVisual {
  /** A `--accent-*` custom property name, e.g. `"--accent-blue"`. */
  varName: string;
  label: string;
}

export interface ConfidenceVisual {
  marker: "solid" | "dashed" | "solid-dot";
  label: string;
}

export interface ConnectionVisual {
  varName: string;
  dash: "none" | "dashed" | "dotted";
  showLabel: boolean;
}

export interface ToneVisual {
  tone: BadgeTone;
  label: string;
}

const CATEGORY_VISUALS: Record<NonNullable<WorkflowStep["category"]>, CategoryVisual> = {
  entry: { varName: "--accent-blue", label: "Entry" },
  logic: { varName: "--accent-neutral", label: "Logic" },
  decision: { varName: "--accent-amber", label: "Decision" },
  data: { varName: "--accent-green", label: "Data" },
  external: { varName: "--accent-violet", label: "External" },
  output: { varName: "--accent-output", label: "Output" },
};

const UNSPECIFIED_CATEGORY_VISUAL: CategoryVisual = { varName: "--accent-neutral", label: "Unspecified" };

/** Left-marker colour + label for a step's `category` (contract §10 table). */
export function categoryToken(category?: WorkflowStep["category"]): CategoryVisual {
  if (category === undefined) {
    return UNSPECIFIED_CATEGORY_VISUAL;
  }
  return CATEGORY_VISUALS[category];
}

const CONFIDENCE_VISUALS: Record<NonNullable<WorkflowStep["confidence"]>, ConfidenceVisual> = {
  verified: { marker: "solid", label: "Verified" },
  inferred: { marker: "dashed", label: "Inferred" },
  "human-confirmed": { marker: "solid-dot", label: "Human-confirmed" },
};

const UNSPECIFIED_CONFIDENCE_VISUAL: ConfidenceVisual = { marker: "solid", label: "Unspecified" };

/** Marker style + label for a step's `confidence` (contract §10 table). */
export function confidenceStyle(confidence?: WorkflowStep["confidence"]): ConfidenceVisual {
  if (confidence === undefined) {
    return UNSPECIFIED_CONFIDENCE_VISUAL;
  }
  return CONFIDENCE_VISUALS[confidence];
}

type ConnectionType = NonNullable<Parameters<typeof connectionStyle>[0]>;

const CONNECTION_VISUALS: Record<ConnectionType, ConnectionVisual> = {
  success: { varName: "--accent-neutral", dash: "none", showLabel: false },
  failure: { varName: "--accent-red", dash: "dashed", showLabel: false },
  conditional: { varName: "--accent-amber", dash: "dashed", showLabel: true },
  async: { varName: "--accent-neutral", dash: "dotted", showLabel: false },
};

/** Line colour/dash + whether to render the connection label (contract §10 table). */
export function connectionStyle(type?: "success" | "failure" | "conditional" | "async"): ConnectionVisual {
  if (type === undefined) {
    return CONNECTION_VISUALS.success;
  }
  return CONNECTION_VISUALS[type];
}

const STATUS_VISUALS: Record<NonNullable<Workflow["status"]>, ToneVisual> = {
  draft: { tone: "neutral", label: "Draft" },
  verified: { tone: "green", label: "Verified" },
  "needs-review": { tone: "amber", label: "Needs review" },
};

const UNSPECIFIED_STATUS_VISUAL: ToneVisual = { tone: "neutral", label: "Unspecified" };

/** Badge tone + label for a workflow's `status`. */
export function statusTone(status?: Workflow["status"]): ToneVisual {
  if (status === undefined) {
    return UNSPECIFIED_STATUS_VISUAL;
  }
  return STATUS_VISUALS[status];
}

const SOURCE_STATUS_VISUALS: Record<SourceStatus, ToneVisual> = {
  verified: { tone: "green", label: "Verified" },
  "file-only": { tone: "amber", label: "File only" },
  missing: { tone: "red", label: "Missing" },
};

/** Badge tone + label for a `sourceChecks` entry's resolution state. */
export function sourceStatusTone(status: SourceStatus): ToneVisual {
  return SOURCE_STATUS_VISUALS[status];
}
