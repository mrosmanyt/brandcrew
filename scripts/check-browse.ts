import { browseNavigate, playwrightEnabled, resolveChromePath } from "../src/lib/browse";

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
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
