# Image generation BYOK

Per-user image generation keys are stored encrypted in `UserProviderKey` (server) or pasted in the Assistant BYOK tab (local + cloud sync).

## Vercel / server environment (never commit values)

| Variable | Purpose |
|----------|---------|
| `CINEM_IMAGE_GEN_URL` | Cloudflare Worker (or compatible) endpoint for image jobs |
| `CINEM_IMAGE_GEN_API_KEY` | Bearer/API key for the worker |
| `GEMINIGEN_API_KEY` | GeminiGen provider when worker is not configured |
| `GEMINIGEN_BASE_URL` | Optional GeminiGen API base (default from provider) |
| `GEMINIGEN_IMAGE_MODEL` | Optional model override |
| `SESSION_SECRET` | Required to encrypt/decrypt `UserProviderKey` ciphertext |

Set these in Vercel → Project → Settings → Environment Variables (Production + Preview).

## Per-user BYOK (Assistant + desk)

Users can override the platform worker in Settings → BYOK:

- **Image worker URL** → `UserProviderKey.imageGenUrlEnc`
- **Image worker API key** → `UserProviderKey.imageGenApiKeyEnc`
- **GeminiGen API key** → `UserProviderKey.geminigenApiKeyEnc`

API: `GET/PATCH /api/user/byok` (`src/server/api/user/byok.ts`).

Assistant client: `apps/cinem-ai-assistant/src/lib/imageGeneration.ts` → `POST /api/image/generate`.

## Whop / billing (document only)

When creating Assistant SKUs in Whop, use env names such as:

- `WHOP_ASSISTANT_PRODUCT_ID`
- `WHOP_ASSISTANT_PLAN_FREE_ID`
- `WHOP_ASSISTANT_PLAN_PRO_ID`

Paste IDs in Vercel — do not commit real product IDs to git.
