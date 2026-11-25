/**
 * Chat memory + custom instructions (per user).
 *
 * Facts are written ONLY by the user in the Memory panel — v1 has no
 * silent extraction — and the user can view and delete every fact.
 * The system-prompt block is assembled here so the stream route stays
 * thin; memory is data for the model, never instructions to the system.
 */
import { prisma } from "@/lib/db";
import { ClientError } from "@/lib/http";
import {
  isChatLanguageMode,
  type ChatLanguageMode,
} from "@/lib/chat-language";

export const CUSTOM_INSTRUCTIONS_MAX = 2000;
export const MEMORY_FACT_MAX = 500;
export const MEMORY_FACTS_MAX_PER_USER = 100;

export type ChatMemoryDTO = {
  customInstructions: string;
  /** Saved reply-language mode ("auto" mirrors the user's language). */
  responseLanguage: ChatLanguageMode;
  facts: { id: string; fact: string; createdAt: string }[];
};

/** A stored mode that predates the registry (or is corrupt) reads as auto. */
function toChatLanguageMode(value: string | null | undefined): ChatLanguageMode {
  return isChatLanguageMode(value) ? value : "auto";
}

export async function getChatMemory(userId: string): Promise<ChatMemoryDTO> {
  const [settings, facts] = await Promise.all([
    prisma.chatUserSettings.findUnique({ where: { userId } }),
    prisma.chatMemoryFact.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      take: MEMORY_FACTS_MAX_PER_USER,
    }),
  ]);
  return {
    customInstructions: settings?.customInstructions ?? "",
    responseLanguage: toChatLanguageMode(settings?.responseLanguage),
    facts: facts.map(
      (row: { id: string; fact: string; createdAt: Date }) => ({
        id: row.id,
        fact: row.fact,
        createdAt: row.createdAt.toISOString(),
      }),
    ),
  };
}

export async function setCustomInstructions(userId: string, text: string) {
  const customInstructions = text.trim().slice(0, CUSTOM_INSTRUCTIONS_MAX);
  await prisma.chatUserSettings.upsert({
    where: { userId },
    create: { userId, customInstructions },
    update: { customInstructions },
  });
  return customInstructions;
}

/** The user's saved reply-language mode; "auto" when never set. */
export async function getResponseLanguage(
  userId: string,
): Promise<ChatLanguageMode> {
  const settings = await prisma.chatUserSettings.findUnique({
    where: { userId },
    select: { responseLanguage: true },
  });
  return toChatLanguageMode(settings?.responseLanguage);
}

export async function setResponseLanguage(
  userId: string,
  mode: ChatLanguageMode,
) {
  await prisma.chatUserSettings.upsert({
    where: { userId },
    create: { userId, responseLanguage: mode },
    update: { responseLanguage: mode },
  });
  return mode;
}

export async function addMemoryFact(userId: string, factRaw: string) {
  const fact = factRaw.trim().slice(0, MEMORY_FACT_MAX);
  if (!fact) throw new ClientError("Write the fact you want remembered.", 400);
  const count = await prisma.chatMemoryFact.count({ where: { userId } });
  if (count >= MEMORY_FACTS_MAX_PER_USER) {
    throw new ClientError(
      `Memory is full (${MEMORY_FACTS_MAX_PER_USER} facts). Delete something first.`,
      400,
    );
  }
  const row = await prisma.chatMemoryFact.create({ data: { userId, fact } });
  return { id: row.id, fact: row.fact, createdAt: row.createdAt.toISOString() };
}

export async function deleteMemoryFact(userId: string, factId: string) {
  const existing = await prisma.chatMemoryFact.findFirst({
    where: { id: factId, userId },
    select: { id: true },
  });
  if (!existing) throw new ClientError("That memory fact was not found.", 404, "not_found");
  await prisma.chatMemoryFact.delete({ where: { id: factId } });
}

/**
 * The extra system-prompt block for a turn, or null when the user has
 * neither custom instructions nor saved facts.
 */
export async function buildMemorySystemBlock(userId: string): Promise<string | null> {
  const memory = await getChatMemory(userId);
  const parts: string[] = [];
  if (memory.customInstructions) {
    parts.push(
      `The user has set these custom instructions. Follow them where they fit the request:\n${memory.customInstructions}`,
    );
  }
  if (memory.facts.length) {
    parts.push(
      `Things the user has asked you to remember about them:\n${memory.facts
        .map((row) => `- ${row.fact}`)
        .join("\n")}`,
    );
  }
  return parts.length ? parts.join("\n\n") : null;
}
