# Cinem AI Assistant — NOVA Media Sidecar (ffmpeg video editor)

CapCut can't be reliably scripted, so NOVA edits with **ffmpeg** — fully
automated, preset-based, and faster than manual editing. This local server does
the heavy lifting; the Cinem AI Assistant app calls it.

## Requirements

- **ffmpeg** on PATH → https://ffmpeg.org/download.html (then `ffmpeg -version` should work)
- Node.js

## Run (keep open while editing)

```bash
cd D:\Cinem AI Assistant\media-server
node index.js          # → http://127.0.0.1:7880
```

## Styles (presets)

| Command style | What it does |
|---|---|
| **High-End Cinematic** | 1080p, color grade (contrast/saturation), sharpening, fade-ins, CRF 18 (top quality) |
| **Medium (YouTube)** | 1080p, light color, balanced quality (CRF 21) |
| **Quick Reel** | 720p, fast export (CRF 26, veryfast) |

## Use it from Cinem AI Assistant

1. Settings → API → **NOVA**: set your **Clips Folder** (e.g. `D:\Videos\Raw`), optional CapCut path.
2. Say/type:
   - "mere last 10 videos ko **high end cinematic** edit kar ke ready kar do"
   - "**medium** quality reels bana do"
   - "**normal** quick edit kar do"
3. A progress panel shows stages; the export lands in `<ClipsFolder>\CINEM-AI-ASSISTANT_Edited\`.

## API

`GET /health` · `POST /list {folder}` · `POST /edit {folder, style, count}` ·
`GET /job?id=` · `POST /thumbs {video, count}` · `POST /capcut {folder, capcutPath}`

> Captions/auto-music/cross-fade transitions are intentionally minimal in this
> first version (they need Whisper + ASS subtitle pipelines) — color grade,
> normalize, stitch and high-quality export are fully working.
