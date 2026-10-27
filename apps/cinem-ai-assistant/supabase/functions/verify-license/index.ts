/**
 * Cinem AI Assistant — verify-license edge function.
 *
 * Wraps the `verify_license` SQL RPC so license checks can also be done by
 * external tools (website, support scripts) with a plain HTTPS POST:
 *
 *   POST https://gevhtxmsamqvdiypiwbb.supabase.co/functions/v1/verify-license
 *   Authorization: Bearer <anon key>
 *   { "key": "CINEM-AI-ASSISTANT-XXXX-XXXX-XXXX", "hardware_id": "HWID-..." }
 *
 * → { ok: boolean, status?: "active"|"expired", plan?: string,
 *     expires_at?: string|null, message: string }
 *
 * Deploy:  supabase functions deploy verify-license --project-ref gevhtxmsamqvdiypiwbb
 */
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const { key, hardware_id } = await req.json();
    if (!key || !hardware_id) {
      return Response.json(
        { ok: false, message: "key and hardware_id are required" },
        { status: 400, headers: CORS },
      );
    }

    // Service role: the RPC is security-definer anyway, but this keeps the
    // function independent of anon grants.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase.rpc("verify_license", {
      p_key: String(key),
      p_hwid: String(hardware_id),
    });
    if (error) throw error;

    return Response.json(data, { headers: CORS });
  } catch (e) {
    return Response.json(
      { ok: false, message: e instanceof Error ? e.message : String(e) },
      { status: 500, headers: CORS },
    );
  }
});
