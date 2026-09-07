import { addDays, format } from "date-fns";
import type { AgentRole } from "@/lib/constants";
import type { BrandKit } from "@/lib/brand-kit";

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
          "Creative only. Brandcrew does not connect Meta or spend media.",
        content: `# Ad angles (creative only)

Brandcrew does not buy media, connect ad accounts, or set budgets.

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
  }
}

export function demoGenerateWeek(kit: BrandKit) {
  const { offer } = company(kit);
  const start = addDays(new Date(), 1);
  const posts = [
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
    {
      title: "Proof from one room",
      body: "One property. One before/after. One number. That is enough to decide if the House Look is real.",
    },
    {
      title: "Forbidden words, on purpose",
      body: `We will not write ${kit.forbiddenWords.slice(0, 3).join(", ") || "synergy, disrupt, world-class"}. Concrete nouns only.`,
    },
  ];

  const calendar = posts.map((post, index) => ({
    date: format(addDays(start, index), "yyyy-MM-dd"),
    channel: "linkedin",
    title: post.title,
    content: post.body,
  }));

  const content = [
    "# Generate week — 7 LinkedIn posts",
    "",
    ...posts.flatMap((post, index) => [
      `## ${index + 1}. ${post.title}`,
      post.body,
      "",
    ]),
  ].join("\n");

  return {
    type: "writer_week",
    title: "7 LinkedIn posts for the week",
    summary:
      "A week of posts in Brand Kit voice. Approve to drop them on the Distributor calendar.",
    content,
    calendar,
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
