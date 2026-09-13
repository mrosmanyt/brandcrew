// ════════════════════════════════════════════════════════════════════
// Cinem AI Assistant — admin-create-user edge function (Supabase / Deno)
// Lets an authenticated ADMIN create a user with email + password directly.
//
// Security: validates the caller's JWT and confirms their profile.role = 'admin'
// before using the service-role key to create the auth user. A DB trigger
// then auto-creates the profile from user_metadata.
//
// Deploy WITHOUT the platform JWT gate (we authenticate inside the function,
// and the gate can interfere with the browser CORS preflight):
//     supabase functions deploy admin-create-user --no-verify-jwt
//
// POST { name, email, whatsapp, country, password }
//   header: Authorization: Bearer <admin access token>
// ════════════════════════════════════════════════════════════════════
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// IMPORTANT: include every header supabase-js sends, or the browser preflight
// fails with "Failed to send a request to the Edge Function".
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  // CORS preflight — must succeed with the headers above.
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env.");
      return json({ ok: false, message: "Server misconfigured (missing service key)." }, 500);
    }

    // Service-role client — bypasses RLS, can use the Admin API.
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Identify the caller from the Bearer token (validate via Admin API).
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      console.warn("No bearer token supplied.");
      return json({ ok: false, message: "Not authenticated (no token)." }, 401);
    }

    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.warn("getUser failed:", userErr?.message);
      return json({ ok: false, message: "Invalid or expired session." }, 401);
    }

    // 2) Confirm the caller is an admin.
    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (profErr) {
      console.error("Profile lookup error:", profErr.message);
      return json({ ok: false, message: `Profile lookup failed: ${profErr.message}` }, 500);
    }
    if (prof?.role !== "admin") {
      console.warn("Non-admin attempted create-user:", userData.user.email);
      return json({ ok: false, message: "Admin access required." }, 403);
    }

    // 3) Validate input.
    let payload: { name?: string; email?: string; whatsapp?: string; country?: string; password?: string };
    try {
      payload = await req.json();
    } catch {
      return json({ ok: false, message: "Invalid JSON body." }, 400);
    }
    const { name = "", email = "", whatsapp = "", country = "", password = "" } = payload;
    if (!email || !password) {
      return json({ ok: false, message: "Email and password are required." }, 400);
    }
    if (password.length < 6) {
      return json({ ok: false, message: "Password must be at least 6 characters." }, 400);
    }

    // 4) Create the user (the trigger creates the profile from metadata).
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip the confirmation email
      user_metadata: { name, whatsapp, country },
    });
    if (createErr) {
      console.error("createUser error:", createErr.message);
      return json({ ok: false, message: createErr.message }, 400);
    }

    console.log("Created user:", created.user?.email);
    return json({ ok: true, id: created.user?.id, message: "User created." });
  } catch (e) {
    console.error("Unhandled error:", e);
    return json({ ok: false, message: `Server error: ${e instanceof Error ? e.message : e}` }, 500);
  }
});
