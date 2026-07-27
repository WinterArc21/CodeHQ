import type { Depth } from "../../store/useObservatoryStore";
import styles from "./DepthControl.module.css";

export interface DepthControlProps {
  depth: Depth;
  onChange: (depth: Depth) => void;
}

const DEPTH_OPTIONS: ReadonlyArray<{ value: Depth; label: string }> = [
  { value: "workflow", label: "Workflow" },
  { value: "modules", label: "Modules" },
  { value: "symbols", label: "Symbols" },
];

/** Three segmented, keyboard-operable (native `<button>`s) depth options (contract §11). */
export function DepthControl({ depth, onChange }: DepthControlProps) {
  return (
    <div className={styles.group} role="group" aria-label="Detail level">
      {DEPTH_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`${styles.option} ${depth === option.value ? styles.active : ""}`}
          aria-pressed={depth === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
