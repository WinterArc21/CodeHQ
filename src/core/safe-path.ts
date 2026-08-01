/**
 * Security-critical: resolves a repository-relative path against a repository root and
 * proves containment, resisting `..`, absolute paths, drive letters, UNC paths, and
 * symlink escapes. Used by source verification, `/api/source`, and workflow file operations.
 */

import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { describePathProblem } from "@schema/paths";

export type SafePathResult = { ok: true; absolutePath: string } | { ok: false; reason: string };

function normalizeForCompare(p: string): string {
  return process.platform === "win32" ? p.toLowerCase() : p;
}

function withTrailingSep(p: string): string {
  return p.endsWith(path.sep) ? p : `${p}${path.sep}`;
}

/**
 * Realpath's `target`. When `target` does not exist, walks up to the nearest existing
 * ancestor, realpath's THAT (so a symlinked directory cannot be used to escape even when
 * the final path segment does not exist yet), then rejoins the non-existent suffix.
 */
function realpathExistingAncestor(target: string): string {
  let current = target;
  const missingSuffix: string[] = [];

  while (!existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) {
      // Reached a filesystem root without finding anything real; nothing to realpath.
      return target;
    }
    missingSuffix.unshift(path.basename(current));
    current = parent;
  }

  let real: string;
  try {
    real = realpathSync(current);
  } catch {
    real = current;
  }

  return missingSuffix.length > 0 ? path.join(real, ...missingSuffix) : real;
}

/**
 * Resolves `relativePath` against `root` and proves the result is inside the repository.
 *
 * Algorithm (do not simplify this — see contract §8):
 * 1. Reject outright anything `describePathProblem` flags (absolute, drive letter, UNC,
 *    `..`, empty, NUL).
 * 2. `path.resolve(root, relativePath)`.
 * 3. `realpathSync` both the root and the resolved path, falling back to the non-realpath
 *    value only when the target does not exist, but always realpath'ing the nearest
 *    existing parent directory.
 * 4. Assert containment with a separator-aware check, never a bare `startsWith`.
 * 5. Compare case-insensitively on Windows.
 */
export function resolveInsideRepository(root: string, relativePath: string): SafePathResult {
  const problem = describePathProblem(relativePath);
  if (problem) {
    return { ok: false, reason: problem };
  }

  const candidate = path.resolve(root, relativePath);

  let realRoot: string;
  try {
    realRoot = realpathSync(root);
  } catch {
    return { ok: false, reason: "Repository root could not be resolved." };
  }

  const resolvedReal = realpathExistingAncestor(candidate);

  const realRootCompare = normalizeForCompare(realRoot);
  const resolvedCompare = normalizeForCompare(resolvedReal);
  const boundary = withTrailingSep(realRootCompare);

  const isContained = resolvedCompare === realRootCompare || resolvedCompare.startsWith(boundary);
  if (!isContained) {
    return { ok: false, reason: "Path escapes the repository root." };
  }

  return { ok: true, absolutePath: resolvedReal };
}
