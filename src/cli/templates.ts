/**
 * Locates `templates/codehq/` at runtime. Must work both when `src/cli/index.ts` runs
 * directly under `tsx` (from source) and when it runs bundled as `dist/node/cli.js` — in
 * both layouts the templates directory sits exactly two directories above the running file
 * (`src/cli/` -> repo root, `dist/node/` -> package root), but we walk upward defensively
 * instead of hardcoding that depth so packaging changes do not silently break `init`.
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_ANCESTOR_DEPTH = 6;

/**
 * Returns the absolute path to `templates/codehq/`, searching upward from the
 * directory containing `fromUrl` (defaults to this module's own location). Throws a clear,
 * actionable error if it cannot be found within `MAX_ANCESTOR_DEPTH` levels.
 */
export function resolveTemplatesDir(fromUrl: string = import.meta.url): string {
  let dir = path.dirname(fileURLToPath(fromUrl));

  for (let depth = 0; depth <= MAX_ANCESTOR_DEPTH; depth += 1) {
    const candidate = path.join(dir, "templates", "codehq");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  throw new Error(
    "Could not locate the templates/codehq directory relative to the running CLI. " +
      "This usually means CodeHQ was installed or built incorrectly — try reinstalling the package.",
  );
}
