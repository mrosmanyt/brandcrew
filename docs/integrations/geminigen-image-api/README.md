# GeminiGen image API (Nano Banana)

Server-side integration for [GeminiGen](https://geminigen.ai) text-to-image. CINEM Pro never exposes `GEMINIGEN_API_KEY` to the browser.

## Setup

1. Create a GeminiGen account and upgrade to a **Premium** plan (API keys require Premium).
2. Generate an API key in your GeminiGen profile → API.
3. Set on the server (Vercel or local `.env`):

```bash
GEMINIGEN_API_KEY=your-premium-api-key
# Optional overrides:
# GEMINIGEN_BASE_URL=https://geminigen.ai
# GEMINIGEN_IMAGE_MODEL=nano-banana
# GEMINIGEN_WEBHOOK_SECRET=optional-shared-secret
```

Or per-user BYOK: Cinem AI Assistant → Settings → BYOK → **GeminiGen API key**.

## API contract (upstream)

Submit (multipart — preferred):

```bash
curl -X POST "https://geminigen.ai/uapi/image/generate" \
  -H "x-api-key: $GEMINIGEN_API_KEY" \
  -F "prompt=A cinematic product shot" \
  -F "model=nano-banana"
```

Fallback JSON submit:

```bash
curl -X POST "https://geminigen.ai/uapi/v1/generate" \
  -H "x-api-key: $GEMINIGEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"type":"image","prompt":"A cinematic product shot","model":"nano-banana"}'
```

Jobs return a `uuid` with `status: 1` while processing. Completion is `status: 2` with `media_url` (webhook or poll).

## CINEM Pro routes

| Route | Purpose |
|-------|---------|
| `GET /api/image/generate` | Lists configured providers + models |
| `POST /api/image/generate` | `{ prompt, provider?: "geminigen", model?: "nano-banana" }` |
| `POST /api/webhooks/geminigen-image` | Optional async completion webhook |

**Polling** is the default completion path (tries `/uapi/image/history/:uuid` and fallbacks). Configure the webhook in GeminiGen to `https://app.cinem.tech/api/webhooks/geminigen-image` for faster completion; set `GEMINIGEN_WEBHOOK_SECRET` and send it as `x-geminigen-webhook-secret` if you want verification.

## Models

Default: `nano-banana`. Desk UI also lists `imagen-flash`, `imagen-4`, `imagen-4-fast`, `imagen-4-ultra` when GeminiGen is configured.

## Docs

- https://docs.geminigen.ai
- https://github.com/GeminiGenAI/AI-Image-API
