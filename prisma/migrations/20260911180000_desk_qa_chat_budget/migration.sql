-- Cheap-model desk Q&A counter (Free/Pro). Playbook jobs keep using tokenUsed.
ALTER TABLE "Workspace" ADD COLUMN "chatTokenUsed" INTEGER NOT NULL DEFAULT 0;

-- Replace the shipped hospitality / House Look demo Brand Kit on live desks.
-- Custom kits that do not contain all three demo markers are left alone.
UPDATE "Workspace"
SET "brandKit" = '{"voice":"Warm, specific, and commercially sharp. Sounds like a senior operator on an AI employee desk — not a generic chatbot. Short sentences. Concrete nouns. No hype adjectives.","audience":"Agencies, operators, and teams who need an AI employee for knowledge work: drafts, research, files, browse, and gated sends — across industries, not a single vertical.","offer":"CINEM Pro desk. An AI employee desk: Brand Kit, jobs, artifacts, drafts, public-web browse, and Gmail drafts when connected. Help with documents, research, coding, scheduling, and desk work across industries — not a hospitality-only studio.","website":"https://example.com","samplePosts":["An AI employee desk is not a chatbot tab. It keeps a Brand Kit, runs jobs, and waits for you before anything leaves.","If the brief lives in someone''s head and the drafts live in five tools, the work is already split. Put the facts in the Brand Kit and let the desk reuse them."],"forbiddenWords":["synergy","disrupt","world-class","leverage","cutting-edge","guru","unlock"]}'
WHERE "brandKit" LIKE '%hotel kitchens%'
  AND "brandKit" LIKE '%Independent hospitality groups (3–20 locations)%'
  AND "brandKit" LIKE '%House Look engagement%';
