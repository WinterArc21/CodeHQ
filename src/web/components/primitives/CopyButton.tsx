import { useEffect, useRef, useState } from "react";
import { Button, type ButtonProps } from "./Button";
import { copyToClipboard, type ClipboardOutcome } from "./clipboard";
import styles from "./CopyButton.module.css";

type CopyStatus = "idle" | ClipboardOutcome;

export interface CopyButtonProps {
  /** The exact text to copy. */
  value: string;
  label?: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}

const RESET_DELAY_MS = 1800;

function statusText(status: CopyStatus): string | null {
  switch (status) {
    case "copied":
      return "Copied";
    case "manual-selection":
      return "Selected — press Ctrl+C";
    case "unavailable":
      return "Copy unavailable";
    case "idle":
      return null;
  }
}

export function CopyButton({ value, label = "Copy", variant = "secondary", size = "sm" }: CopyButtonProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timeoutRef = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      if (timeoutRef.current !== undefined) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  const handleClick = (): void => {
    void copyToClipboard(value).then((outcome) => {
      setStatus(outcome);
      timeoutRef.current = window.setTimeout(() => setStatus("idle"), RESET_DELAY_MS);
    });
  };

  const text = statusText(status);
  const toneClass = status === "copied" ? styles.copied : status === "unavailable" ? styles.failed : "";

  return (
    <span>
      <Button variant={variant} size={size} onClick={handleClick}>
        {label}
      </Button>
      <span className={`${styles.status} ${toneClass}`} role="status" aria-live="polite">
        {text}
      </span>
    </span>
  );
}
