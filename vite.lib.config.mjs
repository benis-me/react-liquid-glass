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
      entry: {
        index: resolve(import.meta.dirname, "src/lib/index.ts"),
        "liquid-glass": resolve(import.meta.dirname, "src/lib/liquid-glass/index.ts"),
        "liquid-glass-renderer": resolve(import.meta.dirname, "src/lib/liquid-glass/renderer.ts"),
        "apple-motion": resolve(import.meta.dirname, "src/lib/apple-motion/index.ts"),
        "apple-motion-react": resolve(import.meta.dirname, "src/lib/apple-motion/react.ts"),
        controls: resolve(import.meta.dirname, "src/lib/controls/index.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, name) => `${name}.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "motion", "motion/react"],
    },
  },
});
