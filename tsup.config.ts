import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf-8")) as { version: string };

export default defineConfig([
  {
    entry: { cli: "src/cli/index.ts" },
    outDir: "dist/node",
    format: "esm",
    target: "node20",
    platform: "node",
    // No source maps: `files` in package.json ships only `dist` and `templates`, so a published
    // map would point at `src/` paths the installing user does not have. Dropping them takes the
    // tarball from 284 KB to 219 KB (256 KB unpacked) for a pointer that could never resolve.
    // Local debugging is unaffected — it runs from the source tree via tsx.
    sourcemap: false,
    clean: false,
    tsconfig: "tsconfig.node.json",
    // Bakes the package version into the CLI binary so `--version` never has to read
    // package.json at runtime via a path that would break once bundled (see src/cli/version.ts).
    define: {
      __CLI_VERSION__: JSON.stringify(packageJson.version),
    },
    banner: {
      js: "#!/usr/bin/env node",
    },
  },
  {
    entry: { server: "src/server/index.ts" },
    outDir: "dist/node",
    format: "esm",
    target: "node20",
    platform: "node",
    sourcemap: false,
    clean: false,
    tsconfig: "tsconfig.node.json",
  },
]);
