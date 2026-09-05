import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
const library = resolve(import.meta.dirname, "../../packages/react-liquid-glass/src");
export default defineConfig(({ command }) => ({
  plugins: [react()],
  resolve: { dedupe: ["react", "react-dom", "motion"], alias: command === "serve" ? [
    { find: /^refractive-glass-react\/(.*)$/, replacement: `${library}/$1` },
    { find: "refractive-glass-react", replacement: `${library}/index.ts` },
  ] : [] },
  server: { host: "0.0.0.0", allowedHosts: ["terminal.local"] },
  build: { outDir: "../../dist/client", emptyOutDir: true },
}));
