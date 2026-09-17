# Cinem AI Assistant — Playwright Automation Sidecar

Playwright is a Node library and can't run inside Cinem AI Assistant's WebView, so it runs
here as a tiny local server that the desktop app calls over `127.0.0.1:7878`.
When this server is running you get real browser automation in a visible,
persistent Chromium (logins for WhatsApp/Gmail/etc. are remembered). When it's
**not** running, Cinem AI Assistant automatically falls back to opening your default
browser — so browser commands always work either way.

## Setup (once)

```bash
cd D:\Cinem AI Assistant\playwright-server
npm install          # installs Playwright + downloads Chromium (postinstall)
```

## Run (keep open while using Cinem AI Assistant)

```bash
npm start            # launches Chromium + the API on http://127.0.0.1:7878
```

Leave this terminal running. Start it before (or alongside) the Cinem AI Assistant app.

## API

| Method | Path       | Body                     | Action                         |
|--------|------------|--------------------------|--------------------------------|
| GET    | `/health`  | —                        | liveness check                 |
| POST   | `/open`    | `{ url }`                | navigate to a URL              |
| POST   | `/search`    | `{ query, extract?, follow? }` | Google search (+ optional result extract) |
| POST   | `/research`  | `{ query, follow? }`           | Google search + open top result pages     |
| POST   | `/youtube`   | `{ query, play? }`             | YouTube search; play first hit (autoplay) |

## Commands that use it (in Cinem AI Assistant)

"open google", "open whatsapp", "open gmail", "open instagram", "open github",
"open notion.so", "search latest AI news", "google weather"… all route through
the Playwright `Browser Agent` fast-path (before the AI model), with a system-
browser fallback.

> The persistent Chromium profile is stored in your temp folder
> (`cinem-ai-assistant-playwright-profile`). Delete it to reset saved logins/cookies.
