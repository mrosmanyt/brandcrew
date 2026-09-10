/**
 * Agency-first Composio catalog. CINEM Pro does not hand-roll 93 apps.
 * Connect goes through Composio. Missing COMPOSIO_API_KEY → disconnected.
 */

export type ComposioToolkitAuth = "oauth" | "api_key";

export type ComposioToolkitDef = {
  /** Marketplace plugin id: composio-<slug> */
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  featured: boolean;
  auth: ComposioToolkitAuth;
  letter: string;
  color: string;
  /** Read-only probe used after Connect to prove the first connector path. */
  probeTool: string;
  writeTools?: string[];
  docsUrl: string;
};

/** Outreach / CRM / SEO connectors agencies actually ask for. Not 93 hand-rolled OAuth apps. */
export const COMPOSIO_AGENCY_TOOLKITS: ComposioToolkitDef[] = [
  {
    id: "composio-gmail",
    slug: "gmail",
    name: "Gmail (Composio)",
    description:
      "Read mailbox profile / list mail via Composio. Native CINEM Pro Gmail plugin stays for drafts. Connected only after Composio returns ACTIVE.",
    category: "Outreach",
    featured: true,
    auth: "oauth",
    letter: "GM",
    color: "#ea4335",
    probeTool: "GMAIL_GET_PROFILE",
    writeTools: ["GMAIL_SEND_EMAIL", "GMAIL_CREATE_EMAIL_DRAFT"],
    docsUrl: "https://docs.composio.dev/toolkits/gmail",
  },
  {
    id: "composio-hackernews",
    slug: "hackernews",
    name: "Hacker News",
    description:
      "No-auth read via Composio. First tool-call proof when Gmail is not Connected yet. Does not invent stories.",
    category: "Data & Analytics",
    featured: true,
    auth: "oauth",
    letter: "HN",
    color: "#ff6600",
    probeTool: "HACKERNEWS_GET_USER",
    docsUrl: "https://docs.composio.dev/toolkits/hackernews",
  },
  {
    id: "composio-hubspot",
    slug: "hubspot",
    name: "HubSpot",
    description:
      "CRM via Composio. List contacts after Connect. Writes wait for approval. Connected only after Composio returns an ACTIVE account.",
    category: "CRM",
    featured: true,
    auth: "oauth",
    letter: "HS",
    color: "#ff7a59",
    probeTool: "HUBSPOT_LIST_CONTACTS",
    writeTools: ["HUBSPOT_CREATE_CONTACT", "HUBSPOT_UPDATE_CONTACT"],
    docsUrl: "https://docs.composio.dev/toolkits/hubspot",
  },
  {
    id: "composio-pipedrive",
    slug: "pipedrive",
    name: "Pipedrive",
    description: "Pipeline CRM via Composio. Does not invent deals. Connected only after a real Composio account.",
    category: "CRM",
    featured: true,
    auth: "oauth",
    letter: "PD",
    color: "#017737",
    probeTool: "PIPEDRIVE_GET_DEALS",
    docsUrl: "https://docs.composio.dev/toolkits/pipedrive",
  },
  {
    id: "composio-salesforce",
    slug: "salesforce",
    name: "Salesforce",
    description: "Salesforce via Composio. Read-only probes; writes pause. Never fakes Connected.",
    category: "CRM",
    featured: false,
    auth: "oauth",
    letter: "SF",
    color: "#00a1e0",
    probeTool: "SALESFORCE_QUERY",
    docsUrl: "https://docs.composio.dev/toolkits/salesforce",
  },
  {
    id: "composio-apollo",
    slug: "apollo",
    name: "Apollo",
    description:
      "Prospect data via Composio. CINEM Pro still does not invent emails or auto-send outreach.",
    category: "Outreach",
    featured: true,
    auth: "api_key",
    letter: "AP",
    color: "#7c3aed",
    probeTool: "APOLLO_SEARCH_PEOPLE",
    docsUrl: "https://docs.composio.dev/toolkits/apollo",
  },
  {
    id: "composio-instantly",
    slug: "instantly",
    name: "Instantly",
    description: "Sequence drafts via Composio. Does not send campaigns until you approve outside CINEM Pro.",
    category: "Outreach",
    featured: true,
    auth: "api_key",
    letter: "IN",
    color: "#111827",
    probeTool: "INSTANTLY_LIST_CAMPAIGNS",
    docsUrl: "https://docs.composio.dev/toolkits/instantly",
  },
  {
    id: "composio-ahrefs",
    slug: "ahrefs",
    name: "Ahrefs",
    description: "SEO metrics via Composio for client SEO briefs. Missing key stays disconnected.",
    category: "SEO",
    featured: true,
    auth: "api_key",
    letter: "AH",
    color: "#ff8c00",
    probeTool: "AHREFS_SITE_EXPLORER",
    docsUrl: "https://docs.composio.dev/toolkits/ahrefs",
  },
  {
    id: "composio-semrush",
    slug: "semrush",
    name: "Semrush",
    description: "Keyword / competitor SEO via Composio. Used by the SEO brief playbook when Connected.",
    category: "SEO",
    featured: false,
    auth: "api_key",
    letter: "SE",
    color: "#ff622d",
    probeTool: "SEMRUSH_DOMAIN_OVERVIEW",
    docsUrl: "https://docs.composio.dev/toolkits/semrush",
  },
  {
    id: "composio-calendly",
    slug: "calendly",
    name: "Calendly",
    description: "List event types via Composio. Does not book meetings for the client.",
    category: "Productivity",
    featured: false,
    auth: "oauth",
    letter: "CL",
    color: "#006bff",
    probeTool: "CALENDLY_LIST_EVENT_TYPES",
    docsUrl: "https://docs.composio.dev/toolkits/calendly",
  },
  {
    id: "composio-mailchimp",
    slug: "mailchimp",
    name: "Mailchimp",
    description: "Audience metadata via Composio. Does not send campaigns from the desk.",
    category: "Outreach",
    featured: false,
    auth: "oauth",
    letter: "MC",
    color: "#ffe01b",
    probeTool: "MAILCHIMP_LIST_AUDIENCES",
    docsUrl: "https://docs.composio.dev/toolkits/mailchimp",
  },
  {
    id: "composio-linkedin",
    slug: "linkedin",
    name: "LinkedIn (Composio)",
    description:
      "Optional LinkedIn connector via Composio. Native CINEM Pro LinkedIn jobs stay draft-only artifacts and never auto-post.",
    category: "Outreach",
    featured: false,
    auth: "oauth",
    letter: "IN",
    color: "#0a66c2",
    probeTool: "LINKEDIN_GET_MY_INFO",
    docsUrl: "https://docs.composio.dev/toolkits/linkedin",
  },
];

export function getComposioToolkit(idOrSlug: string) {
  const key = idOrSlug.trim().toLowerCase();
  return (
    COMPOSIO_AGENCY_TOOLKITS.find(
      (row) => row.id === key || row.slug === key || row.id === `composio-${key}`,
    ) ?? null
  );
}

export function composioPluginId(slug: string) {
  const trimmed = slug.trim().toLowerCase();
  return trimmed.startsWith("composio-") ? trimmed : `composio-${trimmed}`;
}

export function isComposioPluginId(pluginId: string) {
  return pluginId.startsWith("composio-");
}

export function composioUserId(workspaceId: string) {
  return `cinem-ws-${workspaceId}`;
}
