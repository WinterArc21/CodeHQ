import type { ObservatorySnapshot, RevealTarget, SourceLookup } from "./types";

/** Base URL is empty: Vite proxies `/api` to the local server (contract §8). */
const BASE_URL = "";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function safeFetch(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}${path}`, init);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ApiError(0, `Could not reach the Code Observatory server: ${detail}`);
  }
}

async function ensureOk(path: string, response: Response): Promise<void> {
  if (response.ok) {
    return;
  }
  const body = await response.text().catch(() => "");
  const message = body.trim().length > 0 ? body.trim() : `Request to ${path} failed with status ${response.status}.`;
  throw new ApiError(response.status, message);
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await safeFetch(path, init);
  await ensureOk(path, response);
  return (await response.json()) as T;
}

async function requestVoid(path: string, init?: RequestInit): Promise<void> {
  const response = await safeFetch(path, init);
  await ensureOk(path, response);
}

/** `GET /api/state` — the primary full snapshot. */
export function getState(): Promise<ObservatorySnapshot> {
  return requestJson<ObservatorySnapshot>("/api/state");
}

/** `GET /api/source` — metadata only, never file contents (contract §8). */
export function getSource(file: string, line?: number): Promise<SourceLookup> {
  const params = new URLSearchParams({ file });
  if (line !== undefined) {
    params.set("line", String(line));
  }
  return requestJson<SourceLookup>(`/api/source?${params.toString()}`);
}

/** `POST /api/recheck` — forces a full reload and returns the new snapshot. */
export function recheck(): Promise<ObservatorySnapshot> {
  return requestJson<ObservatorySnapshot>("/api/recheck", { method: "POST" });
}

/** `POST /api/reveal` — opens the OS file manager at a fixed, non-arbitrary target. */
export function reveal(target: RevealTarget): Promise<void> {
  return requestVoid("/api/reveal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target }),
  });
}
