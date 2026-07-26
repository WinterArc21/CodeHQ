import { CopyButton } from "../primitives";
import { StateLayout } from "./StateLayout";
import styles from "./UninitializedState.module.css";

const INIT_COMMAND = "npx code-observatory init";

/** Shown when `.observatory` does not exist yet in the current repository. */
export function UninitializedState() {
  return (
    <StateLayout title="Code Observatory isn't set up in this repository yet">
      <p>
        Code Observatory renders the workflow notes your coding agent writes about this codebase as an
        interactive canvas. It has no LLM of its own and never uploads your code anywhere.
      </p>
      <div className={styles.commandRow}>
        <code className={styles.command}>{INIT_COMMAND}</code>
        <CopyButton value={INIT_COMMAND} label="Copy" />
      </div>
    </StateLayout>
  );
}
