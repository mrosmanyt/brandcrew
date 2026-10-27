import { browseNavigate, playwrightEnabled, resolveChromePath } from "../src/lib/browse";
import { closeBrowserSession, sessionClick, sessionExtract, sessionNavigate } from "../src/lib/browser-session";

async function main() {
  console.log("enabled", playwrightEnabled(), "chrome", resolveChromePath());
  const page = await browseNavigate("https://example.com");
  console.log(
    JSON.stringify(
      {
        engine: page.engine,
        ok: page.ok,
        url: page.url,
        excerpt: page.excerpt.slice(0, 160),
        links: page.links.slice(0, 3),
        error: page.error,
      },
      null,
      2,
    ),
  );
  if (page.engine === "playwright") {
    const jobId = "browse-smoke";
    try {
      const nav = await sessionNavigate(jobId, "https://example.com");
      console.log("session_navigate", nav.ok, nav.mode, nav.page?.url);
      const click = await sessionClick(jobId, { selector: "a" });
      console.log("session_click", click.ok, click.mode, click.page?.url || click.error);
      const extracted = await sessionExtract(jobId, { selector: "body" });
      console.log("session_extract", extracted.ok, (extracted.extracted || "").slice(0, 80));
    } finally {
      await closeBrowserSession(jobId);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
