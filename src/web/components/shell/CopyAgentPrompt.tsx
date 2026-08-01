import { CopyButton } from "../primitives";

/** A context-neutral instruction a developer's coding agent can use to map a workflow. */
export const AGENT_PROMPT = "Read .observatory/SKILL.md and map the main product workflow into Observatory.";

export const AGENT_PROMPT_EXAMPLES = [
  "Read .observatory/SKILL.md and map the purchase workflow into Observatory.",
  "Read .observatory/SKILL.md and map the user journey from sign-in to download into Observatory.",
] as const;

export function CopyAgentPrompt() {
  return <CopyButton value={AGENT_PROMPT} label="Copy agent prompt" />;
}
