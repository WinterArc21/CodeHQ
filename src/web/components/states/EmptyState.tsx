import { reveal } from "../../api/client";
import { AGENT_ONBOARDING_PROMPT } from "../shell/CopyAgentPrompt";
import { useAsyncAction } from "../../lib/useAsyncAction";
import { Button, CopyButton } from "../primitives";
import { StateLayout } from "./StateLayout";
import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  onShowExample: () => void;
  onRecheck: () => Promise<void>;
}

/**
 * Initialized but no workflows exist yet. Four real, working actions — no embedded chat box
 * (contract §12: no fake buttons).
 */
export function EmptyState({ onShowExample, onRecheck }: EmptyStateProps) {
  const revealSkill = useAsyncAction(() => reveal("skill"));
  const recheck = useAsyncAction(onRecheck);

  return (
    <StateLayout title="No workflows mapped yet">
      <p>
        Ask your coding agent: &ldquo;Read <code>.observatory/SKILL.md</code> and map the main product
        workflow into Observatory.&rdquo;
      </p>
      <div className={styles.actionRow}>
        <CopyButton value={AGENT_ONBOARDING_PROMPT} label="Copy prompt" />
        <Button variant="secondary" size="sm" onClick={revealSkill.run}>
          Reveal skill file
        </Button>
        <Button variant="secondary" size="sm" onClick={onShowExample}>
          Show example workflow
        </Button>
        <Button variant="secondary" size="sm" onClick={recheck.run}>
          Recheck files
        </Button>
      </div>
      {revealSkill.status === "error" && revealSkill.message !== null ? (
        <p className={styles.actionError} role="alert">
          {revealSkill.message}
        </p>
      ) : null}
      {recheck.status === "error" && recheck.message !== null ? (
        <p className={styles.actionError} role="alert">
          {recheck.message}
        </p>
      ) : null}
    </StateLayout>
  );
}
