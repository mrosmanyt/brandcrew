/**
 * Marketplace connector marks. SVGs live in `public/connectors/`.
 * Simple Icons (CC0) plus official-style tiles for brands SI does not ship.
 * Visual only — Connect / OAuth / Composio status is unchanged.
 */

export const CONNECTOR_LOGO_FILES = [
  "ahrefs",
  "apollo",
  "calendly",
  "generic",
  "github",
  "gmail",
  "google-calendar",
  "google-drive",
  "hacker-news",
  "hubspot",
  "instantly",
  "linkedin",
  "mailchimp",
  "notion",
  "pipedrive",
  "salesforce",
  "semrush",
  "slack",
  "stripe",
  "tavily",
  "whatsapp",
] as const;

export type ConnectorLogoFile = (typeof CONNECTOR_LOGO_FILES)[number];

/** Plugin id → file stem under /connectors/*.svg */
export const CONNECTOR_LOGO_BY_PLUGIN_ID: Record<string, ConnectorLogoFile> = {
  "web-search": "tavily",
  gmail: "gmail",
  whatsapp: "whatsapp",
  slack: "slack",
  notion: "notion",
  "google-calendar": "google-calendar",
  "google-drive": "google-drive",
  stripe: "stripe",
  github: "github",
  "composio-gmail": "gmail",
  "composio-hackernews": "hacker-news",
  "composio-hubspot": "hubspot",
  "composio-pipedrive": "pipedrive",
  "composio-salesforce": "salesforce",
  "composio-apollo": "apollo",
  "composio-instantly": "instantly",
  "composio-ahrefs": "ahrefs",
  "composio-semrush": "semrush",
  "composio-calendly": "calendly",
  "composio-mailchimp": "mailchimp",
  "composio-linkedin": "linkedin",
  linkedin: "linkedin",
};

export function connectorLogoFile(pluginId: string): ConnectorLogoFile {
  return CONNECTOR_LOGO_BY_PLUGIN_ID[pluginId] ?? "generic";
}

export function connectorLogoSrc(pluginId: string) {
  return `/connectors/${connectorLogoFile(pluginId)}.svg`;
}
