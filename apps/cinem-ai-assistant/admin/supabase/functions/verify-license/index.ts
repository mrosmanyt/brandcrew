// ════════════════════════════════════════════════════════════════════
// Cinem AI Assistant — verify-license edge function (Supabase / Deno)
// Called by the desktop app's activation screen. Validates a key, binds it
// to the device's hardware id on first use, and enforces expiry.
//
// Deploy: supabase functions deploy verify-license --no-verify-jwt
// POST { key, hardware_id } → { ok, status, plan, expires_at, message }
// ════════════════════════════════════════════════════════════════════
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { key, hardware_id } = await req.json();
    if (!key || !hardware_id) {
      return json({ ok: false, message: "Missing key or hardware_id." }, 400);
    }

    // Service-role client — bypasses RLS inside the trusted function.
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: lic } = await admin
      .from("licenses")
      .select("*")
      .eq("key", key)
      .maybeSingle();

    if (!lic) return json({ ok: false, message: "Invalid license key." });
    if (lic.status === "revoked") return json({ ok: false, message: "License revoked." });

    // Expiry check
    if (lic.expires_at && new Date(lic.expires_at) < new Date()) {
      await admin.from("licenses").update({ status: "expired" }).eq("id", lic.id);
      return json({ ok: false, status: "expired", message: "License expired." });
    }

    // Device binding — first activation binds the hardware id.
    if (!lic.hardware_id) {
      await admin
        .from("licenses")
        .update({ hardware_id, status: "active" })
        .eq("id", lic.id);
    } else if (lic.hardware_id !== hardware_id) {
      return json({ ok: false, message: "License already bound to another device." });
    }

    return json({
      ok: true,
      status: "active",
      plan: lic.plan,
      expires_at: lic.expires_at,
      message: "License activated.",
    });
  } catch (e) {
    return json({ ok: false, message: `Server error: ${e}` }, 500);
  }
});
