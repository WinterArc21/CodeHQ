import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import type { WorkflowConnection } from "@schema/workflow";
import type { BadgeTone } from "../../design/semantics";
import { Badge } from "../primitives";
import styles from "./ConnectionRow.module.css";

type ConnectionType = NonNullable<WorkflowConnection["type"]>;

const TYPE_LABELS: Record<ConnectionType, string> = {
  success: "Success",
  failure: "Failure",
  conditional: "Conditional",
  async: "Async",
};

const TYPE_TONES: Record<ConnectionType, BadgeTone> = {
  success: "neutral",
  failure: "red",
  conditional: "amber",
  async: "neutral",
};

export interface ConnectionRowProps {
  direction: "in" | "out";
  connection: WorkflowConnection;
  /** The connected step's display name (never the raw id — contract §11 point 12). */
  stepName: string;
  onSelect: () => void;
}

/** One incoming or outgoing connection. Clicking it selects the connected step so the user can
 * walk the workflow from inside the drawer. */
export function ConnectionRow({ direction, connection, stepName, onSelect }: ConnectionRowProps) {
  const type = connection.type ?? "success";

  return (
    <button type="button" className={styles.row} onClick={onSelect}>
      <span className={styles.direction} aria-hidden="true">
        {direction === "in" ? <ArrowLeft size={14} /> : <ArrowRight size={14} />}
      </span>
      <span className={styles.content}>
        <span className={styles.headerLine}>
          <span className={styles.stepName}>{stepName}</span>
          <Badge tone={TYPE_TONES[type]}>{TYPE_LABELS[type]}</Badge>
        </span>
        {connection.label !== undefined ? <span className={styles.detail}>{connection.label}</span> : null}
        {connection.condition !== undefined ? <span className={styles.detail}>{connection.condition}</span> : null}
      </span>
    </button>
  );
}
