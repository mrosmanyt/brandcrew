# console.cinem.tech — DNS + Vercel

The developer console is the same Next.js app, not a second Vercel project.

- **Customer nav (live):** same-origin `/console`. Desk sidebar and Settings always use this. Do not send buyers to `console.cinem.tech` until that host is Valid and serving this app.
- **Optional custom host:** `https://console.cinem.tech` — `src/proxy.ts` rewrites `/` on that host to `/console` and requires a signed-in session. The domain is **not** wired for customer links today.

## Founder checklist

1. In **Vercel → Project → Settings → Domains**, add `console.cinem.tech`.
2. At the DNS host for `cinem.tech`, create the record Vercel shows (usually `CNAME` → `cname.vercel-dns.com`, or an A record if they ask for it).
3. Wait until the domain shows **Valid** in Vercel (HTTPS is automatic).
4. Set production env:
   - `NEXT_PUBLIC_CONSOLE_URL=https://console.cinem.tech`
   - Optional: `COOKIE_DOMAIN=.cinem.tech` so the session cookie is shared with the console (production desk is `app.cinem.tech`). Do **not** set this while testing only on `*.vercel.app` — the cookie would not stick.
5. Add `https://console.cinem.tech` to Google OAuth **Authorized JavaScript origins**, and keep the existing callback URIs (`/api/auth/google/callback`).
6. Redeploy. Customer **API Console** links stay on same-origin `/console` even after the domain is Valid — flip `consoleAppHref` only when the host is proven live. Old `/desk/…/developers` URLs redirect to `/console?workspace=…`.

Desk sidebar and Settings must not point at `console.cinem.tech` while that host fails.
