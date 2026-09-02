import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

const libraryDir = resolve(import.meta.dirname, "dist/library");

export default defineConfig({
  plugins: [
    react(),
    {
      name: "emit-control-styles",
      closeBundle() {
        copyFileSync(resolve(import.meta.dirname, "src/lib/controls.css"), resolve(libraryDir, "controls.css"));
      },
    },
  ],
  build: {
    outDir: "dist/library",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(import.meta.dirname, "src/lib/index.ts"),
      formats: ["es", "cjs"],
      fileName: (format) => (format === "es" ? "index.js" : "index.cjs"),
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "motion/react"],
    },
  },
});
