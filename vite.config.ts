import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const schemaAlias = fileURLToPath(new URL("./src/schema", import.meta.url));
const webAlias = fileURLToPath(new URL("./src/web", import.meta.url));

export default defineConfig({
  root: "src/web",
  plugins: [react()],
  resolve: {
    alias: {
      "@schema": schemaAlias,
      "@web": webAlias,
    },
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4310",
        ws: false,
        // SSE (/api/events) rides plain HTTP: disable response buffering/compression
        // negotiation so chunks reach the client as they are flushed by Fastify.
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader("accept-encoding", "identity");
          });
        },
      },
    },
  },
});
