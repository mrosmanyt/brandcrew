# Fish Audio voices (Cinem AI Assistant)

CINEM Pro can speak with **Fish Audio** when you paste an API key. No key is shipped in the app. Do not invent keys or commit them.

Without a key, the assistant uses **Windows / Edge Neural** voices (Microsoft Aria Online, Jenny, …) — a sweet, clear English default. The old harsh “all systems nominal / our system is online” clip is gone.

Whisper is **speech-to-text only**. It is never used as a speaker.

## How the founder adds a key

1. Create an account at [fish.audio](https://fish.audio) → Developers → API Keys.
2. Copy the key. It is not stored in this repo.
3. Either:
   - **Settings → Voice** (or **Settings → API**) → **Fish Audio API Key** → Save, or
   - Set `FISH_AUDIO_API_KEY` (or `FISH_API_KEY`) in the desktop environment before launch. The Electron preload reads that env and never hardcodes a value.
4. Optional Vite/dev: `VITE_FISH_AUDIO_API_KEY` in a local `.env` (not committed).

TTS call: `POST https://api.fish.audio/v1/tts` with `Authorization: Bearer <key>`, `Content-Type: application/json`, and header `model` (default **`s2.1-pro-free`**, the documented free developer tier). Override the model in Settings if you upgrade.

## Map a character to a Fish voice

Fish `reference_id` values live on each voice page (`https://fish.audio/m/…` — copy the model id). Official docs use example ids such as `802e3bc2b27e49c2995d23ef70e6ac89`; those are **examples**, not CINEM characters.

1. Open Settings → Voice.
2. Select a character (Aria, Zara, …).
3. Paste that character’s Fish model id into **Fish Audio voice ID**.
4. Save. Empty id → Fish default voice until you map one.

## Character roster

| Character | Language | Gender |
| --- | --- | --- |
| Aria (default) | English | Female |
| Julian | English | Male |
| Zara | Urdu | Female |
| Hamza | Urdu | Male |
| Ananya | Hindi | Female |
| Arjun | Hindi | Male |
| Elif | Turkish | Female |
| Mateo | Spanish | Male |
| Layla | Arabic | Female |
| Camille | French | Female |

Default **spoken language is English**. If the user writes or speaks another language, replies and TTS follow that language (character gender is kept when a matching speaker exists).

## Fallback order

1. Fish Audio — only when a key is present in Settings or `FISH_AUDIO_API_KEY`.
2. ElevenLabs — only when that key is present.
3. Piper — Tauri-only offline build.
4. Chromium / Windows `speechSynthesis`, preferring Microsoft **Online (Natural)** / Neural voices. Never eSpeak or the harsh David Desktop default when a Neural voice exists.

## Unsigned Setup.exe

`CINEM-Pro-Setup.exe` stays **unsigned** unless Azure Artifact Signing is configured. SmartScreen **More info → Run anyway** is expected. See `docs/windows-code-signing.md`.
