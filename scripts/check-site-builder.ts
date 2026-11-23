/**
 * Website builder (Package 11b) pure logic: plan project caps, template
 * set, and the builder preview sanitizer (inline interactivity allowed,
 * external code stripped). No database, no LLM calls.
 */
import assert from "node:assert/strict";
import {
  sanitizeBuilderPreviewHtml,
  sanitizePreviewHtml,
} from "../src/lib/html-preview";
import {
  SITE_ASSET_MAX_BYTES,
  SITE_PROJECT_CAPS,
  SITE_TEMPLATES,
  applyWhatsAppButton,
  base64ByteSize,
  buildMultiPageDocument,
  detectWhatsAppToggle,
  isSiteLanguage,
  normalizeWhatsAppNumber,
  parseSiteProducts,
  productOrderLink,
  buildPreviewShellHtml,
  injectPreviewNav,
  isReservedSiteSlug,
  isValidSiteSlug,
  normalizeSitePagePath,
  parseMultiPageOutput,
  pickSiteSlug,
  previewNavScript,
  publishedSitePath,
  publishedSiteUrl,
  rewriteSiteLinks,
  serializeSiteProducts,
  siteAssetUrl,
  siteAssetValidationError,
  siteLanguagePromptBlock,
  siteProductsPromptBlock,
  siteProjectCapForPlan,
  whatsAppLink,
  siteSlugFromHost,
  siteTemplateById,
  slugifySiteTitle,
} from "../src/lib/site-builder-pure";

// --- Project caps per plan (design note §6; prices untouched) ---
assert.equal(siteProjectCapForPlan("demo"), 1);
assert.equal(siteProjectCapForPlan("starter"), 3);
assert.equal(siteProjectCapForPlan("pro"), 10);
assert.equal(siteProjectCapForPlan("growth"), 10);
assert.equal(siteProjectCapForPlan("ultra"), 25);
assert.equal(siteProjectCapForPlan(null), 1);
assert.equal(siteProjectCapForPlan("nope"), 1);
assert.deepEqual(SITE_PROJECT_CAPS, { demo: 1, starter: 3, pro: 10, ultra: 25 });

// --- Templates: the broad Lovable/Replit-mirroring gallery + blank ---
assert.deepEqual(
  SITE_TEMPLATES.map((row) => row.id),
  [
    "restaurant",
    "salon",
    "shop",
    "hotel",
    "portfolio",
    "real-estate",
    "clinic",
    "gym",
    "agency",
    "saas",
    "wedding",
    "blog",
    "photography",
    "law",
    "cafe",
    "blank",
  ],
);
for (const template of SITE_TEMPLATES) {
  if (template.id === "blank") {
    assert.equal(template.starterPrompt, "");
    assert.equal(template.designDirection, "");
  } else {
    assert.ok(template.starterPrompt.length > 40, `${template.id} starter prompt`);
    assert.ok(
      template.designDirection.length > 40,
      `${template.id} design direction`,
    );
    assert.ok(template.label.length > 0);
    assert.ok(template.blurb.length > 0);
    assert.ok(template.defaultTitle.length > 0);
  }
}
assert.equal(siteTemplateById("salon").id, "salon");
assert.equal(siteTemplateById("real-estate").id, "real-estate");
assert.equal(siteTemplateById("unknown").id, "blank");
assert.equal(siteTemplateById(null).id, "blank");

// --- Builder sanitizer: inline interactivity survives ---
const page = `<!DOCTYPE html><html><head><title>Cafe</title>
<script src="https://evil.example/track.js"></script>
<meta http-equiv="refresh" content="0;url=https://evil.example">
</head><body>
<button onclick="document.getElementById('menu').classList.toggle('open')">Menu</button>
<div id="menu"><a href="javascript:alert(1)">x</a></div>
<iframe src="https://evil.example"></iframe>
<script>document.title = 'Cafe — open';</script>
</body></html>`;

const cleaned = sanitizeBuilderPreviewHtml(page);
assert.ok(cleaned.includes("<script>document.title"), "inline script kept");
assert.ok(cleaned.includes('onclick="document.getElementById'), "inline handler kept");
assert.ok(!cleaned.includes("evil.example/track.js"), "external script stripped");
assert.ok(!cleaned.includes("<iframe"), "iframe stripped");
assert.ok(!cleaned.includes("http-equiv=\"refresh\""), "meta refresh stripped");
assert.ok(!cleaned.includes("javascript:"), "javascript: URLs stripped");

// --- The desk preview sanitizer is unchanged: it still strips everything ---
const deskCleaned = sanitizePreviewHtml(page);
assert.ok(!deskCleaned.includes("<script"), "desk sanitizer still strips all scripts");
assert.ok(!deskCleaned.includes("onclick"), "desk sanitizer still strips handlers");

// --- Publishing slugs (Package 11d) ---
assert.equal(slugifySiteTitle("Green Leaf Salon"), "green-leaf-salon");
assert.equal(slugifySiteTitle("Café Délice!"), "cafe-delice");
assert.equal(slugifySiteTitle("  My   Shop -- 2026  "), "my-shop-2026");
assert.equal(slugifySiteTitle("12345"), "");
assert.equal(slugifySiteTitle("!!!"), "");
assert.equal(slugifySiteTitle("A"), "");
assert.ok(slugifySiteTitle("x".repeat(80)).length <= 40);
assert.equal(isValidSiteSlug("green-leaf-salon"), true);
assert.equal(isValidSiteSlug("app"), false);
assert.equal(isValidSiteSlug("-lead"), false);
assert.equal(isValidSiteSlug("trail-"), false);
assert.equal(isValidSiteSlug("double--dash"), false);
assert.equal(isValidSiteSlug("Upper"), false);
assert.equal(isReservedSiteSlug("console"), true);
assert.equal(isReservedSiteSlug("my-shop"), false);
assert.equal(pickSiteSlug("my-shop", new Set()), "my-shop");
assert.equal(pickSiteSlug("my-shop", new Set(["my-shop"])), "my-shop-2");
assert.equal(
  pickSiteSlug("my-shop", new Set(["my-shop", "my-shop-2"])),
  "my-shop-3",
);
assert.equal(pickSiteSlug("", new Set()), "my-website");
assert.equal(pickSiteSlug("app", new Set()), "app-2");
assert.equal(publishedSiteUrl("my-shop"), "https://my-shop.cinem.tech");
assert.equal(publishedSitePath("my-shop"), "/sites/my-shop");
assert.equal(siteSlugFromHost("my-shop.cinem.tech"), "my-shop");
assert.equal(siteSlugFromHost("my-shop.cinem.tech:443"), "my-shop");
assert.equal(siteSlugFromHost("app.cinem.tech"), null);
assert.equal(siteSlugFromHost("console.cinem.tech"), null);
assert.equal(siteSlugFromHost("cinem.tech"), null);
assert.equal(siteSlugFromHost("www.cinem.tech"), null);
assert.equal(siteSlugFromHost("brandcrew.vercel.app"), null);
assert.equal(siteSlugFromHost(null), null);

// --- Multi-page sites (Package 11c) ---
assert.equal(normalizeSitePagePath("/About/"), "about");
assert.equal(normalizeSitePagePath(""), "");
assert.equal(normalizeSitePagePath("/"), "");
assert.equal(normalizeSitePagePath("menu/lunch"), "menu/lunch");
assert.equal(normalizeSitePagePath("../etc"), null);
assert.equal(normalizeSitePagePath("a b"), null);
assert.equal(normalizeSitePagePath("café"), null);

const multiDoc = [
  '<<<PAGE path="/" title="Home">>>',
  "<!DOCTYPE html><html><head><title>Home</title></head><body>Home page</body></html>",
  '<<<PAGE path="/about" title="About us">>>',
  "<!DOCTYPE html><html><head><title>About</title></head><body>About page</body></html>",
  '<<<PAGE path="/menu">>>',
  "<html><body>Menu page</body></html>",
].join("\n");
const parsed = parseMultiPageOutput(multiDoc);
assert.ok(parsed, "multi-page output parses");
assert.ok(parsed.home.includes("Home page"));
assert.equal(parsed.pages.length, 2);
assert.equal(parsed.pages[0].path, "about");
assert.equal(parsed.pages[0].title, "About us");
assert.equal(parsed.pages[1].path, "menu");
assert.equal(parsed.pages[1].title, "menu");
assert.equal(
  parseMultiPageOutput("<html><body>single</body></html>"),
  null,
  "no markers = single page",
);
assert.equal(
  parseMultiPageOutput('<<<PAGE path="/about">>>\n<html><body>x</body></html>'),
  null,
  "sub-page without a home page is not multi-page",
);
const rebuilt = buildMultiPageDocument(parsed.home, parsed.pages);
const reparsed = parseMultiPageOutput(rebuilt);
assert.ok(reparsed && reparsed.pages.length === 2, "round-trip keeps pages");

const linkPage =
  '<a href="/about">About</a> <a href="/">Home</a> <a href="https://wa.me/123">WA</a> ' +
  '<a href="/unknown">?</a> <a href="#top">top</a> <a href="menu">Menu</a>';
const rewritten = rewriteSiteLinks(
  linkPage,
  (path) => (path ? `/sites/my-shop/${path}` : "/sites/my-shop"),
  new Set(["", "about", "menu"]),
);
assert.ok(rewritten.includes('href="/sites/my-shop/about"'));
assert.ok(rewritten.includes('href="/sites/my-shop"'));
assert.ok(rewritten.includes('href="/sites/my-shop/menu"'));
assert.ok(rewritten.includes('href="https://wa.me/123"'));
assert.ok(rewritten.includes('href="/unknown"'));
assert.ok(rewritten.includes('href="#top"'));

const nav = previewNavScript(["/", "/about"]);
assert.ok(nav.includes('"/about"'));
assert.ok(nav.includes("cinemPage"));
const injected = injectPreviewNav("<html><body>Hi</body></html>", ["/", "/about"]);
assert.ok(injected.includes("cinemPage"));
assert.ok(injected.indexOf("cinemPage") < injected.indexOf("</body>"));

const shell = buildPreviewShellHtml({
  entryPath: "/",
  pages: [
    { path: "/", html: "<html><body>Home</body></html>" },
    { path: "/about", html: "<html><body>About</body></html>" },
  ],
});
assert.ok(shell.includes('id="pg"'));
assert.ok(shell.includes('sandbox="allow-scripts"'));
assert.ok(shell.includes("About"));
assert.ok(shell.includes("cinemGoto"));
assert.ok(!shell.includes("</script>\n\"/about\""), "payload is escaped");

// --- Uploaded photos/logos (Package C) ---
assert.equal(siteAssetUrl("abc123"), "/site-assets/abc123");
assert.equal(base64ByteSize(""), 0);
assert.equal(base64ByteSize("AAAA"), 3);
assert.equal(base64ByteSize("AAA="), 2);
assert.equal(base64ByteSize("AA=="), 1);
assert.equal(
  siteAssetValidationError({ mimeType: "image/png", sizeBytes: 1000 }),
  null,
);
assert.ok(
  siteAssetValidationError({ mimeType: "image/svg+xml", sizeBytes: 1000 }),
);
assert.ok(siteAssetValidationError({ mimeType: "image/png", sizeBytes: 0 }));
assert.ok(
  siteAssetValidationError({
    mimeType: "image/png",
    sizeBytes: SITE_ASSET_MAX_BYTES + 1,
  }),
);

// --- WhatsApp commerce (Package D) ---
assert.equal(normalizeWhatsAppNumber("+92 300 1234567"), "923001234567");
assert.equal(normalizeWhatsAppNumber("0092 300 1234567"), "923001234567");
assert.equal(normalizeWhatsAppNumber("123"), null);
assert.equal(normalizeWhatsAppNumber(""), null);
assert.equal(normalizeWhatsAppNumber(null), null);
assert.equal(whatsAppLink("923001234567"), "https://wa.me/923001234567");
assert.equal(
  whatsAppLink("923001234567", "I want 2 burgers"),
  "https://wa.me/923001234567?text=I%20want%202%20burgers",
);
{
  const page = "<html><body><p>Menu</p></body></html>";
  const withBtn = applyWhatsAppButton(page, {
    number: "923001234567",
    enabled: true,
  });
  assert.ok(withBtn.includes("https://wa.me/923001234567"));
  assert.ok(withBtn.indexOf("wa.me") < withBtn.indexOf("</body>"));
  // Already links to the number → untouched.
  assert.equal(
    applyWhatsAppButton(withBtn, { number: "923001234567", enabled: true }),
    withBtn,
  );
  // Off or no number → untouched.
  assert.equal(
    applyWhatsAppButton(page, { number: "923001234567", enabled: false }),
    page,
  );
  assert.equal(applyWhatsAppButton(page, { number: null, enabled: true }), page);
}
assert.equal(detectWhatsAppToggle("WhatsApp button hata do"), "off");
assert.equal(detectWhatsAppToggle("remove the WhatsApp button please"), "off");
assert.equal(detectWhatsAppToggle("WhatsApp button nahi chahiye"), "off");
assert.equal(detectWhatsAppToggle("WhatsApp button laga do"), "on");
assert.equal(detectWhatsAppToggle("add a WhatsApp order button"), "on");
assert.equal(detectWhatsAppToggle("make the hero section bigger"), null);
assert.equal(detectWhatsAppToggle("WhatsApp number change kar do"), null);

// --- Site language (Package E) ---
assert.equal(isSiteLanguage("ur"), true);
assert.equal(isSiteLanguage("roman-ur"), true);
assert.equal(isSiteLanguage("mixed"), true);
assert.equal(isSiteLanguage("hi"), false);
assert.equal(isSiteLanguage("hindi"), false);
assert.equal(siteLanguagePromptBlock("en"), null);
{
  const ur = siteLanguagePromptBlock("ur");
  assert.ok(ur && ur.includes("Urdu"));
  assert.ok(ur && /never use Hindi/i.test(ur));
  const roman = siteLanguagePromptBlock("roman-ur");
  assert.ok(roman && roman.includes("Roman Urdu"));
  assert.ok(roman && /never use Hindi/i.test(roman));
  const mixed = siteLanguagePromptBlock("mixed");
  assert.ok(mixed && mixed.includes("Roman Urdu"));
}

// --- Shop products (Package F) ---
assert.deepEqual(parseSiteProducts(null), []);
assert.deepEqual(parseSiteProducts("not json"), []);
assert.deepEqual(parseSiteProducts('{"a":1}'), []);
assert.deepEqual(
  parseSiteProducts(
    JSON.stringify([
      { name: "Leather Wallet", price: "Rs 1,499", note: "Free delivery" },
      { name: "  ", price: "Rs 5" },
      { name: "Cap", price: "" },
      "junk",
    ]),
  ),
  [
    { name: "Leather Wallet", price: "Rs 1,499", note: "Free delivery", imageAssetId: undefined },
    { name: "Cap", price: "", imageAssetId: undefined, note: undefined },
  ],
);
assert.equal(
  productOrderLink("923001234567", { name: "Leather Wallet", price: "Rs 1,499" }),
  "https://wa.me/923001234567?text=I%20want%20to%20order%3A%20Leather%20Wallet%20(Rs%201%2C499)",
);
{
  const block = siteProductsPromptBlock({
    products: [
      { name: "Leather Wallet", price: "Rs 1,499", imageAssetId: "asset1" },
    ],
    whatsappNumber: "923001234567",
  });
  assert.ok(block && block.includes("Leather Wallet — Rs 1,499"));
  assert.ok(block && block.includes("/site-assets/asset1"));
  assert.ok(block && block.includes("wa.me/923001234567"));
  assert.ok(block && /No checkout/.test(block));
  assert.equal(
    siteProductsPromptBlock({ products: [], whatsappNumber: "923001234567" }),
    null,
  );
  const noNumber = siteProductsPromptBlock({
    products: [{ name: "Cap", price: "Rs 500" }],
    whatsappNumber: null,
  });
  assert.ok(noNumber && noNumber.includes("contact section"));
}
assert.equal(
  JSON.parse(serializeSiteProducts([{ name: "Cap", price: "Rs 500" }]))[0].name,
  "Cap",
);

console.log("check-site-builder: all assertions passed");
