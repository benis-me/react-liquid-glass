import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

const libraryDir = resolve(import.meta.dirname, "dist");
const clientEntries = new Set(["index", "liquid-glass", "apple-motion-react", "controls"]);

export default defineConfig({
  plugins: [
    react(),
    {
      name: "emit-control-styles",
      closeBundle() {
        copyFileSync(resolve(import.meta.dirname, "src/controls.css"), resolve(libraryDir, "controls.css"));
        copyFileSync(resolve(import.meta.dirname, "src/controls.css.d.ts"), resolve(libraryDir, "controls.css.d.ts"));
      },
    },
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: {
        index: resolve(import.meta.dirname, "src/index.ts"),
        "liquid-glass": resolve(import.meta.dirname, "src/liquid-glass/index.ts"),
        "liquid-glass-renderer": resolve(import.meta.dirname, "src/liquid-glass/renderer.ts"),
        "apple-motion": resolve(import.meta.dirname, "src/apple-motion/index.ts"),
        "apple-motion-react": resolve(import.meta.dirname, "src/apple-motion/react.ts"),
        controls: resolve(import.meta.dirname, "src/controls/index.ts"),
      },
      formats: ["es", "cjs"],
      fileName: (format, name) => `${name}.${format === "es" ? "js" : "cjs"}`,
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "react-dom", "motion", "motion/react", "lucide-react", "@radix-ui/react-scroll-area"],
      // React entries are client modules for React Server Components; the renderer
      // and motion cores stay framework-agnostic.
      output: { banner: chunk => chunk.isEntry && clientEntries.has(chunk.name) ? '"use client";' : "" },
    },
  },
});
