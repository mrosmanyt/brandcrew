# World Monitor (Cinem AI Assistant)

Live tab + **Today Headlines** use [worldmonitor.app](https://www.worldmonitor.app/). That site sets `X-Frame-Options: SAMEORIGIN`, so an iframe stays a black panel. CINEM Pro does **not** fake the embed.

## What ships without a key

- Public news (Google News → Hacker News) fills **Today Headlines** and **World Monitor — Live**.
- **OPEN EXTERNAL** opens the real dashboard in the browser.
- A setup note explains how to add the official digest.

## Official digest (founder)

World Monitor’s REST digest needs a `wm_…` API key ([auth docs](https://www.worldmonitor.app/docs/usage-auth), [ListFeedDigest](https://www.worldmonitor.app/docs/api-reference/newsservice/listfeeddigest)).

1. Sign in on **https://www.worldmonitor.app/** (account / billing is on their site).
2. Open their API / developer settings and copy a user key (`wm_` + 40 hex chars). API-tier / Pro on World Monitor may be required — only the founder can create this; do not invent a key.
3. Paste it in **Cinem AI Assistant → Settings → API → World Monitor API Key**, **or** set `WORLD_MONITOR_API_KEY` (alias `WORLDMONITOR_API_KEY`) on the desktop process / `%APPDATA%\CINEM Pro\.env` for local desk mode.

Roman-Urdu: World Monitor ki official feed ke liye unki site se `wm_…` key lo, Settings → API mein paste karo. Key ke baghair bhi headlines chalengi (public news). Iframe black ho to yeh normal hai — Live tab ab native feed dikhata hai.

## Files

- `apps/cinem-ai-assistant/src/lib/world-monitor.ts`
- `apps/cinem-ai-assistant/src/lib/news.ts`
- `electron/main.cjs` (`cinem:http-get` allowlist)
