/**
 * The contract §8 HTTP API, minus `/api/events` (see `events.ts`).
 */

import path from "node:path";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { pathExists } from "@core/fs-utils";
import { observatoryPaths } from "@core/repository";
import { resolveInsideRepository } from "@core/safe-path";
import type { ObservatoryStore } from "@core/store";
import { defaultRevealImpl, type RevealImpl } from "./reveal";

export interface RouteContext {
  root: string;
  store: ObservatoryStore;
  revealImpl?: RevealImpl;
}

const sourceQuerySchema = z
  .object({
    file: z.string().min(1, { message: "Query parameter 'file' is required." }),
    line: z
      .string()
      .regex(/^\d+$/, { message: "Query parameter 'line' must be a positive integer." })
      .optional(),
  })
  .strict();

const revealBodySchema = z
  .object({
    target: z.enum(["observatory", "skill"], { message: "target must be 'observatory' or 'skill'." }),
  })
  .strict();

function buildEditorUrl(absolutePath: string, line: number | undefined): string {
  const forwardSlashPath = absolutePath.split(path.sep).join("/");
  const encodedPath = encodeURI(forwardSlashPath);
  return line !== undefined ? `vscode://file/${encodedPath}:${line}` : `vscode://file/${encodedPath}`;
}

function registerSourceRoute(app: FastifyInstance, root: string): void {
  app.get("/api/source", async (request, reply) => {
    const parsed = sourceQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      await reply.code(400).send({ error: "Invalid query parameters.", details: parsed.error.issues });
      return;
    }

    const resolved = resolveInsideRepository(root, parsed.data.file);
    if (!resolved.ok) {
      await reply.code(400).send({ error: resolved.reason });
      return;
    }

    const exists = await pathExists(resolved.absolutePath);
    const line = parsed.data.line !== undefined ? Number(parsed.data.line) : undefined;

    await reply.send({
      file: parsed.data.file,
      absolutePath: resolved.absolutePath,
      exists,
      editorUrl: buildEditorUrl(resolved.absolutePath, line),
      ...(line !== undefined ? { line } : {}),
    });
  });
}

function registerRevealRoute(app: FastifyInstance, root: string, revealImpl: RevealImpl): void {
  app.post("/api/reveal", async (request, reply) => {
    const parsed = revealBodySchema.safeParse(request.body);
    if (!parsed.success) {
      await reply.code(400).send({ error: "Invalid request body.", details: parsed.error.issues });
      return;
    }

    const paths = observatoryPaths(root);
    const targetPath = parsed.data.target === "observatory" ? paths.dir : paths.skillFile;

    try {
      await revealImpl(targetPath);
      await reply.send({ revealed: true });
    } catch (error) {
      await reply.code(500).send({
        revealed: false,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

/** Registers every `/api/*` route except `/api/events` (SSE lives in `events.ts`). */
export function registerRoutes(app: FastifyInstance, context: RouteContext): void {
  const { root, store } = context;
  const revealImpl = context.revealImpl ?? defaultRevealImpl;

  app.get("/api/state", async (_request, reply) => {
    await reply.send(store.getSnapshot());
  });

  app.get("/api/project", async (_request, reply) => {
    await reply.send(store.getSnapshot().project);
  });

  app.get("/api/workflows", async (_request, reply) => {
    await reply.send(store.getSnapshot().workflows);
  });

  app.get<{ Params: { id: string } }>("/api/workflows/:id", async (request, reply) => {
    const record = store.getSnapshot().workflows.find((workflow) => workflow.id === request.params.id);
    if (record === undefined) {
      await reply.code(404).send({ error: `No workflow with id '${request.params.id}'.` });
      return;
    }
    await reply.send(record);
  });

  app.get("/api/diagnostics", async (_request, reply) => {
    await reply.send(store.getSnapshot().diagnostics);
  });

  registerSourceRoute(app, root);

  app.post("/api/recheck", async (_request, reply) => {
    const snapshot = await store.reload();
    await reply.send(snapshot);
  });

  registerRevealRoute(app, root, revealImpl);
}
