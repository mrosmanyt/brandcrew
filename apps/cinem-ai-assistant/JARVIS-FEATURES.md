# JARVIS-style capabilities (Cinem AI Assistant)

Independent implementation in Cinem’s TypeScript/Electron stack — inspired by modern voice-assistant patterns, **not** copied from Mark-LIV or other CC BY-NC projects.

## Capability map

| Inspired capability | Cinem implementation | Status |
|---------------------|----------------------|--------|
| Real-time voice | Mic bar + STT chain (Deepgram / browser / Whisper) + TTS (Fish / ElevenLabs / Neural) | **Shipped** |
| Persistent memory | `longMemory.ts` + Settings → Memory + `remember that` / `forget` | **Shipped** |
| Multi-mode web search | `multiModeSearch.ts` — news / research / price / compare / search | **Shipped** |
| YouTube control | Playwright `/youtube` + in-app player + `/youtube/control` pause/play/next | **Shipped** |
| Smart reminders | `reminders.ts` — local JSON + Notification API | **Shipped** (OS scheduler = follow-up) |
| Weather | `weather.ts` — Open-Meteo (no key) | **Shipped** |
| Morning / session briefing | `morningProtocol.ts` + `sessionBriefing.ts` | **Shipped** |
| Instant acknowledgment | `instantAck.ts` before long research/edit/complex jobs | **Shipped** |
| Tool registry | `toolRegistry.ts` injected into orchestrator routing | **Shipped** |
| Google research → chat | PR #92 `runResearchTask` + orchestrator inline reply | **Shipped** |

## Follow-ups (out of scope for this PR)

- Holographic lip-sync avatar
- OS-level desktop control on every platform
- WhatsApp/Telegram send (stubs exist; write-gated)
- Steam game updater
- OS Task Scheduler / LaunchAgent reminders (current: in-app notifications)

## Environment variables

| Variable | Purpose |
|----------|---------|
| `DEEPGRAM_API_KEY` | Paid STT (Electron env or Settings → Voice) |
| `VITE_DEEPGRAM_API_KEY` | Local Vite dev STT |
| `FISH_AUDIO_API_KEY` | Optional TTS |
| `ELEVENLABS` via Settings | TTS fallback |

See `apps/cinem-ai-assistant/.env.example`.

## Test plan

1. **Voice** — Set Deepgram key → mic → speak → hear TTS reply. Clear key → helpful error.
2. **Memory** — `remember that I prefer dark mode` → Settings → Memory shows entry → `forget dark mode`.
3. **Search** — `news about AI`, `price of iPhone 16`, `compare Notion vs Obsidian`.
4. **YouTube** — `play lofi on youtube` → `pause youtube` / `next video`.
5. **Weather** — `weather in Lahore`.
6. **Reminders** — `remind me in 2 minutes to stretch` → notification fires.
7. **Briefing** — Reload app → session greeting; `morning briefing` on demand.
8. **Research** — `research quantum computing` → brief appears in chat (not task-only).

Run: `npm run test:jarvis-features` from repo root.
