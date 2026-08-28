import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  base: "./",
  server: {
    headers: {
      "Content-Security-Policy":
        "script-src 'self' blob: 'wasm-unsafe-eval'; worker-src 'self' blob:",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    sourcemap: true,
    target: "esnext",
    rollupOptions: {
      input: {
        index: "index.html",
      },
    },
  },
});
