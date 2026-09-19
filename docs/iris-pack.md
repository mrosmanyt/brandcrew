# IRIS-inspired UX pack (Cinem AI Assistant)

Feature-flagged polish pack that extends the **existing** center orb (`IntelligenceHub`) — no second orb.

## Enable

1. **Production / preview:** set `IRIS_PACK_ENABLED=1` on the Electron shell or Vercel env.
2. **Local dev:** Settings → Remote → **IRIS UX pack** (dev toggle).
3. Optional: Settings → Voice → **Hinglish Boss Persona** for casual TTS replies.

## Try it

| Feature | How |
|--------|-----|
| Live transcript | Left sidebar shows **HEARD** + **REPLIED** after voice turns |
| Orb states | Idle / listening / thinking / speaking / error on the center Three.js orb |
| Wake word | Enable **Hey Cinem** — orb turns green, transcript logs wake, short TTS ack |
| Spatial snap | Say *"WhatsApp left, Chrome right"* (Windows + computer-use sidecar on 7879) |
| Web autopilot | *"google search cats and open first result"* or *"youtube search lofi and play first"* |
| System meters | Orb panel footer shows CPU / RAM / volume (Electron Windows) |

## Tests

```bash
npm run test:iris-pack
```

## Files

- `apps/cinem-ai-assistant/src/lib/iris/*` — pure logic (orb state, persona, spatial parse, web autopilot)
- `apps/cinem-ai-assistant/src/components/iris/*` — live transcript + meters strip
- `apps/cinem-ai-assistant/src/components/center/IntelligenceHub.tsx` — **reused orb** animations
- `apps/cinem-ai-assistant/computer-use-server/index.js` — `/snap-layout`
- `electron/system-meters.cjs` — lightweight Windows meter IPC
