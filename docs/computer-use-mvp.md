# Computer-use MVP (Cinem AI Assistant / Windows)

Supervised desktop automation inspired by Stonic-style control. Ships **dark** unless `COMPUTER_USE_ENABLED=1` (or local dev checkbox in the Computer Use panel).

## Architecture

| Layer | Location | Role |
|-------|----------|------|
| **Renderer** | `apps/cinem-ai-assistant/src/` | Chat handoff, TERMINATE button, step store, allowlist validation |
| **Preload** | `electron/assistant-preload.cjs` | `window.cinemDesktop.computerUse` IPC bridge |
| **Main** | `electron/computer-use.cjs` | Always-on-top HUD, `Ctrl+Alt+Esc`, mouse-move pause polling |
| **Sidecar** | `apps/cinem-ai-assistant/computer-use-server/` | HTTP `:7879` — focus allowlisted apps via PowerShell (Windows) |

### Data flow

1. User asks in chat → orchestrator fast-path `isComputerUseCommand` → `computer_use` agent.
2. Agent starts session → main opens HUD + sidecar → steps logged in Zustand store.
3. Each step calls sidecar `/focus` or `/open-url` (allowlist only).
4. Kill switch: UI **TERMINATE**, global **Ctrl+Alt+Esc**, or max steps (default 50).

### Kill switch & mouse pause (exact behavior)

| Trigger | Effect |
|---------|--------|
| Red **TERMINATE** in Assistant | Ends session immediately; HUD shows Terminated then closes |
| **Ctrl+Alt+Esc** (global) | Same as TERMINATE |
| **Mouse move** while status is **Working** | Pauses session (status → Paused). Does **not** terminate. Moving ≥12px from last sampled position counts. Poll interval 200ms in main process. Resume by starting a new command or future resume UX. |
| Max steps (50) | Auto-terminate with reason `max_steps` |

### AI cursor limitation (Windows)

Windows does not expose a supported way to show a second “AI” system cursor without low-level hooks or driver code. This MVP uses the floating HUD badge **AI DRIVING** plus visible app focus changes so the user always knows automation is active.

### Allowlist (safe mode)

Default allowed apps: Explorer, Chrome, Edge, Firefox, ChatGPT Desktop (if installed), Premiere (if installed), Notepad.

**PowerShell** (`/powershell`) runs only when the user clicks **Allow PowerShell** in the UI (`confirmed: true` in API body).

### Feature flag

- Env: `COMPUTER_USE_ENABLED=1` on Electron main (see `.env.example`).
- Local dev: checkbox in Computer Use panel (persists `cinem.computerUse.enabled` in localStorage).
- Cloud: `FeatureFlag` key `computer_use_mvp` — **TODO**: wire `isFeatureEnabled()` when desk approval path is ready for assistant sessions.

### Admin approval

No clean cross-product approval hook exists yet for assistant-local sessions. Risky start is gated by feature flag + allowlist + shell confirm. Search codebase for `TODO(admin)` in `feature.ts`.

## Try locally on Windows

```powershell
# From repo root
$env:COMPUTER_USE_ENABLED = "1"
npm run desktop:assistant

# Optional: run sidecar manually for debugging
node apps/cinem-ai-assistant/computer-use-server/index.js
```

In Assistant chat:

- `control my desktop and open explorer`
- `expand prompt for a moody cyberpunk product launch`

Verify HUD (top-right), step counter, TERMINATE, and Ctrl+Alt+Esc.

## Tests (no desktop)

```bash
npx tsx scripts/check-computer-use.ts
```
