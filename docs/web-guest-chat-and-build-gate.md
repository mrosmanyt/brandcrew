# Web guest chat + Build desktop gate

## Web home (`/`)

- ChatGPT-style guest chat replaces the marketing hero on `/`.
- Marketing content lives at `/about` (same sections, linked from the top nav).
- Guest limit: **10 user messages** per browser guest key (`localStorage` `cinem_guest_chat_key`).
- After the limit, `POST /api/guest/chat` returns `authRequired: true` and the UI prompts signup/login.
- Model picker uses the same catalog as the desk (`MODEL_ROUTING_GROUPS`); preference is stored in `cinem_guest_chat_model`.

## Build (web + desk browser)

- Build categories (Website, Mobile/App, Design, Slides, Content) stay visible but **locked** in:
  - Desk sidebar **Build** section
  - Composer **+** menu (lock icon)
  - Web guest chat **+** menu
- Natural-language build requests in the composer are blocked on non-desktop clients.
- Server enforcement: `POST /api/workspaces/:id/jobs` and `.../chat` return `403` with `code: DESKTOP_BUILD_REQUIRED` when a build intent is detected without `x-cinem-client: desktop`.

## Desktop local builder (Electron only)

1. User picks a Build item that writes local files (`website_builder`, `app_builder`, `deck_builder`).
2. Folder picker (`cinem:pick-project-folder`).
3. Permission prompt: “May I work on your local computer / in this folder?” (`cinem:request-build-permission`).
4. Scaffold writes HTML/CSS/JS + README under `<folder>/<slug>/`.
5. Mission Control thread shows a completion message with the folder path.

Preload API: `window.brandcrewDesktop.pickProjectFolder`, `getBuildPermission`, `requestBuildPermission`, `runLocalBuild`.

## Default language

- Product UI default: **English** (`lang="en"`, `DEFAULT_LOCALE` in `src/lib/i18n-default.ts`).
- LLM replies mirror the user’s language via existing `language-policy.ts`.

## Env vars

No new env vars. Guest chat uses the same server LLM keys as desk Q&A.

## Manual test plan

1. **Guest chat**: Open `/`, send 10 messages without signing in → auth modal on message 11.
2. **Build lock (web)**: From `/` or `/desk`, open **+ → Build → Website** → desktop download modal.
3. **Build lock (sidebar)**: On desk, click locked **Build → App** → same modal.
4. **NL build lock**: Type “build a website for my shop” in desk composer (browser) → modal.
5. **Language**: UI stays English; ask in Urdu → reply in Urdu.
6. **Desktop build**: In Electron, pick Website, allow folder, confirm files on disk and completion message in thread.

## Follow-ups

- Persist guest message counts in Postgres for cross-device limits.
- Wire local builder to full agent loop (multi-file edits, dev server) instead of first scaffold only.
- Inject `x-cinem-client: desktop` on all desk fetches from Electron preload for stricter server pairing.
