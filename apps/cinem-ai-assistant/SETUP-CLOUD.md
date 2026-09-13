# Cinem AI Assistant — Cloud Backend Setup (Supabase)

Project: `gevhtxmsamqvdiypiwbb` · https://gevhtxmsamqvdiypiwbb.supabase.co

## Step 1 — Create the database (2 minutes)

Open **Supabase Dashboard → SQL Editor → New query**, paste the entire contents of
`supabase/migrations/001_user_management.sql`, and click **Run**.

This creates: `registration_requests`, `profiles`, `licenses`, `activity_logs`,
`admin_config` (default admin login `admin` / `cinem-ai-assistant123`), full RLS lockdown (the anon
key cannot touch any table directly), the complete security-definer RPC API
(signup, device license check, approve/reject, freeze, reset password, revenue,
activity log, dev login, `verify_license`), server-side license key generation,
and realtime publication on requests + activity.

> Why not via MCP: the MCP URL you added uses `read_only=true`, so it can't create
> schema. Connect the Supabase connector I suggested above (with write access) and
> I can run migrations directly next time.

## Step 2 — (Optional) deploy the edge function

```bash
npx supabase functions deploy verify-license --project-ref gevhtxmsamqvdiypiwbb
```

The app itself uses the `verify_license` RPC directly; the edge function exposes the
same check over plain HTTPS for the website or support tooling.

## Step 3 — Wire the app (already done, one install needed)

```bash
cd D:\Cinem AI Assistant
npm install        # restores @supabase/supabase-js
npm run tauri dev  # full restart so .env + capabilities load
```

`.env` already contains your URL + anon key. The app now logs
`[Cinem AI Assistant] user-management backend: CLOUD` on boot.

## How the app connects (final connection code)

`src/lib/db.ts` is the single facade the whole app imports:

```ts
import * as local from "@/lib/localDb";
import * as cloud from "@/lib/cloudDb";

export const BACKEND = cloud.CLOUD_CONFIGURED ? "cloud" : "local";
const impl = cloud.CLOUD_CONFIGURED ? cloud : local;
export const submitRequest = impl.submitRequest;  // … and the rest of the API
```

`src/lib/cloudDb.ts` does all cloud work via RPCs:

```ts
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { persistSession: false }, global: { fetch: tauriHttpFetch } },
);
await supabase.rpc("submit_registration", { p_name, p_email, p_whatsapp, p_country, p_device });
await supabase.rpc("get_device_user", { p_device });           // license check on boot
await supabase.rpc("admin_approve", { p_user, p_pass, p_id }); // admin actions
await supabase.rpc("verify_license", { p_key, p_hwid });       // license verification
```

## Behavior

- Signup → `registration_requests` (pending) → appears in Admin Panel within 3s (poll).
- Approve → creates `profiles` row + `licenses` row with a generated `CINEM-AI-ASSISTANT-XXXX-…` key
  → the user's app unlocks automatically (4s poll).
- Freeze/unfreeze, reset access password, revenue tracking, per-user + global activity
  logs, bulk actions, Developer Mode — all work identically against the cloud.
- Licenses bind to the first hardware id that verifies them.
- **Offline fallback:** blank out the two values in `.env` and rebuild → the app runs on
  the 100% local JSON backend (db-server) again. Same UI, same features.

## Security notes (honest)

- Admin credentials live in the `admin_config` table and are checked inside the RPCs;
  change them in Admin Panel → Settings after first login.
- The anon key in the desktop app is safe to ship (RLS denies all direct table access),
  but anyone with the key can call the public RPCs (`submit_registration`, etc.) —
  acceptable for this product; rate-limit in Supabase if it ever matters.
- Passwords (admin + access) are stored in plain text to mirror the local system's
  trust model. Say the word if you want them hashed (`pgcrypto`).
