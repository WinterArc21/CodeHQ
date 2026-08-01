import type { TestReference } from "@schema/workflow";
import { useExportMode } from "../../export-viewer/ExportModeContext";
import { testStatusTone } from "../../design/semantics";
import { Badge, MonoPath } from "../primitives";
import styles from "./TestItem.module.css";

export interface TestItemProps {
  test: TestReference;
}

/** One row of the Tests list (contract §11 point 8): file, symbol, description, status. */
export function TestItem({ test }: TestItemProps) {
  const exportMode = useExportMode();
  const status = testStatusTone(test.status);
  return (
    <li className={styles.row}>
      <div className={styles.headerLine}>
        {exportMode?.hideFilePaths !== true ? <MonoPath path={test.file} /> : null}
        {test.symbol !== undefined ? <span className={styles.symbol}>{test.symbol}</span> : null}
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      {test.description !== undefined ? <p className={styles.description}>{test.description}</p> : null}
    </li>
  );
}
