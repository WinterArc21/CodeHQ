/**
 * The CLI's own version string, for `--version`. `__CLI_VERSION__` is injected by
 * `tsup.config.ts` (an esbuild `define`) from `package.json` at build time — never read
 * `package.json` via a relative path at runtime, since that path's depth is not guaranteed
 * to survive bundling or packaging. Running from source (`tsx`, tests) has no build step, so
 * the identifier is simply undefined there; fall back to a clearly-marked dev version.
 */

declare const __CLI_VERSION__: string | undefined;

export function resolveCliVersion(): string {
  return typeof __CLI_VERSION__ === "string" ? __CLI_VERSION__ : "0.0.0-dev";
}
