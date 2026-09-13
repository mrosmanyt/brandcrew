import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Cinem AI Assistant — Vite config tuned for Tauri 2.0
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // Tauri expects a fixed port; fail fast if it is taken
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
  build: {
    target: "es2022",
    // Anti-theft hardening: no sourcemaps + console/debugger stripped —
    // the shipped bundle is minified and unreadable.
    sourcemap: false,
  },
  esbuild: {
    drop:
      process.env.NODE_ENV === "production"
        ? (["console", "debugger"] as ("console" | "debugger")[])
        : [],
  },
});
