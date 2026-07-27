/**
 * Shared repository-root resolution for every CLI command (contract §9): `--root`, when
 * given, is used verbatim (resolved to an absolute path); otherwise fall back to the
 * documented upward walk from the current working directory.
 */

import path from "node:path";
import { resolveRepositoryRoot } from "@core/repository";

export function resolveCliRoot(rootOption: string | undefined): string {
  if (rootOption !== undefined && rootOption.length > 0) {
    return path.resolve(rootOption);
  }
  return resolveRepositoryRoot(process.cwd());
}
