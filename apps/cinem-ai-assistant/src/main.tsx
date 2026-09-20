import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import CinemProGate from "./components/gate/CinemProGate";
import GeminiOnboardingModal from "./components/gate/GeminiOnboardingModal";
import UpgradeModal from "./components/gate/UpgradeModal";
import AssistantProLock from "./components/gate/AssistantProLock";
import IntegrityGuard from "./components/gate/IntegrityGuard";
import AdminPanel from "./components/admin/AdminPanel";
import "./index.css";

/**
 * Entry — two routes, one codebase, TWO processes:
 *   /          → Cinem AI Assistant (CINEM Pro session + usage meter)
 *   /admin     → Local Admin Panel (approve/reject, freeze, activity, …)
 *
 * The Admin Panel runs as its own local web server (db-server, port 1430):
 *   →  http://localhost:1430/admin   (production + dev, any browser)
 *   →  http://localhost:1420/admin   (vite dev server, same UI)
 *
 * Both processes share ONE database via the db-server API
 * (~/.cinem-ai-assistant/cinem-ai-assistant-localdb.json) — signups appear in the panel in
 * real time. 100% local and offline: no Supabase, no cloud.
 */
const isAdminRoute =
  window.location.pathname.replace(/\/+$/, "") === "/admin" ||
  window.location.hash.startsWith("#/admin");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isAdminRoute ? (
      <AdminPanel />
    ) : (
      // Anti-theft: the UI refuses to run outside the genuine Cinem AI Assistant core.
      <IntegrityGuard>
        <CinemProGate>
          <App />
          <GeminiOnboardingModal />
          <UpgradeModal />
          <AssistantProLock />
        </CinemProGate>
      </IntegrityGuard>
    )}
  </React.StrictMode>,
);
