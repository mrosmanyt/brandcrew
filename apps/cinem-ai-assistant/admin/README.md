# Cinem AI Assistant ADMIN

Licensing & user-management control center for the Cinem AI Assistant desktop app — same
cyberpunk neon/glass theme. React 19 + TypeScript + Tailwind v4 + Zustand +
Supabase.

## Quick start (demo mode — no backend needed)

```bash
cd D:\Cinem AI Assistant\admin
npm install
npm run dev          # http://localhost:1430
```

Without Supabase env vars it runs in **DEMO MODE** with realistic sample data,
so you can explore every screen immediately.

## Connect the real backend (Supabase)

1. Create a project at https://supabase.com.
2. SQL Editor → run `supabase/schema.sql` (tables, enums, RLS, expiry job).
3. Deploy the license verifier:
   ```bash
   supabase functions deploy verify-license --no-verify-jwt
   ```
4. Env vars live in `.env.local` (Vite reads `VITE_`-prefixed names):
   ```env
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon or publishable key>
   ```
   Restart `npm run dev` after editing.

### Admin login is required in live mode

The RLS policies grant table access to the **authenticated** role only — the
public anon key cannot read `app_users` / `licenses` on its own (that's the
point: your customer data isn't exposed through the public key). So the panel
shows a **sign-in screen** in live mode.

Create your admin account once:
**Supabase dashboard → Authentication → Users → Add user** (email + password,
"Auto Confirm" on). Then sign in at the panel. Sign-out is in the sidebar.

> For multi-admin or stricter control, add an `is_admin` flag and tighten the
> RLS `using (...)` clauses to check it. Current policies treat any
> authenticated account as an admin.

## Features

- **Dashboard** — Total Users, Active Users, Revenue, Commands Today; commands-by-agent bar chart; recent activity.
- **Users** — searchable, status-filtered table (Name, Email, WhatsApp, Country, Status, Joined, Last Active). Freeze/Unfreeze, Blacklist/Suspend, and a slide-over **Usage Analytics** panel per user (commands used, most-used agents).
- **Licenses** — key generator (lifetime one-time / monthly / yearly subscription with auto-expiry), assign-to-email, copy, revoke. Keys formatted `CINEM-AI-ASSISTANT-XXXX-XXXX-XXXX-XXXX`.
- **Requests** — approve/decline onboarding requests; approving auto-creates the user, generates a license key, and offers an Email-key action.
- **Usage Logs** — searchable per-command analytics stream.

## How licensing fits together

```
Desktop app (first launch)
  └─ Registration form (Name/Email/WhatsApp/Country)
        └─→ insert into registration_requests   (anon RLS policy)
Admin → Requests → Approve
  └─ create app_user + generate license key → send to user
Desktop app (activation screen)
  └─ POST verify-license { key, hardware_id }
        ├─ invalid / revoked / expired → blocked
        ├─ first use → bind hardware_id, status=active
        └─ bound to another device → blocked
```

Device binding, subscription expiry and one-time (lifetime) plans are all
enforced in `supabase/functions/verify-license`.

## Structure

```
admin/
├── supabase/
│   ├── schema.sql                     # full DB schema + RLS + expiry fn
│   └── functions/verify-license/      # edge function (device binding, expiry)
└── src/
    ├── App.tsx                        # sidebar shell + routing
    ├── lib/    supabase, types, demoData, utils (key generator)
    ├── store/  useAdminStore          # Supabase ⇄ demo façade
    ├── components/ ui.tsx             # Panel, StatusBadge, Button
    └── pages/  Dashboard, UsersPage, LicensesPage, RequestsPage, LogsPage
```

> Security note: the admin panel must sit behind authentication before going
> live (add Supabase Auth + an `is_admin` check). The included RLS policies
> already restrict anon clients to only submitting registration requests.
