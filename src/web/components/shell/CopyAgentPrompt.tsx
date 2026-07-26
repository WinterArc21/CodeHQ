import { CopyButton } from "../primitives";

/** The exact onboarding instruction a developer's coding agent should be given. */
export const AGENT_ONBOARDING_PROMPT = "Read .observatory/SKILL.md and map the main product workflow into Observatory.";

export function CopyAgentPrompt() {
  return <CopyButton value={AGENT_ONBOARDING_PROMPT} label="Copy agent prompt" />;
}
