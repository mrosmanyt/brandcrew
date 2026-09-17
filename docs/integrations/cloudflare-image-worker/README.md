# Cloudflare Workers AI image generation

Self-host a text-to-image endpoint on Cloudflare Workers, then point CINEM Pro at it.

## Deploy

1. Create a Worker in the [Cloudflare dashboard](https://dash.cloudflare.com/workers).
2. Paste `worker.js` from this folder into the editor.
3. Add environment variable `API_KEY` (a strong secret).
4. Enable **Workers AI** and add an `AI` service binding named `AI`.
5. Deploy. Your URL looks like `https://<name>.<subdomain>.workers.dev`.

## Wire into CINEM Pro

Set on the server (Vercel Production/Preview or local `.env`):

```bash
CINEM_IMAGE_GEN_URL=https://your-worker.workers.dev
CINEM_IMAGE_GEN_API_KEY=your-secret-api-key
```

Or per-user BYOK: Cinem AI Assistant → Settings → BYOK → Image worker URL + API key.

## API contract

```bash
curl -X POST "$CINEM_IMAGE_GEN_URL" \
  -H "Authorization: Bearer $CINEM_IMAGE_GEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"A cinematic product shot"}' \
  --output image.jpg
```

CINEM Pro exposes `GET/POST /api/image/generate` — the browser and assistant call that route; the worker key never ships to clients.

## Desk + Assistant

- Desk: **Settings → Desk tools → Generate image** (`/desk/:id/image-gen`)
- Assistant: say “generate an image of …” in chat (signed in to Cinem Pro cloud)
