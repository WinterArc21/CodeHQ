import { defineConfig } from "tsup";

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
