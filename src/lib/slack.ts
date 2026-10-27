import { ClientError } from "@/lib/http";
import type { JobStep } from "@/lib/job-types";
import {
  getOAuthTokens,
  refreshSlackAccessToken,
  type OAuthTokens,
} from "@/lib/plugins";

export type SlackChannel = {
  id: string;
  name: string;
  isPrivate: boolean;
};

export function slackDisconnectedError() {
  return new ClientError(
    "Slack is not connected. Open Marketplace → Plugins and Connect Slack. Connected only after a successful oauth.v2.access exchange.",
    400,
  );
}

export function slackPostAllowed(plan: JobStep[], currentStepId: string): boolean {
  const index = plan.findIndex((step) => step.id === currentStepId);
  const before = index >= 0 ? plan.slice(0, index) : plan;
  return before.some((step) => step.tool === "ask_user" && step.status === "done");
}

export async function slackAccessToken(workspaceId: string): Promise<OAuthTokens> {
  const tokens = await getOAuthTokens(workspaceId, "slack");
  if (!tokens?.accessToken) throw slackDisconnectedError();
  if (tokens.expiresAt && Date.now() + 60_000 >= tokens.expiresAt) {
    return refreshSlackAccessToken(workspaceId, tokens);
  }
  return tokens;
}

async function slackApi<T extends { ok?: boolean; error?: string }>(
  tokens: OAuthTokens,
  method: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json()) as T;
  if (!data.ok) {
    throw new Error(data.error || `Slack ${method} failed.`);
  }
  return data;
}

export async function slackListChannels(workspaceId: string): Promise<SlackChannel[]> {
  const tokens = await slackAccessToken(workspaceId);
  const data = await slackApi<{
    ok?: boolean;
    error?: string;
    channels?: {
      id?: string;
      name?: string;
      is_private?: boolean;
      is_archived?: boolean;
    }[];
  }>(tokens, "conversations.list", {
    types: "public_channel,private_channel",
    exclude_archived: true,
    limit: 50,
  });
  return (data.channels || [])
    .filter((row) => row.id && row.name && !row.is_archived)
    .map((row) => ({
      id: row.id!,
      name: row.name!,
      isPrivate: Boolean(row.is_private),
    }));
}

export async function slackPostMessage(input: {
  workspaceId: string;
  channel: string;
  text: string;
}): Promise<{ channel: string; ts: string }> {
  const tokens = await slackAccessToken(input.workspaceId);
  const channel = input.channel.trim();
  const text = input.text.trim();
  if (!channel) throw new Error("slack_post_message needs a channel id.");
  if (!text) throw new Error("slack_post_message needs message text.");
  const data = await slackApi<{
    ok?: boolean;
    error?: string;
    channel?: string;
    ts?: string;
  }>(tokens, "chat.postMessage", { channel, text });
  return { channel: data.channel || channel, ts: data.ts || "" };
}

export function formatSlackChannels(channels: { id: string; name: string; isPrivate?: boolean }[]) {
  if (!channels.length) return "No channels visible to this Slack bot.";
  return channels
    .map(
      (channel, index) =>
        `${index + 1}. #${channel.name} (${channel.id})${channel.isPrivate ? " private" : ""}`,
    )
    .join("\n");
}
