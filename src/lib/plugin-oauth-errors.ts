/**
 * Marketplace plugin OAuth errors (Gmail / Slack / Notion / Google Calendar / Drive).
 * Distinct from Google *user login* (`googleAuthErrorMessage` in google-auth-shared).
 * Never treat a provider error as Connected.
 */

const GOOGLE_PLUGINS = new Set(["gmail", "google-calendar", "google-drive", "calendar", "drive"]);

export const GOOGLE_TESTING_MODE_HINT =
  "This Google Cloud OAuth app is in Testing (unverified). Add this Gmail address as a Test user under Google Cloud → APIs & Services → OAuth consent screen → Test users, or publish the app to Production. CINEM Pro does not mark the plugin Connected unless Google returns tokens.";

const UNVERIFIED_RE =
  /verification|unverified|access blocked|has not completed|testing mode|error 403|403:?\s*access_denied|access_denied/i;

export function isGoogleMarketplacePlugin(pluginId?: string | null): boolean {
  const id = String(pluginId || "")
    .trim()
    .toLowerCase();
  return GOOGLE_PLUGINS.has(id);
}

export function isGoogleOAuthUnverifiedDescription(description?: string | null): boolean {
  const text = String(description || "").trim();
  if (!text) return false;
  return /verification|unverified|access blocked|has not completed|testing[\s-]?mode|error 403/i.test(
    text,
  );
}

/** Map Google/Slack callback `error` + `error_description` to a short UI code. */
export function mapPluginOAuthError(input: {
  error: string;
  errorDescription?: string | null;
  pluginId?: string | null;
}): string {
  const error = String(input.error || "").trim() || "oauth_failed";
  const description = String(input.errorDescription || "").trim();
  if (isGoogleOAuthUnverifiedDescription(description)) {
    return "google_unverified";
  }
  if (error === "access_denied" && isGoogleMarketplacePlugin(input.pluginId)) {
    // Google Testing apps often return only access_denied (no useful description).
    return "google_unverified";
  }
  if (UNVERIFIED_RE.test(error) && isGoogleMarketplacePlugin(input.pluginId)) {
    return "google_unverified";
  }
  return error;
}

export function pluginOAuthErrorMessage(
  code: string | null | undefined,
  pluginId?: string | null,
): string {
  const error = String(code || "").trim();
  if (!error) {
    return "OAuth did not finish. Not marked Connected.";
  }
  if (error === "composio_not_configured") {
    return "Set COMPOSIO_API_KEY on the server. Connect stays disconnected — CINEM Pro does not fake Connected.";
  }
  if (
    error === "composio_no_redirect" ||
    error === "composio_failed" ||
    error === "composio_not_active" ||
    error === "composio_missing_account"
  ) {
    return "COMPOSIO_API_KEY is set, but Composio did not finish Connect. Not marked Connected. Try Connect again.";
  }
  if (error === "oauth_not_configured") {
    return pluginId
      ? `${pluginId}: OAuth client id/secret missing. Connect stays disconnected.`
      : "OAuth is not configured on the server. Connect stays disconnected.";
  }
  if (error === "missing_code") {
    return "The provider did not return an authorization code. Not marked Connected.";
  }
  if (error === "unknown_plugin") {
    return "Unknown plugin. Not marked Connected.";
  }
  if (error === "forbidden") {
    return "You do not have access to this workspace. Not marked Connected.";
  }
  if (error === "google_unverified") {
    return `Google blocked access (Access blocked / access_denied). ${GOOGLE_TESTING_MODE_HINT} If you cancelled the consent screen, try Connect again.`;
  }
  if (error === "access_denied") {
    if (isGoogleMarketplacePlugin(pluginId)) {
      return pluginOAuthErrorMessage("google_unverified", pluginId);
    }
    return "OAuth was cancelled or denied. Not marked Connected.";
  }
  if (error === "oauth_failed") {
    return "OAuth failed during token exchange. Not marked Connected.";
  }
  return `OAuth did not finish (${error}). Not marked Connected.`;
}
