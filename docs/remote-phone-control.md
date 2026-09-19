# Remote phone control (Telegram + WhatsApp)

Control the **Windows Cinem AI Assistant** from your phone while the PC is on and the Assistant is running. Commands flow through a queue into the same **multilayer orchestrator** used by voice and chat; replies go back on the same channel.

## Architecture

```
Phone (Telegram / WhatsApp)
    → Queue (local long-poll OR cloud Postgres)
    → Desktop Assistant poller / Telegram loop
    → executeRemoteText() → processCommand() (orchestrator)
    → Progress + final reply → phone
```

### Telegram (primary — easiest)

| Step | What happens |
|------|----------------|
| 1 | Create a bot via [@BotFather](https://t.me/BotFather). Copy the token. |
| 2 | Assistant **Settings → Remote** → paste `TELEGRAM_BOT_TOKEN` (BYOK per user). |
| 3 | Start Telegram — app shows a **6-digit pairing code**. Send that code to your bot from the phone chat you want to link. |
| 4 | Only that `chat_id` can command your PC. Others get “Not authorized.” |
| 5 | Text any command — same as desktop (“morning briefing”, “post to instagram …”, “open chrome”). |

**No public IP required** — desktop long-polls `api.telegram.org` (25s). Works behind NAT.

### WhatsApp

Two paths:

#### A) WhatsApp Cloud API (deployed desk)

For users with a **public HTTPS** deployment (e.g. Vercel):

| Env (server) | Purpose |
|--------------|---------|
| `WHATSAPP_TOKEN` | Meta Business app permanent token |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID from Meta |
| `WHATSAPP_VERIFY_TOKEN` | Webhook verify string (you choose) |
| `WHATSAPP_APP_SECRET` | Optional — validates `X-Hub-Signature-256` |

1. Configure webhook URL: `https://<your-desk>/api/whatsapp/webhook`
2. Pair phone: `POST /api/assistant/whatsapp-link` with `{ "phone": "+1…" }` (signed-in user)
3. Inbound messages → `AssistantRemoteCommand` queue
4. Desktop Assistant polls `GET /api/companion/commands` (signed in) → runs command → optional Cloud API reply

#### B) WhatsApp Web fallback (desktop-only, fragile)

Assistant **Settings → Remote** → enter your number → **Start WhatsApp**.

- Playwright opens **WhatsApp Web** in a persistent profile (QR once).
- Commands go to your **“Message yourself”** chat.
- Replies prefixed with `🤖` so Cinem ignores its own messages.

Secondary / fragile — prefer Cloud API when deployed.

## Feature flag

| Where | Key |
|-------|-----|
| Env | `REMOTE_PHONE_CONTROL_ENABLED=1` |
| Admin HQ | `remote_phone_control` |
| Settings → Remote | “Remote phone control (dev)” |

Opting in via **Telegram enabled** or **WhatsApp enabled** in Settings also counts as explicit user consent.

## Keys summary (nothing committed)

| Channel | You provide |
|---------|-------------|
| **Telegram** | BotFather token + pairing code (no user Telegram API key) |
| **WhatsApp Cloud** | Meta token, phone number id, verify token; optional app secret |
| **Social platforms** | **No API keys** — browser login only (see `docs/chrome-social-playbooks.md`) |
| **Brain** | Gemini BYOK in Assistant Settings (unchanged) |

## Compound commands

Separate steps with newline, `;`, or `&&`:

```
open chrome; research AI news
morning briefing && post to youtube "C:\Videos\a.mp4"
```

## Security

- Telegram: single paired `chat_id` only.
- WhatsApp Web: self-chat only.
- WhatsApp Cloud: phone must be linked to your CINEM account.
- **Never** scrape or export cookies into git/logs.

## Try Telegram end-to-end

1. Install **CINEM Pro** Windows Assistant (`CINEM-Pro-Setup.exe`).
2. Set **Gemini API key** in Settings (brain).
3. Create Telegram bot → paste token → enable Telegram → note **6-digit code**.
4. On phone, open bot → send code → send `/help`.
5. Send: `morning briefing` or `open youtube` — reply should appear in Telegram within seconds.

## Code map

- `apps/cinem-ai-assistant/src/lib/telegram.ts` — long-poll Bot API
- `apps/cinem-ai-assistant/src/lib/whatsapp.ts` — Playwright Web fallback
- `apps/cinem-ai-assistant/src/lib/remote-control/` — pairing, parser, queue
- `apps/cinem-ai-assistant/src/lib/remote-poll.ts` — cloud command poller
- `src/lib/whatsapp-cloud.ts` — Cloud webhook + queue
- `src/lib/remote-command-queue.ts` — Postgres queue
- `src/server/api/whatsapp/webhook.ts` — Meta webhook
- `src/server/api/companion/commands.ts` — desktop poll endpoint
