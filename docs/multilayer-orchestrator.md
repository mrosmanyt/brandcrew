# Multi-layer orchestrator

Compound user requests (weather + research + planners + browser + desktop) run through a durable pipeline:

```
User request
    → detect (isMultilayerRequest)
    → persist goal + subgoals (longMemory + localStorage)
    → split into numbered steps 1..N (LLM or heuristic, up to 12)
    → execute one-by-one (progress HUD + chat step reports)
    → final consolidated report
```

## Feature flag

| Env / toggle | Effect |
|--------------|--------|
| `MULTILAYER_ORCHESTRATOR_ENABLED=1` | Enable on Electron main / server |
| Settings → Computer Use → **Multi-layer orchestrator (dev)** | Local dev toggle |
| `cinem.computerUse.enabled=1` | Also enables multilayer in dev (incremental rollout) |

Cloud flag key: `multilayer_orchestrator` (Admin HQ — wire via `isFeatureEnabled()` when ready).

## Architecture modules

| Module | Path |
|--------|------|
| Detect compound requests | `apps/cinem-ai-assistant/src/lib/multilayer/detect.ts` |
| Split / plan | `apps/cinem-ai-assistant/src/lib/multilayer/planner.ts` |
| Durable memory | `apps/cinem-ai-assistant/src/lib/multilayer/memory.ts` |
| Execute + report | `apps/cinem-ai-assistant/src/lib/multilayer/executor.ts` |
| Progress HUD | `apps/cinem-ai-assistant/src/components/multilayer/MultilayerProgressHud.tsx` |
| Agent map handoffs | `apps/cinem-ai-assistant/src/components/multilayer/AgentMapPanel.tsx` |

## Example prompt

> Go to Google, check the weather in Lahore, research latest AI and tech news, build an event planner for my launch, and build a diet plan from my details: vegetarian, 1800 kcal.

The orchestrator stores the full goal, splits into ~6–8 steps, runs each with the matching agent (ATLAS/world, ALENA/research, ETHAN/planner, etc.), posts a per-step report in chat, then a final summary.

## How to try on Windows

1. Install / run Cinem AI Assistant: `npm run desktop:assistant`
2. Set env (PowerShell):

```powershell
$env:COMPUTER_USE_ENABLED = "1"
$env:MULTILAYER_ORCHESTRATOR_ENABLED = "1"
$env:PICOVOICE_ACCESS_KEY = "your-key"   # optional — offline wake word
```

3. Paste a Gemini key in Settings → BYOK (wizard).
4. Enable **Multi-layer orchestrator (dev)** in the Computer Use panel if env is not set.
5. Send a compound command in chat or say **Hey Cinem** then speak the request.
6. Watch the progress HUD (bottom-right), Agent Map (right column), and per-step chat reports.

Computer-use steps (ChatGPT → Premiere playbook) require allowlisted apps; user-confirm steps pause honestly.

## Related feature pack (same PR)

- **A** ChatGPT → download → Premiere playbook — `computer-use/playbooks/chatgpt-premiere.ts`
- **B** Blue AI cursor overlay — `electron/ai-cursor-overlay.html` + `computer-use.cjs`
- **C** Agent map UI — `AgentMapPanel` + SubAgents handoff badges
- **D** Gemini BYOK wizard — Settings → BYOK → `GeminiByokWizard`
- **E** Admin approve risky sessions — Admin panel → Computer Use tab
- **F** Wake word TTS ack — `wakeWord.ts` → `speakQueued("Yes?")`
- **G** Image BYOK + env docs — `docs/image-generation-byok.md`, BYOK tab hints

## Out of scope (documented env names only)

- `WHOP_ASSISTANT_*` — paste Whop product/plan IDs in Vercel when ready
- Code-signing / SmartScreen — see `docs/win-code-signing.md`
- Asia CDN — optional Cloudflare R2/Workers next to GitHub Releases
