/**
 * Admin HQ bridge to Cinem AI Assistant registration_requests (Supabase).
 * Service-role only — never expose to the browser.
 */

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminEnabled } from "@/lib/supabase/env";

export type AssistantRegistrationRow = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  country: string;
  status: "pending" | "approved" | "rejected";
  deviceId: string | null;
  requestedAt: string;
  decidedAt: string | null;
  licenseKey: string | null;
};

type DbRow = {
  id: string;
  name: string;
  email: string;
  whatsapp: string;
  country: string;
  status: string;
  device_id: string | null;
  requested_at: string;
  decided_at: string | null;
};

function serializeRow(
  row: DbRow,
  licenseKey: string | null = null,
): AssistantRegistrationRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    whatsapp: row.whatsapp || "",
    country: row.country || "",
    status: row.status as AssistantRegistrationRow["status"],
    deviceId: row.device_id,
    requestedAt: row.requested_at,
    decidedAt: row.decided_at,
    licenseKey,
  };
}

function genLicenseKey() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const block = () =>
    Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `Cinem AI Assistant-${block()}-${block()}-${block()}`;
}

export function assistantRegistrationAdminConfigured() {
  return isSupabaseAdminEnabled();
}

export async function listAssistantRegistrations(input?: {
  status?: "pending" | "approved" | "rejected" | "all";
}): Promise<{ configured: boolean; rows: AssistantRegistrationRow[] }> {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { configured: false, rows: [] };
  }

  let query = supabase
    .from("registration_requests")
    .select(
      "id,name,email,whatsapp,country,status,device_id,requested_at,decided_at",
    )
    .order("requested_at", { ascending: false })
    .limit(200);

  const status = input?.status;
  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }

  const rows = (data as DbRow[]) || [];
  const approvedIds = rows.filter((r) => r.status === "approved").map((r) => r.id);
  const licenseByRequest = new Map<string, string>();

  if (approvedIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,request_id")
      .in("request_id", approvedIds);
    const profileIds = (profiles || []).map((p) => p.id as string);
    const requestByProfile = new Map(
      (profiles || []).map((p) => [p.id as string, p.request_id as string]),
    );
    if (profileIds.length) {
      const { data: licenses } = await supabase
        .from("licenses")
        .select("profile_id,key")
        .in("profile_id", profileIds);
      for (const lic of licenses || []) {
        const requestId = requestByProfile.get(lic.profile_id as string);
        if (requestId) licenseByRequest.set(requestId, lic.key as string);
      }
    }
  }

  return {
    configured: true,
    rows: rows.map((row) => serializeRow(row, licenseByRequest.get(row.id) ?? null)),
  };
}

export async function approveAssistantRegistration(requestId: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin is not configured.");
  }

  const { data: request, error: fetchError } = await supabase
    .from("registration_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!request) throw new Error("Registration request not found.");

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("registration_requests")
    .update({ status: "approved", decided_at: now })
    .eq("id", requestId);
  if (updateError) throw new Error(updateError.message);

  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("request_id", requestId)
    .maybeSingle();

  let profileId = existingProfile?.id as string | undefined;
  if (!profileId) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        request_id: requestId,
        name: request.name,
        email: request.email,
        whatsapp: request.whatsapp || "",
        country: request.country || "",
      })
      .select("id")
      .single();
    if (profileError) throw new Error(profileError.message);
    profileId = profile.id as string;
  } else {
    await supabase.from("profiles").update({ frozen: false }).eq("id", profileId);
  }

  const licenseKey = genLicenseKey();
  const { error: licenseError } = await supabase.from("licenses").upsert(
    {
      profile_id: profileId,
      key: licenseKey,
      status: "active",
      plan: "lifetime",
    },
    { onConflict: "profile_id" },
  );
  if (licenseError) throw new Error(licenseError.message);

  await supabase.from("activity_logs").insert({
    subject_id: requestId,
    subject_name: request.name,
    type: "admin",
    text: `Approved ${request.email} via Admin HQ`,
  });

  return serializeRow(request as DbRow, licenseKey);
}

export async function rejectAssistantRegistration(requestId: string) {
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    throw new Error("Supabase admin is not configured.");
  }

  const { data: request, error: fetchError } = await supabase
    .from("registration_requests")
    .select("*")
    .eq("id", requestId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!request) throw new Error("Registration request not found.");

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("registration_requests")
    .update({ status: "rejected", decided_at: now })
    .eq("id", requestId);
  if (updateError) throw new Error(updateError.message);

  await supabase.from("profiles").delete().eq("request_id", requestId);

  await supabase.from("activity_logs").insert({
    subject_id: requestId,
    subject_name: request.name,
    type: "admin",
    text: `Rejected ${request.email} via Admin HQ`,
  });

  return serializeRow(request as DbRow, null);
}
