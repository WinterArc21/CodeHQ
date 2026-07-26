import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getState } from "./client";
import { buildObservatoryFixtureSnapshot, isObservatoryFixtureEnabled } from "./fixture";
import type { ObservatorySnapshot } from "./types";

export type SnapshotStatus = "loading" | "ready" | "error" | "disconnected";

export interface UseObservatorySnapshotResult {
  snapshot: ObservatorySnapshot | null;
  status: SnapshotStatus;
  error: string | null;
  /** Re-fetches `/api/state` and re-opens the SSE subscription from scratch. */
  refetch: () => void;
}

interface SnapshotFrame {
  type: "snapshot";
  payload: ObservatorySnapshot;
}

interface PingFrame {
  type: "ping";
}

function isFrame(value: unknown): value is SnapshotFrame | PingFrame {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }
  const type = (value as { type: unknown }).type;
  return type === "snapshot" || type === "ping";
}

const INITIAL_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 15_000;

/**
 * Fetches `/api/state` once, then keeps that snapshot fresh over `/api/events` (SSE):
 * `ping` frames are ignored, `snapshot` frames replace the current state, and a dropped
 * connection reconnects with a capped exponential backoff rather than hammering the server.
 */
export function useObservatorySnapshot(): UseObservatorySnapshotResult {
  // Read once per hook instance: a lazy initializer (not an effect) sets the fixture data, so
  // the fixture path never needs to call setState from inside the effect body below.
  const [fixtureMode] = useState(isObservatoryFixtureEnabled);
  const [snapshot, setSnapshot] = useState<ObservatorySnapshot | null>(() =>
    fixtureMode ? buildObservatoryFixtureSnapshot() : null,
  );
  const [status, setStatus] = useState<SnapshotStatus>(() => (fixtureMode ? "ready" : "loading"));
  const [error, setError] = useState<string | null>(null);
  const [refetchToken, setRefetchToken] = useState(0);

  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const reconnectTimeoutRef = useRef<number | undefined>(undefined);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Resetting to "loading" happens here, in the event handler that causes the refetch — not
  // inside the effect — so the effect only ever reacts to state, never assigns it up front.
  const refetch = useCallback(() => {
    if (!fixtureMode) {
      setStatus("loading");
      setError(null);
    }
    setRefetchToken((token) => token + 1);
  }, [fixtureMode]);

  useEffect(() => {
    if (fixtureMode) {
      // Development affordance only: never opens a network connection. State is already
      // correct from the lazy initializers above, so there is nothing to synchronize here.
      return;
    }

    let cancelled = false;
    reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;

    const connectEvents = (): void => {
      const source = new EventSource("/api/events");
      eventSourceRef.current = source;

      source.onopen = () => {
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;
      };

      source.onmessage = (event: MessageEvent) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(event.data as string);
        } catch {
          return; // Malformed frame: ignore it rather than tearing down the subscription.
        }
        if (!isFrame(parsed) || parsed.type === "ping") {
          return;
        }
        setSnapshot(parsed.payload);
        setStatus("ready");
        setError(null);
      };

      source.onerror = () => {
        source.close();
        if (cancelled) {
          return;
        }
        setStatus("disconnected");
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(delay * 2, MAX_RECONNECT_DELAY_MS);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (!cancelled) {
            connectEvents();
          }
        }, delay);
      };
    };

    getState()
      .then((initial) => {
        if (cancelled) {
          return;
        }
        setSnapshot(initial);
        setStatus("ready");
        connectEvents();
      })
      .catch((caught: unknown) => {
        if (cancelled) {
          return;
        }
        setStatus("error");
        setError(caught instanceof ApiError ? caught.message : "Unable to reach the Code Observatory server.");
      });

    return () => {
      cancelled = true;
      if (reconnectTimeoutRef.current !== undefined) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [refetchToken, fixtureMode]);

  return { snapshot, status, error, refetch };
}
