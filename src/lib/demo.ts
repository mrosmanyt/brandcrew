import { addDays, format } from "date-fns";
import type { AgentRole } from "@/lib/constants";
import { brandLabel, type BrandKit } from "@/lib/brand-kit";

function company(kit: BrandKit) {
  const offer = kit.offer || "the offer";
  const audience = kit.audience || "the target customer";
  return { offer, audience, voice: kit.voice || "clear and specific" };
}

export function demoArtifact(role: AgentRole, kit: BrandKit) {
  const { offer, audience } = company(kit);
  const start = new Date();

  switch (role) {
    case "strategist":
      return {
        type: "strategy_brief",
        title: "ICP, offer, and monthly pillars",
        summary:
          "A single strategy brief the Writer, Distributor, and Sales agents can share.",
        content: `# Strategy brief

## Ideal customer
${audience}

They already know the product is good. What they lack is a house look that matches the floor experience — and a weekly cadence that does not sound like a hotel chain.

## Offer
${offer}

Position it as an 8-week engagement with a named owner, a mid-point tasting of the system, and a launch kit the GM can brief in 20 minutes.

## Monthly content pillars
1. **House look vs chain look** — show the mismatch guests already feel.
2. **The floor is the brand** — menus, signage, and pre-shift language.
3. **Proof from the room** — one property, one before/after, one number.

## What not to say
Avoid ${kit.forbiddenWords.slice(0, 4).join(", ") || "generic agency adjectives"}. Speak in rooms, plates, and check-in desks.
`,
      };
    case "researcher":
      return {
        type: "research_pack",
        title: "Company research pack",
        summary: "A sourced read of the company site plus messaging implications.",
        content: demoResearchMarkdown(kit),
      };
    case "writer":
      return {
        type: "voice_pack",
        title: "LinkedIn + newsletter drafts",
        summary: "Two posts and one letter in Brand Kit voice.",
        content: `# Voice pack

## LinkedIn — 1
A tasting menu is a brand system.

Courses have sequence, contrast, and a last impression. Most booking pages have a photo, a price, and a paragraph that could sit on any other site.

If the room feels like a house and the website feels like a chain, guests notice before they ever unpack.

## LinkedIn — 2
We do not start with a logo.

We start with the sentence the GM says at pre-shift. If that sentence cannot live on the homepage, the brand is already split in two.

${offer}

## Newsletter draft — “The last impression”
Subject: The course guests remember

${audience.split(".")[0]}.

This month we are writing about last impressions: the walk to the door, the printed menu, the confirmation email that still reads like a template.

If you want the House Look brief, reply with the name of the property. We will send the one-pager, not a deck.
`,
      };
    case "distributor": {
      const days = Array.from({ length: 30 }, (_, i) => {
        const date = format(addDays(start, i), "yyyy-MM-dd");
        const weekday = format(addDays(start, i), "EEE");
        const pillar =
          i % 3 === 0
            ? "House look vs chain look"
            : i % 3 === 1
              ? "The floor is the brand"
              : "Proof from the room";
        const channel =
          weekday === "Tue" || weekday === "Thu"
            ? "linkedin"
            : weekday === "Sat"
              ? "email"
              : "linkedin";
        return {
          date,
          channel,
          title: `${pillar} — ${weekday}`,
          content: `Short ${channel} note on ${pillar.toLowerCase()}. Keep the Brand Kit voice. No ${kit.forbiddenWords[0] || "hype"}.`,
        };
      });
      const md = [
        "# 30-day content calendar",
        "",
        "| Date | Channel | Title | Note |",
        "| --- | --- | --- | --- |",
        ...days.map(
          (d) => `| ${d.date} | ${d.channel} | ${d.title} | ${d.content} |`,
        ),
        "",
        "_Paste into Google Docs or keep as Markdown._",
      ].join("\n");
      return {
        type: "content_calendar",
        title: "30-day content calendar",
        summary: "A month of planned posts, ready to export.",
        content: md,
        calendar: days,
      };
    }
    case "sales":
      return {
        type: "outbound_pack",
        title: "Outbound email + LinkedIn DMs",
        summary: "Eight scripts aimed at the ICP. No CRM attached.",
        content: `# Outbound pack

## Email 1 — GM, first touch
Subject: The confirmation email vs the lobby

I stayed near one of your properties last month and the booking email did not match the room. ${offer.split(".")[0]}.

Worth a 15-minute look at the House Look brief?

## Email 2 — Owner, follow-up
Subject: One property, one system

We only need one location to prove the system. If the floor staff can brief it, we keep going. If not, we stop.

## Email 3 — Breakup
Subject: Closing the loop

I will leave this here. If the next renovation includes the website, I am around.

## LinkedIn DM 1
Saw the new rooms. The site still reads like the old ones. We fix that mismatch in 8 weeks.

## LinkedIn DM 2
Quick question: who owns the sentence the GM says at pre-shift? That is usually where the brand actually lives.

## LinkedIn DM 3
Sending a one-pager, not a deck. House Look: positioning, menus, launch kit.

## Email 4 — Food producer variant
Subject: The label vs the site

Your product looks handmade. The website looks syndicated. We write the system so they match.

## Email 5 — Referral ask
Subject: Who is renovating next?

If you know a GM mid-refresh, I would rather they see one property than a case-study page.
`,
      };
    case "ads":
      return {
        type: "ad_angles",
        title: "Five ad angles + primary text",
        summary:
          "Creative only. CINEM Pro does not connect Meta or spend media.",
        content: `# Ad angles (creative only)

CINEM Pro does not buy media, connect ad accounts, or set budgets.

## 1. The mismatch
Primary: The rooms feel like a house. The booking page feels like a chain. Guests notice.

## 2. Pre-shift sentence
Primary: If the GM cannot say it in one sentence, the homepage should not try either.

## 3. One property
Primary: We do not need your whole group. We need one location and 8 weeks.

## 4. Last impression
Primary: The walk to the door is part of the brand. So is the confirmation email.

## 5. Floor staff test
Primary: If the launch kit takes more than 20 minutes to brief, it is not finished.

Audience hint: ${audience}
`,
      };
    case "ops":
      return {
        type: "ops_board",
        title: "Approve → schedule → done",
        summary: "A short board pulled from the current desk.",
        content: `# Ops board

Move work through three columns only: Approve, Schedule, Done.

Suggested tasks:
1. Approve the strategy brief
2. Approve the voice pack
3. Schedule the first LinkedIn post
4. Export the 30-day calendar
5. Mark the outbound pack ready to send
`,
        tasks: [
          {
            title: "Approve the strategy brief",
            description: "Strategist artifact — one ICP, offer, pillars.",
            status: "approve",
          },
          {
            title: "Approve the voice pack",
            description: "Writer — LinkedIn + newsletter.",
            status: "approve",
          },
          {
            title: "Schedule first LinkedIn post",
            description: "Take the approved post onto the calendar.",
            status: "schedule",
          },
          {
            title: "Export 30-day calendar",
            description: "Markdown / Docs-ready file from Distributor.",
            status: "schedule",
          },
          {
            title: "Send first outbound script",
            description: "Sales pack, email 1 only.",
            status: "done",
          },
        ],
      };
    case "builder":
      return {
        type: "website",
        title: `${brandLabel(kit)} site`,
        summary: "Offline demo landing page. Preview in the desk.",
        content: demoWebsiteHtml(kit),
      };
  }
}

export function demoLinkedInPosts(kit: BrandKit) {
  const { offer } = company(kit);
  return [
    {
      title: "The mismatch guests already feel",
      body: `The rooms feel like a house. The booking page feels like a chain.\n\nGuests notice before they unpack. ${offer.split(".")[0]}.`,
    },
    {
      title: "Pre-shift is the brand",
      body: "If the GM cannot say it in one sentence at pre-shift, the homepage should not try either.",
    },
    {
      title: "One property, eight weeks",
      body: "We do not need the whole group on day one. We need one location, a named owner, and a launch kit the floor can brief in 20 minutes.",
    },
    {
      title: "Last impression",
      body: "The walk to the door is part of the brand. So is the confirmation email that still reads like a template.",
    },
    {
      title: "Menus are a system",
      body: "A tasting menu has sequence, contrast, and a last course. Most websites have a photo, a price, and a paragraph that could sit on any other site.",
    },
  ];
}

export function demoResearchMarkdown(
  kit: BrandKit,
  fetched?: { url: string; ok: boolean; text: string },
) {
  const { offer, audience } = company(kit);
  const source = fetched?.url || kit.website || "(no URL)";
  const excerpt = fetched?.text
    ? fetched.text.slice(0, 600)
    : "No live page text. This pack is inferred from the Brand Kit so the agent still has a source of truth (offline demo).";
  return `# Research pack

## Source
${source}
${fetched?.ok ? "Fetched and converted to text (size-capped)." : fetched ? `Fetch note: page was not fully readable.` : "Offline / Brand Kit fallback."}

## What the site says
${excerpt}

## Company read
Audience: ${audience}

Offer: ${offer}

The public page should sound as specific as the floor. If it reads like a chain, that mismatch is the story — not a slogan.

## Messaging implications
1. Lead with rooms, plates, and check-in — not agency adjectives.
2. One property is enough proof. Do not promise a group-wide rebrand.
3. Forbidden: ${kit.forbiddenWords.slice(0, 4).join(", ") || "hype words"}.

## What not to copy
Do not invent testimonials or traffic numbers. Report only what was fetched plus the Brand Kit.
`;
}

export function demoResearchPack(
  kit: BrandKit,
  fetched?: { url: string; ok: boolean; text: string },
) {
  return {
    type: "research_pack",
    title: "Company research pack",
    summary: "Sourced notes for Writer and SDR. Approve before it is shared.",
    content: demoResearchMarkdown(kit, fetched),
  };
}

export function demoGenerateWeek(kit: BrandKit) {
  const posts = demoLinkedInPosts(kit);
  const start = addDays(new Date(), 1);

  const calendar = posts.map((post, index) => ({
    date: format(addDays(start, index), "yyyy-MM-dd"),
    channel: "linkedin",
    title: post.title,
    content: post.body,
  }));

  const content = [
    "# LinkedIn week — 5 posts",
    "",
    ...posts.flatMap((post, index) => [
      `## ${index + 1}. ${post.title}`,
      post.body,
      "",
    ]),
  ].join("\n");

  return {
    type: "writer_week",
    title: "5 LinkedIn posts for the week",
    summary:
      "A week of posts in Brand Kit voice. Approve to drop them on the Distributor calendar.",
    content,
    calendar,
  };
}

export function demoCompetitorMarkdown(
  kit: BrandKit,
  pages?: { url: string; ok: boolean; text: string; excerpt?: string }[],
) {
  const { offer, audience } = company(kit);
  const rows =
    pages?.length
      ? pages
      : [{ url: kit.website || "(no URL)", ok: false, text: "", excerpt: "" }];
  const sections = rows.map((page, index) => {
    const excerpt = page.excerpt || page.text.slice(0, 400) || "(no text captured)";
    return `## ${index + 1}. ${page.url}
${page.ok ? "Browsed (read-only)." : "Partial / failed read."}

${excerpt}
`;
  });
  return `# Competitor scan

Read-only comparison of ${rows.length} public page${rows.length === 1 ? "" : "s"}. No login. Nothing was sent.

${sections.join("\n")}
## Comparison
Audience we sell to: ${audience}

Offer we hold up against these pages: ${offer}

1. **Specificity** — if a page could sit on any other site, that is the gap, not a slogan.
2. **Proof** — only cite what was actually on the page. No invented traffic or testimonials.
3. **Voice** — forbidden for us: ${kit.forbiddenWords.slice(0, 4).join(", ") || "hype words"}.

## What not to copy
Do not copy competitor claims we did not see. Report only browsed text plus the Brand Kit.
`;
}

export function demoOutreachFromResearch(
  kit: BrandKit,
  research?: { title?: string; content?: string },
) {
  const { offer, audience } = company(kit);
  const source = research?.title
    ? `Grounded in “${research.title}”.`
    : "No prior research artifact — grounded in the Brand Kit only.";
  const snippet = research?.content?.slice(0, 400) || offer;
  const dms = [
    `Saw the public site vs how ${audience.split(".")[0] || "your floor"} actually feels. ${offer.split(".")[0]}. Worth a 15-minute look?`,
    "Quick question: who owns the sentence at pre-shift? That is usually where the brand lives — not the homepage hero.",
    "Sending a one-pager, not a deck. We start with one property and 8 weeks.",
    `From the research notes: ${snippet.split("\n")[0]?.slice(0, 160) || offer.split(".")[0]}. Happy to contrast that with a House Look brief.`,
    "If the launch kit takes more than 20 minutes to brief, it is not finished. That is the test — not a CRM sequence.",
  ];
  const content = [
    "# Outreach pack — 5 LinkedIn DMs",
    "",
    source,
    "",
    "CINEM Pro will not send these. Approve, then you copy/paste.",
    "",
    ...dms.map((body, index) => `## LinkedIn DM ${index + 1}\n${body}\n`),
  ].join("\n");
  return {
    type: "outreach_pack",
    title: "5 LinkedIn DMs from research",
    summary: "Five DMs grounded in research. Not sent.",
    content,
  };
}

export function demoInboxReplies(
  kit: BrandKit,
  messages?: { from: string; subject: string; date: string }[],
) {
  const { offer, voice } = company(kit);
  const listed = messages?.length
    ? messages
        .map(
          (msg, index) =>
            `${index + 1}. ${msg.date || "(date ?)"} — ${msg.from || "(unknown)"}\n   ${msg.subject}`,
        )
        .join("\n")
    : "Gmail is not connected. These drafts use the Brand Kit and your brief only — not a live inbox.";
  const replies = (messages?.length ? messages.slice(0, 3) : [{ from: "a guest", subject: "Question about the offer" }]).map(
    (msg, index) =>
      `## Reply ${index + 1}${msg.from ? ` — ${msg.from}` : ""}\nSubject: Re: ${msg.subject || "your note"}\n\nThanks for writing. ${offer.split(".")[0]}. Happy to walk through next steps — nothing is sent until you copy this out.\n`,
  );
  return {
    type: "inbox_replies",
    title: "Inbox replies (not sent)",
    summary: "Draft replies. Approve-before-send. CINEM Pro does not send mail.",
    content: `# Inbox replies (approve before send)

Voice: ${voice}

## Inbox
${listed}

CINEM Pro will not send these. Approve, then you send from Gmail (or skip).

${replies.join("\n")}
`,
  };
}

export function demoWhatsAppDrafts(kit: BrandKit) {
  const { offer, audience } = company(kit);
  return {
    type: "whatsapp_drafts",
    title: "WhatsApp drafts (not sent)",
    summary: "Short WhatsApp copy. CINEM Pro never sends WhatsApp.",
    content: `# WhatsApp drafts (do not send)

These are copy-paste drafts for ${audience.split(".")[0] || "your customer"}.
CINEM Pro never logs into WhatsApp and never calls Twilio send — even if a Twilio token is stored.

## Follow-up 1
Hi — ${offer.split(".")[0]}. Want the one-pager?

## Follow-up 2
Quick check-in. Still useful to walk through the 8-week plan?

## Follow-up 3
Sharing a short brief, not a deck. Reply here if you want it.

Nothing above was sent.
`,
  };
}

export function demoAdAnglesFromUrl(
  kit: BrandKit,
  fetched?: { url: string; ok: boolean; text: string },
) {
  const { audience } = company(kit);
  const source = fetched?.url || kit.website || "(no URL)";
  const excerpt =
    fetched?.text?.slice(0, 400) || "No live page text — angles inferred from the Brand Kit.";
  return {
    type: "ad_angles",
    title: "Five ad angles from the landing page",
    summary: "Creative only. CINEM Pro does not connect Meta or spend media.",
    content: `# Ad angles from URL (creative only)

Source: ${source}
${fetched?.ok ? "Browsed read-only." : "Page was not fully readable."}

What the page said:
${excerpt}

CINEM Pro does not buy media, connect ad accounts, or set budgets.

## 1. The mismatch
Primary: The rooms feel like a house. The booking page feels like a chain. Guests notice.

## 2. Pre-shift sentence
Primary: If the GM cannot say it in one sentence, the homepage should not try either.

## 3. One property
Primary: We do not need your whole group. We need one location and 8 weeks.

## 4. Last impression
Primary: The walk to the door is part of the brand. So is the confirmation email.

## 5. Floor staff test
Primary: If the launch kit takes more than 20 minutes to brief, it is not finished.

Audience hint: ${audience}
`,
  };
}

export function demoSalesPack(kit: BrandKit) {
  const { offer, audience } = company(kit);
  const emails = [
    [
      "The confirmation email vs the lobby",
      `I stayed near one of your properties. The booking email did not match the room.\n\n${offer.split(".")[0]}. Worth 15 minutes?`,
    ],
    [
      "One property, one system",
      "We only need one location to prove the system. If the floor staff can brief it, we keep going.",
    ],
    [
      "Closing the loop",
      "I will leave this here. If the next renovation includes the website, I am around.",
    ],
    [
      "The label vs the site",
      "Your product looks handmade. The website looks syndicated. We write the system so they match.",
    ],
    [
      "Who is renovating next?",
      "If you know a GM mid-refresh, I would rather they see one property than a case-study page.",
    ],
  ] as const;
  const dms = [
    "Saw the new rooms. The site still reads like the old ones. We fix that mismatch in 8 weeks.",
    "Who owns the sentence the GM says at pre-shift? That is usually where the brand lives.",
    "Sending a one-pager, not a deck. House Look: positioning, menus, launch kit.",
    `For ${audience.split(".")[0] || "your group"} — we start with one property, not a rebrand circus.`,
    "If the launch kit takes more than 20 minutes to brief, it is not finished. That is the test.",
  ];

  const content = [
    "# Sales pack — 5 emails + 5 LinkedIn DMs",
    "",
    ...emails.flatMap(([subject, body], index) => [
      `## Email ${index + 1} — ${subject}`,
      `Subject: ${subject}`,
      "",
      body,
      "",
    ]),
    ...dms.map((body, index) => `## LinkedIn DM ${index + 1}\n${body}\n`),
  ].join("\n");

  return {
    type: "sales_pack",
    title: "5 emails + 5 LinkedIn DMs",
    summary: "Ten scripts you can send today. No CRM fields.",
    content,
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function demoWebsiteHtml(kit: BrandKit) {
  const name = escapeHtml(brandLabel(kit));
  const offer = escapeHtml(kit.offer || "A clear offer, written in your voice.");
  const audience = escapeHtml(kit.audience || "the people you already serve");
  const voice = escapeHtml(kit.voice || "clear and specific");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #111110; color: #f4f1ea; }
    header, main, footer { max-width: 44rem; margin: 0 auto; padding: 2.5rem 1.25rem; }
    .kicker { font-size: 0.75rem; letter-spacing: 0.16em; text-transform: uppercase; color: #c4b49a; }
    h1 { font-size: clamp(2rem, 5vw, 3.2rem); line-height: 1.1; letter-spacing: -0.04em; margin: 0.4em 0; }
    p { line-height: 1.65; color: #d8d2c6; }
    .cta { display: inline-block; margin-top: 1.25rem; padding: 0.7rem 1.1rem; border-radius: 999px; background: #f4f1ea; color: #111110; text-decoration: none; font-weight: 600; }
    section { border-top: 1px solid #2a2926; padding-top: 1.5rem; }
  </style>
</head>
<body>
  <header>
    <p class="kicker">Offline demo · not published</p>
    <h1>${name}</h1>
    <p>${offer}</p>
    <a class="cta" href="#offer">See the offer</a>
  </header>
  <main>
    <section id="offer">
      <p class="kicker">For</p>
      <h2>Made for ${audience}</h2>
      <p>Voice: ${voice}. This page is a Brand Kit sketch you can approve. CINEM Pro does not publish it.</p>
    </section>
  </main>
  <footer>
    <p>Generated on the desk. Preview only.</p>
  </footer>
</body>
</html>`;
}

export function demoBrandKitDraft(kit: BrandKit) {
  const { offer, audience, voice } = company(kit);
  const samples = kit.samplePosts.slice(0, 2);
  return {
    type: "brand_kit_draft",
    title: `${brandLabel(kit)} creative draft`,
    summary: "Voice lines, visual direction, and headlines from the Brand Kit. Not published.",
    content: `# Brand Kit creative

## Voice
${voice}

## Who it is for
${audience}

## Offer, said plainly
${offer}

## Visual direction
Warm paper, one dark mark, no coral gradients. Type stays large and specific. Photography should look like the floor — not a stock lobby.

## Headline options
1. The rooms already know who you are.
2. If the floor can say it, the site can too.
3. One property. Eight weeks. A look the staff can brief.

## Lines that already work
${samples.length ? samples.map((line) => `- ${line}`).join("\n") : "- Write the sentence the GM says at pre-shift."}

## What not to say
Avoid ${kit.forbiddenWords.slice(0, 5).join(", ") || "generic agency adjectives"}.
`,
  };
}

export function demoDeckHtml(kit: BrandKit) {
  const name = escapeHtml(brandLabel(kit));
  const offer = escapeHtml(kit.offer || "A clear offer, written in your voice.");
  const audience = escapeHtml(kit.audience || "the people you already serve");
  const voice = escapeHtml(kit.voice || "clear and specific");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name} deck</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: #111110; color: #f4f1ea; }
    .deck { display: grid; gap: 0; }
    section { min-height: 100vh; padding: 2.5rem 2rem; border-bottom: 1px solid #2a2926; display: flex; flex-direction: column; justify-content: center; }
    .kicker { font-size: 0.72rem; letter-spacing: 0.16em; text-transform: uppercase; color: #c4b49a; margin: 0 0 0.75rem; }
    h1, h2 { letter-spacing: -0.04em; line-height: 1.1; margin: 0 0 0.75rem; }
    h1 { font-size: clamp(2rem, 6vw, 3.2rem); }
    h2 { font-size: clamp(1.5rem, 4vw, 2.2rem); }
    p { line-height: 1.6; color: #d8d2c6; max-width: 36rem; }
    ol { margin: 0; padding-left: 1.1rem; color: #d8d2c6; line-height: 1.7; }
    .note { margin-top: 1.5rem; font-size: 0.75rem; color: #8a8478; }
  </style>
</head>
<body>
  <div class="deck">
    <section>
      <p class="kicker">Offline demo · not published</p>
      <h1>${name}</h1>
      <p>${offer}</p>
    </section>
    <section>
      <p class="kicker">Audience</p>
      <h2>Built for people who already know the product is good</h2>
      <p>${audience}</p>
    </section>
    <section>
      <p class="kicker">Voice</p>
      <h2>How it should sound</h2>
      <p>${voice}</p>
    </section>
    <section>
      <p class="kicker">The work</p>
      <h2>Eight weeks, one property</h2>
      <ol>
        <li>Positioning the floor already believes.</li>
        <li>A look the staff can brief in 20 minutes.</li>
        <li>A launch kit — not a slide that dies in email.</li>
      </ol>
    </section>
    <section>
      <p class="kicker">Next</p>
      <h2>Approve the deck, then we write the site</h2>
      <p>CINEM Pro does not publish this. Preview stays on the desk.</p>
      <p class="note">Generated from the Brand Kit. Local iframe only.</p>
    </section>
  </div>
</body>
</html>`;
}

export function demoAppHtml(kit: BrandKit) {
  const name = escapeHtml(brandLabel(kit));
  const offer = escapeHtml(kit.offer || "the offer");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name} app</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; min-height: 100vh; font-family: ui-sans-serif, system-ui, sans-serif; background: #101114; color: #eef0f4; display: grid; place-items: center; }
    .card { width: min(22rem, 92vw); background: #181a1f; border: 1px solid #2a2d34; border-radius: 1rem; padding: 1.25rem; }
    h1 { margin: 0 0 0.35rem; font-size: 1.15rem; }
    p { margin: 0 0 1rem; color: #a8adb8; font-size: 0.9rem; line-height: 1.5; }
    label { display: block; font-size: 0.75rem; color: #8b909a; margin-bottom: 0.35rem; }
    input, textarea { width: 100%; box-sizing: border-box; border: 1px solid #32363e; background: #101114; color: inherit; border-radius: 0.6rem; padding: 0.55rem 0.7rem; }
    textarea { min-height: 4.5rem; resize: vertical; }
    button { margin-top: 0.75rem; width: 100%; border: 0; border-radius: 0.6rem; padding: 0.65rem; background: #eef0f4; color: #101114; font-weight: 600; }
    .note { margin-top: 0.75rem; font-size: 0.75rem; color: #7d828c; }
  </style>
</head>
<body>
  <form class="card" action="#" method="get">
    <h1>${name} intake</h1>
    <p>Capture a lead for ${offer}. Nothing is sent — this preview stays in the desk.</p>
    <label for="who">Name</label>
    <input id="who" name="who" placeholder="Alex">
    <label for="note" style="margin-top:0.7rem">What they need</label>
    <textarea id="note" name="note" placeholder="One sentence"></textarea>
    <button type="submit">Save locally</button>
    <p class="note">Offline demo app. No Replit login. No network.</p>
  </form>
</body>
</html>`;
}
