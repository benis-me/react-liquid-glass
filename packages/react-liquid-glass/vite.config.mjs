import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "node:fs";
import { resolve } from "node:path";

const libraryDir = resolve(import.meta.dirname, "dist");

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
      external: ["react", "react/jsx-runtime", "react-dom", "motion", "motion/react", "lucide-react"],
    },
  },
});
