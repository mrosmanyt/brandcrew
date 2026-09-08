import { ClientError } from "@/lib/http";
import {
  getOAuthTokens,
  refreshGoogleAccessToken,
  type OAuthTokens,
} from "@/lib/plugins";

export type GmailHeaderMessage = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  date: string;
};

export function gmailDisconnectedError() {
  return new ClientError(
    "Gmail is not connected. Open Marketplace → Plugins and Connect Gmail (Google OAuth). Connected only after a successful token exchange.",
    400,
  );
}

export async function gmailAccessToken(workspaceId: string): Promise<OAuthTokens> {
  const tokens = await getOAuthTokens(workspaceId, "gmail");
  if (!tokens?.accessToken) throw gmailDisconnectedError();
  if (tokenExpired(tokens)) {
    return refreshGoogleAccessToken(workspaceId, "gmail", tokens);
  }
  return tokens;
}

export function tokenExpired(tokens: OAuthTokens, skewMs = 60_000) {
  if (!tokens.expiresAt) return false;
  return Date.now() + skewMs >= tokens.expiresAt;
}

function header(headers: { name?: string; value?: string }[] | undefined, name: string) {
  const found = headers?.find((row) => row.name?.toLowerCase() === name.toLowerCase());
  return found?.value?.trim() || "";
}

export async function gmailListRecent(input: {
  workspaceId: string;
  max?: number;
  query?: string;
}): Promise<GmailHeaderMessage[]> {
  const tokens = await gmailAccessToken(input.workspaceId);
  const max = Math.min(Math.max(input.max ?? 8, 1), 20);
  const params = new URLSearchParams({
    maxResults: String(max),
  });
  const query = input.query?.trim();
  if (query) {
    params.set("q", query);
  } else {
    params.set("labelIds", "INBOX");
  }
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params.toString()}`,
    { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
  );
  const list = (await listRes.json()) as {
    error?: { message?: string };
    messages?: { id: string; threadId: string }[];
  };
  if (!listRes.ok) {
    throw new Error(list.error?.message || `Gmail list failed (${listRes.status}).`);
  }
  const rows = list.messages || [];
  const out: GmailHeaderMessage[] = [];
  for (const row of rows) {
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${row.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
      { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
    );
    const msg = (await msgRes.json()) as {
      id?: string;
      threadId?: string;
      payload?: { headers?: { name?: string; value?: string }[] };
      error?: { message?: string };
    };
    if (!msgRes.ok) continue;
    out.push({
      id: msg.id || row.id,
      threadId: msg.threadId || row.threadId,
      from: header(msg.payload?.headers, "From"),
      subject: header(msg.payload?.headers, "Subject") || "(no subject)",
      date: header(msg.payload?.headers, "Date"),
    });
  }
  return out;
}

export function rfc2822Raw(input: { to: string; subject: string; body: string }) {
  const lines = [
    `To: ${input.to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    input.body,
  ];
  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function gmailCreateDraft(input: {
  workspaceId: string;
  to: string;
  subject: string;
  body: string;
}): Promise<{ id: string; to: string; subject: string }> {
  const tokens = await gmailAccessToken(input.workspaceId);
  const to = input.to.trim();
  const subject = input.subject.trim() || "(no subject)";
  const body = input.body.trim();
  if (!to) throw new Error("gmail_create_draft needs a To address.");
  if (!body) throw new Error("gmail_create_draft needs a message body.");
  const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: { raw: rfc2822Raw({ to, subject, body }) },
    }),
  });
  const data = (await res.json()) as { id?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(data.error?.message || `Gmail draft failed (${res.status}).`);
  }
  return { id: data.id, to, subject };
}

export function formatGmailList(messages: { from: string; subject: string; date: string }[]) {
  if (!messages.length) return "No recent inbox messages.";
  return messages
    .map(
      (msg, index) =>
        `${index + 1}. ${msg.date || "(date ?)"} — ${msg.from || "(unknown)"}\n   ${msg.subject}`,
    )
    .join("\n");
}
