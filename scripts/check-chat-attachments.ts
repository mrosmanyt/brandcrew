/**
 * Chat attachments + PWA guards: attachment normalization caps, chat content
 * building (text files inlined, media as parts, honest string fallback), and
 * history reconciliation with attachments present. No database, no keys.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import type { ComposerAttachment } from "../src/lib/composer";
import {
  chatContentWithAttachments,
  composerAttachmentsSchema,
  normalizeComposerAttachments,
  toWireAttachments,
} from "../src/lib/composer-media";
import { reconcileChatMessages } from "../src/lib/chat-stream-pure";
import manifest from "../src/app/manifest";

const PNG_DATA = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const imageFile: ComposerAttachment = {
  name: "pup.png",
  size: 68,
  kind: "image",
  mime: "image/png",
  data: PNG_DATA,
};

const textFile: ComposerAttachment = {
  name: "notes.txt",
  size: 11,
  kind: "text",
  mime: "text/plain",
  text: "hello notes",
};

// --- content building ------------------------------------------------------
// Text-only turns keep the exact old wire shape (plain string).
assert.equal(chatContentWithAttachments("hi there", []), "hi there");
assert.equal(chatContentWithAttachments("hi there", undefined), "hi there");

// A text file is inlined so the model can actually read it.
const withText = chatContentWithAttachments("summarize this", [textFile]);
assert.equal(typeof withText, "string");
assert.ok(withText.includes("summarize this"));
assert.ok(withText.includes("Attached file notes.txt:"));
assert.ok(withText.includes("hello notes"));

// An image becomes a provider-ready part, with the caption naming the file.
const withImage = chatContentWithAttachments("what is this?", [imageFile]);
assert.ok(Array.isArray(withImage));
const parts = withImage as Array<{ type: string; text?: string; mime?: string; data?: string }>;
assert.ok(parts.some((p) => p.type === "text" && p.text?.includes("what is this?")));
assert.ok(
  parts.some((p) => p.type === "image" && p.mime === "image/png" && p.data === PNG_DATA),
);
assert.ok(parts.some((p) => p.type === "text" && p.text?.includes("Attached image: pup.png")));

// A photo with no caption is still a complete multimodal message.
const photoOnly = chatContentWithAttachments("", [imageFile]);
assert.ok(Array.isArray(photoOnly));
assert.ok((photoOnly as typeof parts).some((p) => p.type === "image"));

// Errored attachments never reach the model.
const broken: ComposerAttachment = { name: "x.png", size: 1, kind: "text", error: "nope" };
assert.equal(chatContentWithAttachments("hi", [broken]), "hi");

// --- normalization caps ------------------------------------------------------
const five = normalizeComposerAttachments(
  Array.from({ length: 5 }, (_, i) => ({ ...textFile, name: `f${i}.txt` })),
);
assert.equal(five.length, 4, "attachments are capped at 4");

const oversize = normalizeComposerAttachments([
  { name: "big.png", size: 9_000_000, kind: "image", mime: "image/png", data: PNG_DATA },
]);
assert.equal(oversize.length, 1);
assert.ok(oversize[0].error, "oversize image is an error entry");
assert.equal(toWireAttachments(oversize).length, 0, "error entries never go on the wire");

// Wire shape strips browser-only fields.
const wire = toWireAttachments([{ ...imageFile, previewUrl: "blob:xyz" }]);
assert.equal(wire.length, 1);
assert.equal(wire[0].previewUrl, undefined);

// The stream route's zod schema accepts a valid attachment and rejects junk.
assert.equal(composerAttachmentsSchema.parse([imageFile]).length, 1);
assert.throws(() => composerAttachmentsSchema.parse([{ name: "a", size: -1 }]));

// --- reconciliation with attachments -----------------------------------------
// Attachments ride along with their message; reconcile still matches on
// role + content, so a normal follow-up turn keeps the stored row (and its
// stored attachments) instead of duplicating it.
const stored = [
  { role: "user", content: "look at this", attachments: [imageFile] },
  { role: "assistant", content: "A tiny png." },
];
const incoming = [
  ...stored,
  { role: "user", content: "and this?", attachments: [textFile] },
];
const plan = reconcileChatMessages(stored, incoming);
assert.equal(plan.keepCount, 2);
assert.equal(plan.append.length, 1);
assert.equal(plan.append[0].attachments?.[0]?.name, "notes.txt");

// --- PWA surface ---------------------------------------------------------------
const m = manifest();
assert.equal(m.display, "standalone");
assert.equal(m.start_url, "/chat");
assert.ok(m.icons?.some((icon) => icon.sizes === "512x512" && icon.purpose === "maskable"));
assert.ok(m.icons?.some((icon) => icon.sizes === "192x192"));
assert.ok(existsSync("public/icon-192.png"));
assert.ok(existsSync("public/icon-512.png"));
assert.ok(existsSync("public/icon-maskable-512.png"));
const sw = readFileSync("public/sw.js", "utf8");
assert.ok(sw.includes('url.pathname.startsWith("/api/")'), "SW must never cache the API");
assert.ok(sw.includes("/offline"), "SW precaches the offline fallback");

console.log("check-chat-attachments: all assertions passed");
