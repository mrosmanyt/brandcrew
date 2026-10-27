import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const LAUNCH_ENV_KEYS = [
  "COMPUTER_USE_ENABLED",
  "MULTILAYER_ORCHESTRATOR_ENABLED",
  "SOCIAL_CHROME_PLAYBOOKS_ENABLED",
  "REMOTE_PHONE_CONTROL_ENABLED",
] as const;

function launchEnvDefine() {
  const define: Record<string, string> = {};
  for (const key of LAUNCH_ENV_KEYS) {
    define[`process.env.${key}`] = JSON.stringify(process.env[key] ?? "");
  }
  return define;
}

// Cinem AI Assistant — Vite config tuned for Tauri 2.0
export default defineConfig({
  define: launchEnvDefine(),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  // Inline PostCSS so Vite never walks to the Next.js root
  // postcss.config.mjs (@tailwindcss/postcss). Local postcss.config.mjs
  // is the same no-op for any other tool that searches from this folder.
  css: {
    postcss: {
      plugins: [],
    },
  },
  // Electron loadFile needs relative asset URLs. Tauri keeps "/".
  base: process.env.CINEM_ELECTRON_ASSISTANT === "1" ? "./" : "/",
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
