import { CopyButton } from "../primitives";
import { StateLayout } from "./StateLayout";
import styles from "./UninitializedState.module.css";

const INIT_COMMAND = "npx hq init";

/** Shown when `.hq` does not exist yet in the current repository. */
export function UninitializedState() {
  return (
    <StateLayout title="HQ isn't set up in this repository yet">
      <p>
        HQ renders the workflow notes your coding agent writes about this codebase as an
        interactive canvas. It has no LLM of its own and never uploads your code anywhere.
      </p>
      <div className={styles.commandRow}>
        <code className={styles.command}>{INIT_COMMAND}</code>
        <CopyButton value={INIT_COMMAND} label="Copy" />
      </div>
    </StateLayout>
  );
}
