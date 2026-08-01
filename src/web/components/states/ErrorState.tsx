import { WarningCircle } from "@phosphor-icons/react";
import { Button } from "../primitives";
import { StateLayout } from "./StateLayout";

export interface ErrorStateProps {
  /** The real error message — never a generic placeholder. */
  message: string;
  onRetry: () => void;
}

/** Server unreachable / API error, with a retry action and the real underlying message. */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <StateLayout
      title="Couldn't reach CodeHQ"
      icon={<WarningCircle size={20} />}
      actions={<Button onClick={onRetry}>Retry</Button>}
    >
      <p>{message}</p>
    </StateLayout>
  );
}
