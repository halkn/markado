import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const API_ORIGIN = "http://localhost:6275";

export default defineConfig({
  root: "src/web",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/web/app", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: API_ORIGIN, changeOrigin: true },
    },
  },
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
    // Everything is served from localhost, so preloading buys nothing.
    modulePreload: false,
    // One stylesheet, loaded by the shell. Per-chunk CSS would make Mermaid's
    // per-diagram `import()` calls go through Vite's preload helper, which
    // rejects the whole import when a stylesheet fails to preload.
    cssCodeSplit: false,
    // The CLI embeds every emitted file as a UTF-8 string, so keep binary
    // assets inlined as data URIs rather than emitted as separate files.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
  },
});
