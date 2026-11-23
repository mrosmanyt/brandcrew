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
  SITE_PROJECT_CAPS,
  SITE_TEMPLATES,
  isReservedSiteSlug,
  isValidSiteSlug,
  pickSiteSlug,
  publishedSitePath,
  publishedSiteUrl,
  siteProjectCapForPlan,
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

console.log("check-site-builder: all assertions passed");
