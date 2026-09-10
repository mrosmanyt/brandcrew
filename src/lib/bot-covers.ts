/** Featured Marketplace bot covers — dark-theme art, not letter placeholders. */

export const BOT_COVER_DIR = "/bots";

const COVERS: Record<string, string> = {
  "bot-main": `${BOT_COVER_DIR}/main.svg`,
  "bot-research": `${BOT_COVER_DIR}/research.svg`,
  "bot-sales": `${BOT_COVER_DIR}/sales.svg`,
  "bot-marketing": `${BOT_COVER_DIR}/marketing.svg`,
  "bot-whatsapp": `${BOT_COVER_DIR}/whatsapp.svg`,
  "bot-content": `${BOT_COVER_DIR}/content.svg`,
  "bot-website": `${BOT_COVER_DIR}/website.svg`,
  "bot-app": `${BOT_COVER_DIR}/app.svg`,
  "bot-manager": `${BOT_COVER_DIR}/manager.svg`,
  "bot-ads": `${BOT_COVER_DIR}/marketing.svg`,
  "bot-finance": `${BOT_COVER_DIR}/manager.svg`,
  "bot-ops": `${BOT_COVER_DIR}/manager.svg`,
  "bot-dev": `${BOT_COVER_DIR}/app.svg`,
  "bot-support": `${BOT_COVER_DIR}/whatsapp.svg`,
};

export function botCoverSrc(id: string) {
  return COVERS[id] || `${BOT_COVER_DIR}/main.svg`;
}

export const FEATURED_BOT_COVER_IDS = [
  "bot-main",
  "bot-research",
  "bot-sales",
  "bot-marketing",
  "bot-whatsapp",
  "bot-content",
  "bot-website",
  "bot-app",
  "bot-manager",
] as const;
