import { useCallback, useState } from "react";
import { ApiError } from "../api/client";

export type AsyncActionStatus = "idle" | "pending" | "error";

export interface UseAsyncActionResult {
  run: () => void;
  status: AsyncActionStatus;
  message: string | null;
  reset: () => void;
}

/**
 * Wraps a fire-and-forget async action (a button click that hits the server) with
 * pending/error UI state, so a failure is always surfaced with its real message — never a
 * silent catch (contract §12).
 */
export function useAsyncAction(action: () => Promise<void>): UseAsyncActionResult {
  const [status, setStatus] = useState<AsyncActionStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(() => {
    setStatus("pending");
    setMessage(null);
    action()
      .then(() => setStatus("idle"))
      .catch((caught: unknown) => {
        setStatus("error");
        setMessage(caught instanceof ApiError ? caught.message : "Something went wrong.");
      });
  }, [action]);

  const reset = useCallback(() => {
    setStatus("idle");
    setMessage(null);
  }, []);

  return { run, status, message, reset };
}
