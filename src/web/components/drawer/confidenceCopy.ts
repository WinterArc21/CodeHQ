import type { WorkflowStep } from "@schema/workflow";

export interface ConfidenceCopy {
  label: string;
  /** An honest, plain-English explanation of what this confidence level actually means. */
  explanation: string;
}

type Confidence = NonNullable<WorkflowStep["confidence"]>;

const CONFIDENCE_COPY: Record<Confidence, ConfidenceCopy> = {
  verified: {
    label: "Verified",
    explanation: "Directly supported by the code an agent read while mapping this step.",
  },
  inferred: {
    label: "Inferred",
    explanation: "A reasonable interpretation of the code, not confirmed line-by-line.",
  },
  "human-confirmed": {
    label: "Human-confirmed",
    explanation: "A person reviewed this explanation and confirmed it is accurate.",
  },
};

/** Looks up the honest explanation text for a `confidence` value (contract: no bare labels). */
export function confidenceCopy(confidence: Confidence): ConfidenceCopy {
  return CONFIDENCE_COPY[confidence];
}
