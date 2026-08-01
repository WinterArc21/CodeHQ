/**
 * `GET /api/events` — Server-Sent Events. Sends the current snapshot immediately on
 * connect and again on every store change, plus a `ping` every 25s to keep proxies alive.
 * Every connection's interval and store subscription is cleaned up on client disconnect,
 * and (via a single app-level `onClose` hook) on server shutdown too.
 */

import type { FastifyInstance } from "fastify";
import type { CodeHQSnapshot } from "@core/types";
import type { CodeHQStore } from "@core/store";

const PING_INTERVAL_MS = 25_000;

type SseFrame = { type: "snapshot"; payload: CodeHQSnapshot } | { type: "ping" };

export function registerEventsRoute(app: FastifyInstance, store: CodeHQStore): void {
  const activeCleanups = new Set<() => void>();

  app.addHook("onClose", (_instance, done) => {
    for (const cleanup of [...activeCleanups]) {
      cleanup();
    }
    done();
  });

  app.get("/api/events", (request, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const send = (frame: SseFrame): void => {
      reply.raw.write(`data: ${JSON.stringify(frame)}\n\n`);
    };

    send({ type: "snapshot", payload: store.getSnapshot() });
    const unsubscribe = store.subscribe((snapshot) => {
      send({ type: "snapshot", payload: snapshot });
    });
    const pingTimer = setInterval(() => {
      send({ type: "ping" });
    }, PING_INTERVAL_MS);

    const cleanup = (): void => {
      clearInterval(pingTimer);
      unsubscribe();
      activeCleanups.delete(cleanup);
    };
    activeCleanups.add(cleanup);

    request.raw.on("close", cleanup);
  });
}
