import type { EdgeCase } from "@schema/workflow";
import type { SourceStatus } from "../../api/types";
import { Badge } from "../primitives";
import { confidenceCopy } from "./confidenceCopy";
import { SourceReferenceRow } from "./SourceReferenceRow";
import styles from "./EdgeCaseItem.module.css";

export interface EdgeCaseItemProps {
  edgeCase: EdgeCase;
  sourceChecks: Record<string, SourceStatus>;
}

/** One row of the Edge cases list (contract §11 point 7): name, description, handling,
 * confidence, and its own sources. */
export function EdgeCaseItem({ edgeCase, sourceChecks }: EdgeCaseItemProps) {
  const confidence = edgeCase.confidence !== undefined ? confidenceCopy(edgeCase.confidence) : null;

  return (
    <li className={styles.item}>
      <div className={styles.headerLine}>
        <span className={styles.name}>{edgeCase.name}</span>
        {confidence !== null ? <Badge>{confidence.label}</Badge> : null}
      </div>
      {edgeCase.description !== undefined ? <p className={styles.text}>{edgeCase.description}</p> : null}
      {edgeCase.handling !== undefined ? (
        <p className={styles.handling}>
          <span className={styles.handlingLabel}>Handling: </span>
          {edgeCase.handling}
        </p>
      ) : null}
      {confidence !== null ? <p className={styles.explanation}>{confidence.explanation}</p> : null}
      {edgeCase.sources !== undefined && edgeCase.sources.length > 0 ? (
        <ul className={styles.sources}>
          {edgeCase.sources.map((source, index) => (
            <SourceReferenceRow key={`${source.file}-${index}`} source={source} sourceChecks={sourceChecks} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
