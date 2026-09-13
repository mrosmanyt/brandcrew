# Cinem AI Assistant — Implementation Blueprint
*3 channels · 1 cloud brain · model-based billing. Founder ke liye build blueprint.*
*(Time/cost estimates hain. Legal/billing par expert se confirm karein — main lawyer/accountant nahi.)*

---

## Mera mashwara — 3 critical decisions (inpe shortcut mat lena)

**Decision 1 — EK backend, teen channels. (sabse important)**
Desktop app, website dashboard, aur Telegram — ye **teen alag systems nahi**, balki ek hi **cloud backend (Cinem AI Assistant Brain)** ke teen "remote controls" hain. Saari agent logic (content, SEO, edit, upload, stats) **cloud par ek jagah** rahegi. Teeno channel usi ek API ko call karenge.
> Agar aap website ka dashboard alag bana ke, aur desktop ki logic alag rakh ke chale, to do divergent systems ban jayenge — double kaam, double bugs. **Pehle backend, phir channels.**

**Decision 2 — "PC off ho phir bhi auto-upload + stats" ⇒ wo features cloud mein, desktop mein nahi.**
Daily auto-video + auto-upload + analytics ko **cloud backend** chalayega (24/7). Desktop app sirf ek client hai jo wahi cloud call karta hai. Tabhi website panel se bhi aur PC se bhi "same kaam" hoga, aur PC band hone par bhi rukega nahi.

**Decision 3 — Model-based billing = usage metering day one se.**
"Better model choose karo → zyada bill" sahi idea hai, lekin agar metering na ho to ek heavy user (Opus par) aapka poora margin kha jayega. Solution: **credits system** (niche Section 5). Har plan mein X credits; mehnga model zyada credits khaata hai. Isse client ko choice milti hai aur aapka margin safe rehta hai.

---

## 1. System overview

```
   ┌── Desktop app (Tauri) ──┐
   │   JARVIS features +      │
   │   cloud client          │
   └──────────┬──────────────┘
              │
   ┌── Website panel ────────┐        ┌─────────────────────────────┐
   │  cinem-ai-assistant.site/app      │──────▶ │      Cinem AI Assistant BRAIN (cloud)    │
   │  dashboard, stats,      │        │                             │
   │  connect socials        │        │  • API + Auth (Supabase)    │
   └──────────┬──────────────┘        │  • Job queue (BullMQ+Redis) │
              │                        │  • Workers: script, video,  │
   ┌── Telegram bot ─────────┐        │    edit, thumb, SEO, upload │
   │  "aaj ki video bana do" │──────▶ │  • Connectors (OAuth tokens)│
   └─────────────────────────┘        │  • Postgres + R2 storage    │
                                       │  • Billing + usage metering │
                                       └─────────────────────────────┘
```

Teeno channels = patle clients. Saara dimaag cloud mein.

---

## 2. Teen channels — kaun kya karega

**A. Website panel (cinem-ai-assistant.site/app) — asli product, sabse pehle banega**
Har client login → apna dashboard. Yahan se content banao, socials connect karo, stats dekho, schedule karo. Cloud par chalega → PC off bhi kaam.

**B. Desktop app (Cinem AI Assistant Tauri) — premium "JARVIS control center"**
Saare advanced/voice/automation features. Ab ye **cloud backend ko point karega** (alag system nahi). Jo log desktop power chahte hain unke liye.

**C. Telegram bot — mobile remote**
Sabse sasta + fast mobile interface. "Aaj ki video bana do", "stats bhejo" — sab cloud ko forward. (WhatsApp baad mein — uska Business API approval lagta hai.)

---

## 3. Website Dashboard — ek theme, ye sections

| Section | Data kahan se | Status |
|---|---|---|
| **Profit / Earnings** | YouTube Analytics API (estimated revenue, jahan monetized) + "value delivered" metric | API integrate |
| **Model usage** | Aapka credits/metering system | naya |
| **Latest video** | YouTube Data API | API |
| **Popular video** | YouTube Analytics (top by views) | API |
| **Next trending topics** | Script/Trending agent (Claude) — pehle se built | ready, port to cloud |
| **30-day planner** | Auto-Pilot campaign (Phase 4 pehle se built) | ready, port to cloud |
| **Script writer** | Script Studio (pehle se built) | ready, port to cloud |
| **Connected accounts** | OAuth connectors (YouTube/IG/TikTok) | naya |
| **Schedule / calendar** | Job scheduler | naya |

Achhi khabar: in mein se **trending, planner, script writer pehle se bane hain** — kaam unhe cloud par shift karna + dashboard UI hai.

**Social connect + auto-upload:** client har platform ek baar "Connect" (OAuth) karega → token cloud mein encrypted. Uske baad daily videos **official API se auto-upload** + stats wahi portal par. (Browser-automation nahi — warna bans + PC-on dependency.)

---

## 4. "Coming Soon" strategy (aapka curiosity wala idea — bilkul sahi)

Launch ke waqt website par sirf **core** (content + upload + stats + planner) live karo. Baaki JARVIS features (leads, scraping, CRM, employees, voice, vision…) **"Coming Soon"** badge ke saath dikhao.
- Faida 1: kam banana pada, jaldi launch.
- Faida 2: user tajassus mein rehta hai, retention barhti hai.
- Faida 3: har naya feature ek "launch moment" + marketing + re-engagement email.
Phir ek-ek karke unlock karte jao (har release par announcement).

---

## 5. Plans + Model-Based Billing (credits system)

**Buniyadi usool:** har plan = monthly **credits** + kaun se models unlocked + kitni platforms. Action ki cost credits mein; mehnga model = zyada credits.

| Plan | Price/mo | Models | Credits/mo (≈videos) | Platforms |
|---|---|---|---|---|
| Starter | $19 | Fast (Gemini Flash / Haiku) | ~15 | 1 |
| Pro | $39 | + Mid (Sonnet) | ~30 | 3 |
| Agency | $99–149 | + Best (Opus / premium video) | ~100 + white-label | sab |

**Model selection:** client jo model choose karega, har video usi hisaab se credits khaayega. Fast model = 1 credit, premium = 3–4 credits (aapki real cost + margin ke mutabiq). Credits khatam → upgrade ya top-up.

**Zaroori:**
- Stripe subscriptions + **metered/usage billing** use karo.
- 1 credit ki real cost (LLM + video-gen + storage) nikaalo; price aise rakho ke **margin ≥ 70%**.
- Heavy users ko premium tier par push karo — wahi aapka profit center.
- Annual plans (2 mahine free) = cash upfront → budget issue hal.

---

## 6. Build order — kya pehle (aapke liye, abhi)

**Phase 1 — Cloud brain + 1 platform end-to-end (sabse pehle)**
- Backend: API + Supabase auth + Postgres + job queue + R2 storage.
- Worker: script → (video) → ffmpeg → thumbnail → SEO.
- **YouTube**: OAuth connect + official upload + Analytics read.
- 1 test client se ek pura flow chale (PC off rehte hue).

**Phase 2 — Website dashboard**
- Login → panel. Sections: latest/popular video, trending topics, 30-day planner, script writer (ye logic port karo), connected accounts, schedule.
- "Coming Soon" badges baaki features par.

**Phase 3 — Billing + plans + model selection**
- Stripe + credits metering + 3 plans + model picker.

**Phase 4 — Telegram bot + Desktop re-point**
- Telegram thin client (same backend).
- Desktop app ko cloud backend par point karo (3rd client ban jaye).

**Phase 5 — Beta (500 leads se 20–50) → paid launch → IG/TikTok → modules**
- Retention measure → phir ads/scale.

---

## 7. Tech stack (suggested, sasta + scalable)

- **Backend:** Node + Fastify/Express · **Queue:** BullMQ + Redis · **DB:** Postgres (Supabase) · **Auth:** Supabase (pehle se hai) · **Storage:** Cloudflare R2 · **Billing:** Stripe · **Video edit:** ffmpeg · **LLM:** Claude/Gemini APIs · **Video-gen:** ek reliable API (cost test karke) · **Web:** Next.js (aapki site pehle se) · **VPS:** Hetzner/Contabo (chhote se shuru, scale par bade).

---

## 8. Do hard gates (har phase par)
1. **Per-credit / per-client cost** — plan mein profit banta hai? (margin ≥ 70%)
2. **Multi-tenant isolation** — client A kabhi client B ka data na chhuye. (security = company ki zindagi)

---

## Aaj ke 5 kaam
1. Chhota VPS lo · backend skeleton (auth + queue + 1 worker) khada karo.
2. YouTube OAuth connect + official upload integrate karo.
3. 1 video-gen API test → 1 credit ki real cost nikaalo → pricing lock.
4. Dashboard ka pehla version: trending + planner + script writer (logic pehle se hai) cloud par.
5. Stripe + 3 plans + credits metering ka design final karo.
