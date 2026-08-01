/**
 * The Fastify application: `createCodeHQServer` boots a store, a watcher, and every
 * `/api/*` route, bound to `127.0.0.1` only — this is a local-only tool and must never
 * listen on `0.0.0.0`.
 */

import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import fastify, { type FastifyInstance } from "fastify";
import { pathExists } from "@core/fs-utils";
import { createCodeHQStore, type CodeHQStore } from "@core/store";
import { registerEventsRoute } from "./events";
import { registerRoutes } from "./routes";

export interface CodeHQServerOptions {
  root: string;
  port?: number;
  host?: string;
  serveWeb?: boolean;
  logger?: boolean;
}

export interface CodeHQServer {
  url: string;
  port: number;
  root: string;
  close(): Promise<void>;
  store: CodeHQStore;
}

const DEFAULT_PORT = 4310;
const DEFAULT_HOST = "127.0.0.1";
const MAX_PORT_ATTEMPTS = 20;

function probePort(port: number, host: string): Promise<"available" | "in-use"> {
  return new Promise((resolve, reject) => {
    const tester = createServer();
    tester.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE") {
        resolve("in-use");
      } else {
        reject(error);
      }
    });
    tester.once("listening", () => {
      tester.close(() => {
        resolve("available");
      });
    });
    tester.listen(port, host);
  });
}

/** Finds the first free port starting at `startPort`, trying up to `maxAttempts` ports. */
export async function findAvailablePort(
  startPort: number,
  host: string = DEFAULT_HOST,
  maxAttempts: number = MAX_PORT_ATTEMPTS,
): Promise<number> {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const candidate = startPort + attempt;
    // Ports must be probed one at a time and in order: the first free one wins.
    const result = await probePort(candidate, host);
    if (result === "available") {
      return candidate;
    }
  }
  throw new Error(`Could not find an available port in [${startPort}, ${startPort + maxAttempts - 1}].`);
}

function resolveWebDistDir(): string {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  // src/server/app.ts -> ../../dist/web, and dist/node/server.js -> ../../dist/web: both
  // sit exactly two directories below the package root.
  return path.resolve(currentDir, "..", "..", "dist", "web");
}

async function registerWebStatic(app: FastifyInstance): Promise<void> {
  const webDir = resolveWebDistDir();
  const hasBuiltWeb = (await pathExists(webDir)) && (await pathExists(path.join(webDir, "index.html")));

  if (!hasBuiltWeb) {
    app.get("/*", (_request, reply) => {
      reply
        .code(200)
        .type("text/plain")
        .send(
          "CodeHQ web UI has not been built yet.\n\n" +
            "Run `pnpm build` (or `pnpm build:web`) to generate dist/web, then restart the server.\n",
        );
    });
    return;
  }

  await app.register(fastifyStatic, { root: webDir });
  app.setNotFoundHandler((request, reply) => {
    if (request.raw.method === "GET" && !request.url.startsWith("/api")) {
      reply.type("text/html").sendFile("index.html");
      return;
    }
    reply.code(404).send({ error: "Not found." });
  });
}

/** Boots the store, the watcher, and the Fastify app. Resolves once the server is listening. */
export async function createCodeHQServer(options: CodeHQServerOptions): Promise<CodeHQServer> {
  const host = options.host ?? DEFAULT_HOST;
  if (host === "0.0.0.0") {
    throw new Error("Refusing to bind 0.0.0.0 — CodeHQ is a local-only tool.");
  }

  const port = await findAvailablePort(options.port ?? DEFAULT_PORT, host);

  const store = createCodeHQStore(options.root);
  await store.reload();
  store.start();

  const app = fastify({ logger: options.logger ?? false, forceCloseConnections: true });

  registerRoutes(app, { root: options.root, store });
  registerEventsRoute(app, store);

  if (options.serveWeb === true) {
    await registerWebStatic(app);
  }

  await app.listen({ port, host });

  // `port` may have been `0` ("pick any free port"); read back what was actually bound.
  const address = app.server.address();
  const actualPort = typeof address === "object" && address !== null ? address.port : port;

  return {
    url: `http://${host}:${actualPort}`,
    port: actualPort,
    root: options.root,
    store,
    close: async () => {
      await app.close();
      await store.stop();
    },
  };
}
