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
    sourcemap: true,
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
    sourcemap: true,
    clean: false,
    tsconfig: "tsconfig.node.json",
  },
]);
