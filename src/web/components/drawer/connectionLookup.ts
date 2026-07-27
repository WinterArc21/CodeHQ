import type { Workflow } from "@schema/workflow";

/** The connected step's display name — the drawer must never show a raw step id (contract §11
 * point 12). Falls back to the id itself only if the graph somehow references an unknown step,
 * which semantic validation (`src/schema/semantics.ts`) should already have caught upstream. */
export function stepNameById(workflow: Workflow, stepId: string): string {
  return workflow.steps.find((step) => step.id === stepId)?.name ?? stepId;
}
