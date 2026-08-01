/**
 * `tsx`-runnable dev entry point (`pnpm dev:server`). Starts the API server without the
 * static web build, against `HQ_ROOT` (or `examples/motiona` by default, so the
 * parallel web app has real data to render against).
 */

import path from "node:path";
import { resolveRepositoryRoot } from "@core/repository";
import { createHQServer } from "./app";

const PORT = 4310;

async function main(): Promise<void> {
  const envRoot = process.env.HQ_ROOT;
  const startDir =
    envRoot !== undefined && envRoot.length > 0 ? path.resolve(envRoot) : path.resolve(process.cwd(), "examples/motiona");
  const root = resolveRepositoryRoot(startDir);

  const server = await createHQServer({ root, port: PORT, serveWeb: false, logger: false });

  console.log(`HQ dev server running at ${server.url}`);
  console.log(`Watching repository: ${server.root}`);

  const shutdown = (): void => {
    void server.close().then(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  console.error("Failed to start HQ dev server:", error);
  process.exitCode = 1;
});
