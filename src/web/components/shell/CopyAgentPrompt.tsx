import { CopyButton } from "../primitives";

/** A context-neutral instruction a developer's coding agent can use to map a workflow. */
export const AGENT_PROMPT = "Read .hq/SKILL.md and map the main product workflow as a workflow.";

export const AGENT_PROMPT_EXAMPLES = [
  "Read .hq/SKILL.md and map the purchase workflow as a workflow.",
  "Read .hq/SKILL.md and map the user journey from sign-in to download as a workflow.",
] as const;

export function CopyAgentPrompt() {
  return <CopyButton value={AGENT_PROMPT} label="Copy agent prompt" />;
}
